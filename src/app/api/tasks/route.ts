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

// Safety check: warn if operator key looks like a dev/test key that was committed
if (OPERATOR_KEY && typeof OPERATOR_KEY === 'string' && OPERATOR_KEY.length === 66) {
  // Log at startup (not per-request) to remind about key security
  console.warn(
    '[tasks] SECURITY: Ensure OPERATOR_PRIVATE_KEY is loaded from a secure secret manager ' +
    'in production, not from a file on disk.'
  )
}

// ── Rate limiter (in-memory, per-user) ────────────────────────────────────────
// Limits each user address to MAX_REQUESTS_PER_WINDOW within WINDOW_MS
const RATE_LIMIT_WINDOW_MS  = 60_000   // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 5      // max 5 tasks per minute per user
const rateLimitMap = new Map<string, { count: number; windowStart: number }>()

function checkRateLimit(userAddress: string): boolean {
  const key = userAddress.toLowerCase()
  const now = Date.now()
  const entry = rateLimitMap.get(key)

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(key, { count: 1, windowStart: now })
    return true
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false
  }

  entry.count++
  return true
}

// Periodically clean up stale entries to prevent memory leaks
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitMap) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitMap.delete(key)
    }
  }
}, RATE_LIMIT_WINDOW_MS * 2)

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

  // Validate hex format to prevent injection into contract calls
  if (!/^0x[a-fA-F0-9]{64}$/.test(taskId)) {
    return NextResponse.json({ status: 'failed', error: 'Invalid taskId format' }, { status: 400 })
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
    return NextResponse.json({ status: 'failed', error: 'Invalid address format' }, { status: 400 })
  }

  // Validate taskType is a known enum value
  const VALID_TASK_TYPES: TaskType[] = [
    'WEB_SEARCH', 'WEB_SCRAPE', 'AI_ANSWER', 'PEOPLE_LOOKUP', 'SOCIAL_MEDIA', 'EMAIL_VERIFY'
  ]
  if (!VALID_TASK_TYPES.includes(taskType)) {
    return NextResponse.json({ status: 'failed', error: `Invalid task type: ${taskType}` }, { status: 400 })
  }

  // Validate input length (prevent abuse)
  if (input.length > 2000) {
    return NextResponse.json({ status: 'failed', error: 'Input too long (max 2000 chars)' }, { status: 400 })
  }

  // Rate limit per user address
  if (!checkRateLimit(userAddress)) {
    return NextResponse.json(
      { status: 'failed', error: 'Too many requests. Please wait a minute before trying again.' },
      { status: 429 }
    )
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
    const rawMsg = err instanceof Error ? err.message : String(err)
    console.error('[tasks] task processing failed:', rawMsg)

    // Sanitize error: don't leak internal API URLs, status codes, or stack traces
    const safeMsg = sanitizeErrorForClient(rawMsg)

    // Task failed — refund user
    await refundEscrow({
      walletClient,
      publicClient,
      escrowAddress,
      taskId: taskId as `0x${string}`,
    })

    return NextResponse.json({ status: 'failed', error: safeMsg })
  }
}

/**
 * Strip internal details from error messages before sending to the client.
 * Keeps user-actionable messages (validation errors, "no person found", etc.)
 * but strips API URLs, HTTP status codes, and raw server responses.
 */
function sanitizeErrorForClient(msg: string): string {
  // Known user-facing error patterns — pass through
  const userFacingPatterns = [
    /^Insufficient cUSD/,
    /^No person found/,
    /^Unknown platform/,
    /^Invalid URL/,
    /^Only http/,
    /^Scraping internal/,
    /^Input too long/,
    /timed out/i,
  ]
  for (const pat of userFacingPatterns) {
    if (pat.test(msg)) return msg
  }

  // Strip internal API details (stableenrich, stablesocial, x402, etc.)
  if (/stableenrich|stablesocial|x402|agentcash/i.test(msg)) {
    return 'Task processing failed. Your deposit has been refunded.'
  }

  // Generic fallback — don't expose raw errors
  if (msg.length > 120) {
    return 'Task processing failed. Your deposit has been refunded.'
  }

  return msg
}
