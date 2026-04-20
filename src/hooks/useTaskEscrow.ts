'use client'

import { useState, useCallback } from 'react'
import {
  useWriteContract,
  useChainId,
} from 'wagmi'
import { keccak256, encodePacked } from 'viem'
import {
  TASK_ESCROW_ABI,
  CUSD_ABI,
  ESCROW_ADDRESSES,
  CUSD_ADDRESSES,
  TASK_PRICES_CUSD,
  type TaskType,
} from '@/lib/contracts'
import type { TaskResult } from '@/lib/agentcash'

export type TaskPhase =
  | 'idle'
  | 'checking_allowance'
  | 'approving'
  | 'awaiting_approval'
  | 'depositing'
  | 'awaiting_deposit'
  | 'processing'
  | 'complete'
  | 'failed'

export interface HistoryEntry {
  taskId:    string
  taskType:  TaskType
  input:     string
  status:    'complete' | 'failed'
  result:    TaskResult | null
  amountPaid: string
  txHash:    string
  timestamp: number
}

function generateTaskId(address: `0x${string}`, taskType: TaskType): `0x${string}` {
  // Use crypto-random nonce to prevent task ID collisions on rapid submissions
  const randomBytes = new Uint8Array(32)
  crypto.getRandomValues(randomBytes)
  const nonce = ('0x' + Array.from(randomBytes, b => b.toString(16).padStart(2, '0')).join('')) as `0x${string}`
  return keccak256(
    encodePacked(
      ['address', 'string', 'bytes32'],
      [address, taskType, nonce]
    )
  )
}

function saveToHistory(entry: HistoryEntry, userAddress: string) {
  try {
    const key = `minipay_ai_history_${userAddress.toLowerCase()}`
    const existing = JSON.parse(localStorage.getItem(key) || '[]') as HistoryEntry[]
    const updated = [entry, ...existing].slice(0, 20) // keep last 20
    localStorage.setItem(key, JSON.stringify(updated))
  } catch {
    // localStorage may be restricted in MiniPay WebView
  }
}

export function loadHistory(userAddress: string): HistoryEntry[] {
  try {
    const key = `minipay_ai_history_${userAddress.toLowerCase()}`
    return JSON.parse(localStorage.getItem(key) || '[]') as HistoryEntry[]
  } catch {
    return []
  }
}

export function useTaskEscrow(userAddress?: `0x${string}`) {
  const chainId = useChainId()
  const escrowAddress = ESCROW_ADDRESSES[chainId]
  const cusdAddress   = CUSD_ADDRESSES[chainId]

  const [phase, setPhase] = useState<TaskPhase>('idle')
  const [result, setResult] = useState<TaskResult | null>(null)
  const [error, setError]   = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [taskId, setTaskId] = useState<`0x${string}` | null>(null)

  // Write contracts
  const { writeContractAsync: writeApprove } = useWriteContract()
  const { writeContractAsync: writeDeposit } = useWriteContract()

  // (tx receipt tracking is handled inline via publicClient.waitForTransactionReceipt)

  const reset = useCallback(() => {
    setPhase('idle')
    setResult(null)
    setError(null)
    setTxHash(null)
    setTaskId(null)
  }, [])

  const submitTask = useCallback(
    async (taskType: TaskType, input: string) => {
      if (!userAddress) {
        setError('Wallet not connected')
        return
      }
      if (!escrowAddress || escrowAddress === '0x') {
        setError('Escrow contract not deployed yet')
        return
      }

      setPhase('idle')
      setError(null)
      setResult(null)

      const price = TASK_PRICES_CUSD[taskType]
      const newTaskId = generateTaskId(userAddress, taskType)
      setTaskId(newTaskId)

      try {
        // ── Phase 1: Check balance & allowance ────────────────────────────────
        setPhase('checking_allowance')

        const { createPublicClient, http } = await import('viem')
        const { celo, celoAlfajores } = await import('viem/chains')
        const chain = chainId === 42220 ? celo : celoAlfajores
        const publicClient = createPublicClient({
          chain,
          transport: http(
            chainId === 42220
              ? 'https://forno.celo.org'
              : 'https://alfajores-forno.celo-testnet.org'
          ),
        })

        // Check balance before proceeding
        const balance = await publicClient.readContract({
          address: cusdAddress,
          abi:     CUSD_ABI,
          functionName: 'balanceOf',
          args:    [userAddress],
        })
        if (balance < price) {
          const needed = (Number(price) / 1e18).toFixed(3)
          const have = (Number(balance) / 1e18).toFixed(3)
          throw new Error(
            `Insufficient cUSD balance. Need ${needed} cUSD but you have ${have} cUSD.`
          )
        }

        const allowance = await publicClient.readContract({
          address: cusdAddress,
          abi:     CUSD_ABI,
          functionName: 'allowance',
          args:    [userAddress, escrowAddress],
        })

        // ── Phase 2: Approve if needed ────────────────────────────────────────
        if (allowance < price) {
          setPhase('approving')
          // Approve 10x the price to batch future tasks and save gas
          const approveAmount = price * 10n
          const approveTx = await writeApprove({
            address:      cusdAddress,
            abi:          CUSD_ABI,
            functionName: 'approve',
            args:         [escrowAddress, approveAmount],
          })
          setTxHash(approveTx)
          setPhase('awaiting_approval')

          // Wait for approval confirmation
          await publicClient.waitForTransactionReceipt({ hash: approveTx })
        }

        // ── Phase 3: Deposit ──────────────────────────────────────────────────
        setPhase('depositing')
        const depositTx = await writeDeposit({
          address:      escrowAddress,
          abi:          TASK_ESCROW_ABI,
          functionName: 'deposit',
          args:         [newTaskId, price],
        })
        setTxHash(depositTx)
        setPhase('awaiting_deposit')

        await publicClient.waitForTransactionReceipt({ hash: depositTx })

        // ── Phase 4: Submit to backend for processing ─────────────────────────
        setPhase('processing')
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskId:      newTaskId,
            taskType,
            input,
            userAddress,
            txHash:      depositTx,
            chainId,
          }),
        })

        const json = await res.json() as {
          status:  'complete' | 'failed'
          result?: TaskResult
          error?:  string
        }

        if (json.status === 'complete' && json.result) {
          setResult(json.result)
          setPhase('complete')
          saveToHistory(
            {
              taskId:     newTaskId,
              taskType,
              input,
              status:     'complete',
              result:     json.result,
              amountPaid: (Number(price) / 1e18).toFixed(4),
              txHash:     depositTx,
              timestamp:  Date.now(),
            },
            userAddress
          )
        } else {
          const errMsg = json.error || 'Task processing failed'
          setError(errMsg)
          setPhase('failed')
          saveToHistory(
            {
              taskId:     newTaskId,
              taskType,
              input,
              status:     'failed',
              result:     null,
              amountPaid: '0',
              txHash:     depositTx,
              timestamp:  Date.now(),
            },
            userAddress
          )
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg)
        setPhase('failed')
      }
    },
    [userAddress, escrowAddress, cusdAddress, chainId, writeApprove, writeDeposit]
  )

  return {
    phase,
    result,
    error,
    txHash,
    taskId,
    submitTask,
    reset,
  }
}
