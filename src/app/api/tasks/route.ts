export const runtime = 'edge'

/**
 * POST /api/tasks
 *
 * Operator-side task processor. Called by the frontend AFTER the user has
 * confirmed the cUSD deposit transaction on-chain.
 *
 * Flow:
 *   1. Verify the on-chain deposit (task.status === DEPOSITED, user matches, amount ≥ min)
 *   2. Call AgentCash API (stableenrich.dev / stablesocial.dev) using x402 payment
 *   3a. Success → call escrow.release(taskId) as operator → return result
 *   3b. Failure → call escrow.refund(taskId) as operator  → return error
 */

import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, createWalletClient, http, type Hex } from 'viem'
import { celo, celoAlfajores } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { routeTask } from '@/lib/agentcash'
import { checkAndTopUp } from '@/lib/topup'
import { TASK_ESCROW_ABI, TASK_PRICES_CUSD, ESCROW_ADDRESSES, type TaskType } from '@/lib/contracts'

const OPERATOR_KEY     = process.env.OPERATOR_PRIVATE_KEY as Hex
const CHAIN_ID_MAINNET = 42220

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

function getClients(chainId: number) {
  const chain  = chainId === CHAIN_ID_MAINNET ? celo : celoAlfajores
  const rpcUrl = chainId === CHAIN_ID_MAINNET
    ? 'https://forno.celo.org'
    : 'https://alfajores-forno.celo-testnet.org'

  const account = privateKeyToAccount(OPERATOR_KEY)

  const publicClient: AnyClient = createPublicClient({ chain, transport: http(rpcUrl) })
  const walletClient: AnyClient = createWalletClient({ account, chain, transport: http(rpcUrl) })

  return { publicClient, walletClient, account }
}

async function verifyDeposit(params: {
  publicClient: AnyClient
  escrowAddress: `0x${string}`
  taskId: `0x${string}`
  userAddress: `0x${string}`
  taskType: TaskType
}): Promise<void> {
  const task = await params.publicClient.readContract({
    address:      params.escrowAddress,
    abi:          TASK_ESCROW_ABI,
    functionName: 'getTask',
    args:         [params.taskId],
  }) as { user: string; amount: bigint; depositedAt: bigint; status: number }

  const STATUS_DEPOSITED = 1

  if (task.status !== STATUS_DEPOSITED) {
    throw new Error(`Task not in DEPOSITED state (status=${task.status})`)
  }
  if (task.user.toLowerCase() !== params.userAddress.toLowerCase()) {
    throw new Error('Task user mismatch — possible replay attack')
  }

  const minPrice = TASK_PRICES_CUSD[params.taskType]
  if (task.amount < minPrice) {
    throw new Error(
      `Deposit amount ${task.amount} < required ${minPrice} for ${params.taskType}`
    )
  }
}

async function releaseEscrow(params: {
  walletClient: AnyClient
  publicClient: AnyClient
  escrowAddress: `0x${string}`
  taskId: `0x${string}`
}): Promise<string> {
  const hash: `0x${string}` = await params.walletClient.writeContract({
    address:      params.escrowAddress,
    abi:          TASK_ESCROW_ABI,
    functionName: 'release',
    args:         [params.taskId],
    chain:        null,
  })
  await params.publicClient.waitForTransactionReceipt({ hash })
  return hash
}

async function refundEscrow(params: {
  walletClient: AnyClient
  publicClient: AnyClient
  escrowAddress: `0x${string}`
  taskId: `0x${string}`
}): Promise<void> {
  try {
    const hash: `0x${string}` = await params.walletClient.writeContract({
      address:      params.escrowAddress,
      abi:          TASK_ESCROW_ABI,
      functionName: 'refund',
      args:         [params.taskId],
      chain:        null,
    })
    await params.publicClient.waitForTransactionReceipt({ hash })
  } catch (err) {
    // Log but don't rethrow — user still gets the task error
    console.error('[tasks] refund tx failed:', err)
  }
}

export async function POST(req: NextRequest) {
  // ── Validate env ──────────────────────────────────────────────────────────
  if (!OPERATOR_KEY || OPERATOR_KEY.length < 10) {
    console.error('[tasks] OPERATOR_PRIVATE_KEY not set')
    return NextResponse.json(
      { status: 'failed', error: 'Server configuration error' },
      { status: 500 }
    )
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: {
    taskId:      string
    taskType:    TaskType
    input:       string
    userAddress: string
    txHash:      string
    chainId:     number
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ status: 'failed', error: 'Invalid JSON body' }, { status: 400 })
  }

  const { taskId, taskType, input, userAddress, chainId } = body

  if (!taskId || !taskType || !input || !userAddress || !chainId) {
    return NextResponse.json({ status: 'failed', error: 'Missing required fields' }, { status: 400 })
  }

  const escrowAddress = ESCROW_ADDRESSES[chainId]
  if (!escrowAddress || escrowAddress === '0x') {
    return NextResponse.json(
      { status: 'failed', error: `Escrow not deployed on chainId=${chainId}` },
      { status: 400 }
    )
  }

  const { publicClient, walletClient } = getClients(chainId)

  // ── Verify on-chain deposit ───────────────────────────────────────────────
  try {
    await verifyDeposit({
      publicClient,
      escrowAddress,
      taskId:      taskId as `0x${string}`,
      userAddress: userAddress as `0x${string}`,
      taskType,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[tasks] deposit verification failed:', msg)
    return NextResponse.json({ status: 'failed', error: `Deposit verification: ${msg}` }, { status: 400 })
  }

  // ── Call AgentCash API ────────────────────────────────────────────────────
  try {
    // Auto top-up if AgentCash balance is low (non-blocking on failure)
    await checkAndTopUp(OPERATOR_KEY).catch((e) =>
      console.warn('[tasks] topup skipped:', e?.message)
    )

    const result = await routeTask(taskType, input)

    // Task succeeded — release escrow to treasury
    await releaseEscrow({
      walletClient,
      publicClient,
      escrowAddress,
      taskId: taskId as `0x${string}`,
    })

    return NextResponse.json({ status: 'complete', result })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[tasks] task processing failed:', msg)

    // Task failed — refund user
    await refundEscrow({
      walletClient,
      publicClient,
      escrowAddress,
      taskId: taskId as `0x${string}`,
    })

    return NextResponse.json({ status: 'failed', error: msg })
  }
}
