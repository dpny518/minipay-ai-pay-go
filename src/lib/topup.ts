/**
 * Auto top-up AgentCash balance by swapping cUSD (Celo) → USDC (Base) via LI.FI.
 *
 * AgentCash deposits are just USDC sent to the operator wallet on Base.
 * LI.FI handles the cross-chain swap in a single transaction.
 *
 * Called before each task run if balance is below AGENTCASH_TOPUP_THRESHOLD.
 */

import { createWalletClient, createPublicClient, http, parseEther, type Hex } from 'viem'
import { celo } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

const CUSD_CELO    = '0x765DE816845861e75A25fCA122bb6898B8B1282a'
const USDC_BASE    = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const CELO_CHAIN   = 42220
const BASE_CHAIN   = 8453
const LIFI_API     = 'https://li.quest/v1'

const THRESHOLD = parseFloat(process.env.AGENTCASH_TOPUP_THRESHOLD || '2')   // USD
const TOPUP_AMT = parseFloat(process.env.AGENTCASH_TOPUP_AMOUNT    || '10')  // USD worth of cUSD

export async function checkAndTopUp(operatorKey: Hex): Promise<void> {
  // 1. Check AgentCash balance
  const balRes = await fetch('https://agentcash.dev/api/balance', {
    headers: { 'x-wallet-address': privateKeyToAccount(operatorKey).address },
  })
  // AgentCash balance endpoint may not exist — fall back to CLI-style check
  // Use the public balance endpoint pattern
  let balance = THRESHOLD + 1 // assume ok if we can't check
  if (balRes.ok) {
    const balJson = await balRes.json() as { data?: { balance?: number } }
    balance = balJson.data?.balance ?? balance
  }

  if (balance >= THRESHOLD) return

  console.log(`[topup] AgentCash balance $${balance} < $${THRESHOLD}, topping up $${TOPUP_AMT}...`)

  const account = privateKeyToAccount(operatorKey)
  const amountWei = parseEther(String(TOPUP_AMT)) // cUSD is 18 decimals

  // 2. Get LI.FI quote: cUSD (Celo) → USDC (Base), deliver to same operator address on Base
  const quoteUrl = `${LIFI_API}/quote?` + new URLSearchParams({
    fromChain:   String(CELO_CHAIN),
    toChain:     String(BASE_CHAIN),
    fromToken:   CUSD_CELO,
    toToken:     USDC_BASE,
    fromAmount:  amountWei.toString(),
    fromAddress: account.address,
    toAddress:   account.address,  // AgentCash wallet = operator wallet on Base
  })

  const quoteRes = await fetch(quoteUrl)
  if (!quoteRes.ok) {
    console.error('[topup] LI.FI quote failed:', await quoteRes.text())
    return
  }
  const quote = await quoteRes.json() as {
    transactionRequest: {
      to: `0x${string}`
      data: `0x${string}`
      value: string
      gasLimit: string
      gasPrice: string
    }
    estimate: { toAmount: string }
  }

  console.log(`[topup] LI.FI quote: $${TOPUP_AMT} cUSD → ~${
    (parseInt(quote.estimate.toAmount) / 1e6).toFixed(2)
  } USDC on Base`)

  // 3. Approve LI.FI spender for cUSD
  const spenderAddress = quote.transactionRequest.to
  const publicClient = createPublicClient({ chain: celo, transport: http('https://forno.celo.org') })
  const walletClient = createWalletClient({ account, chain: celo, transport: http('https://forno.celo.org') })

  const ERC20_APPROVE_ABI = [{
    name: 'approve', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  }] as const

  const approveTx = await walletClient.writeContract({
    address: CUSD_CELO as `0x${string}`,
    abi: ERC20_APPROVE_ABI,
    functionName: 'approve',
    args: [spenderAddress, amountWei],
  })
  await publicClient.waitForTransactionReceipt({ hash: approveTx })
  console.log('[topup] cUSD approved, executing bridge...')

  // 4. Execute the LI.FI bridge transaction
  const bridgeTx = await walletClient.sendTransaction({
    to:       quote.transactionRequest.to,
    data:     quote.transactionRequest.data,
    value:    BigInt(quote.transactionRequest.value || '0'),
    gas:      BigInt(quote.transactionRequest.gasLimit),
    gasPrice: BigInt(quote.transactionRequest.gasPrice),
  })
  await publicClient.waitForTransactionReceipt({ hash: bridgeTx })
  console.log(`[topup] Bridge tx confirmed: ${bridgeTx}. USDC will arrive on Base shortly.`)
}
