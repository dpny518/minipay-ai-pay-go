/**
 * x402 + SIWX payment client
 *
 * Implements:
 *   - x402 EIP-3009 transferWithAuthorization (USDC on Base)
 *   - SIWX (Sign-In With X) for SIWX-authenticated polling endpoints
 *
 * Used exclusively in Next.js API routes (server-side). Never imported by frontend.
 */

import { createWalletClient, http, type Hex } from 'viem'
import { base } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

// ─── USDC on Base (for x402 micropayments) ────────────────────────────────────
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const
const BASE_RPC  = 'https://mainnet.base.org'

// ─── EIP-3009 typed data ──────────────────────────────────────────────────────
const TRANSFER_WITH_AUTH_TYPES = {
  TransferWithAuthorization: [
    { name: 'from',        type: 'address' },
    { name: 'to',          type: 'address' },
    { name: 'value',       type: 'uint256' },
    { name: 'validAfter',  type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce',       type: 'bytes32' },
  ],
} as const

interface PaymentOption {
  scheme:   string
  network:  string
  payTo:    string
  amount:   string
  asset?:   string
}

interface PaymentRequirements {
  accepts: PaymentOption[]
}

function randomNonce(): Hex {
  const bytes = new Uint8Array(32)
  if (typeof crypto !== 'undefined') {
    crypto.getRandomValues(bytes)
  } else {
    // Node.js fallback
    const { randomBytes } = require('crypto')
    const rb = randomBytes(32)
    rb.copy(Buffer.from(bytes.buffer))
  }
  return ('0x' + Buffer.from(bytes).toString('hex')) as Hex
}

/**
 * Sign an EIP-3009 transferWithAuthorization for USDC on Base.
 */
async function signX402Payment(
  privateKey: Hex,
  payTo: string,
  amount: string
): Promise<string> {
  const account = privateKeyToAccount(privateKey)
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(BASE_RPC),
  })

  const validBefore = BigInt(Math.floor(Date.now() / 1000) + 300) // valid for 5 min
  const nonce = randomNonce()

  const signature = await walletClient.signTypedData({
    domain: {
      name:              'USD Coin',
      version:           '2',
      chainId:           8453,
      verifyingContract: USDC_BASE,
    },
    types:       TRANSFER_WITH_AUTH_TYPES,
    primaryType: 'TransferWithAuthorization',
    message: {
      from:        account.address,
      to:          payTo as Hex,
      value:       BigInt(amount),
      validAfter:  0n,
      validBefore,
      nonce,
    },
  })

  const payload = {
    x402Version: 1,
    scheme:      'exact',
    network:     'base-mainnet',
    payload: {
      authorization: {
        from:        account.address,
        to:          payTo,
        value:       amount,
        validAfter:  '0',
        validBefore: validBefore.toString(),
        nonce,
      },
      signature,
    },
  }

  return Buffer.from(JSON.stringify(payload)).toString('base64')
}

/**
 * Make an x402-aware HTTP request. Automatically handles payment on 402.
 */
export async function x402Fetch(
  url: string,
  options: RequestInit,
  privateKey: Hex
): Promise<Response> {
  // First attempt — no payment header
  const first = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers || {}),
    },
  })

  if (first.status !== 402) return first

  // Parse payment requirements from 402 body
  let payReqs: PaymentRequirements
  try {
    payReqs = await first.json()
  } catch {
    throw new Error('x402: could not parse payment requirements from 402 response')
  }

  // Find a Base mainnet payment option
  const payOpt = payReqs.accepts?.find(
    (a) => a.network === 'base-mainnet' || a.network === 'eip155:8453'
  )
  if (!payOpt) {
    throw new Error(`x402: no supported network in payment options: ${JSON.stringify(payReqs.accepts)}`)
  }

  // Sign and build the payment header
  const xPayment = await signX402Payment(privateKey, payOpt.payTo, payOpt.amount)

  // Retry with payment
  const second = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers || {}),
      'X-PAYMENT': xPayment,
      'Access-Control-Expose-Headers': 'X-PAYMENT-RESPONSE',
    },
  })

  return second
}

// ─── SIWX ────────────────────────────────────────────────────────────────────

/**
 * Build a SIWE message string (EIP-4361).
 */
function buildSiweMessage(params: {
  domain:   string
  address:  string
  uri:      string
  chainId:  number
  nonce:    string
  issuedAt: string
}): string {
  return (
    `${params.domain} wants you to sign in with your Ethereum account:\n` +
    `${params.address}\n\n` +
    `URI: ${params.uri}\n` +
    `Version: 1\n` +
    `Chain ID: ${params.chainId}\n` +
    `Nonce: ${params.nonce}\n` +
    `Issued At: ${params.issuedAt}`
  )
}

/**
 * Create an Authorization header value for SIWX-protected endpoints.
 */
export async function buildSiwxAuth(
  privateKey: Hex,
  domain: string,
  uri?: string
): Promise<string> {
  const account = privateKeyToAccount(privateKey)
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(BASE_RPC),
  })

  // Random 8-char nonce
  const nonceBytes = new Uint8Array(4)
  crypto.getRandomValues(nonceBytes)
  const nonce = Buffer.from(nonceBytes).toString('hex')

  const issuedAt = new Date().toISOString()
  const resolvedUri = uri || `https://${domain}`

  const message = buildSiweMessage({
    domain,
    address:  account.address,
    uri:      resolvedUri,
    chainId:  8453,
    nonce,
    issuedAt,
  })

  const signature = await walletClient.signMessage({ message })

  // Encode as Bearer token — format accepted by stablesocial.dev SIWX endpoints
  const token = Buffer.from(
    JSON.stringify({ message, signature })
  ).toString('base64')

  return `Bearer ${token}`
}

/**
 * Make a SIWX-authenticated GET request (used for polling stablesocial /api/jobs).
 */
export async function siwxFetch(
  url: string,
  privateKey: Hex,
  domain: string
): Promise<Response> {
  const authorization = await buildSiwxAuth(privateKey, domain)
  return fetch(url, {
    headers: {
      Authorization: authorization,
      Accept: 'application/json',
    },
  })
}
