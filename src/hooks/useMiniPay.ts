'use client'

import { useEffect, useState } from 'react'
import { useConnect, useConnectors, useAccount, useChainId, useSwitchChain, useBalance } from 'wagmi'
import { CHAIN_IDS, CUSD_ADDRESSES } from '@/lib/contracts'

const TARGET_CHAIN = (
  Number(process.env.NEXT_PUBLIC_CHAIN_ID || CHAIN_IDS.MAINNET)
) as 42220 | 44787

export function useMiniPay() {
  const connectors = useConnectors()
  const { connect, error: connectError } = useConnect()
  const { address, isConnected, status } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const [hasAttempted, setHasAttempted] = useState(false)

  const isMiniPayEnv =
    typeof window !== 'undefined' && !!(window as any).ethereum?.isMiniPay

  // Always auto-connect on mount — never show a connect button per MiniPay docs
  useEffect(() => {
    if (hasAttempted || connectors.length === 0 || isConnected) return
    const attemptConnect = async () => {
      try {
        await connect({ connector: connectors[0] })
      } catch (err) {
        console.error('[MiniPay] auto-connect failed:', err)
      }
      setHasAttempted(true)
    }
    attemptConnect()
  }, [connectors, connect, hasAttempted, isConnected])

  // Auto switch to correct chain
  useEffect(() => {
    if (isConnected && chainId !== TARGET_CHAIN) {
      switchChain({ chainId: TARGET_CHAIN })
    }
  }, [isConnected, chainId, switchChain])

  const cusdAddress = CUSD_ADDRESSES[chainId] || CUSD_ADDRESSES[TARGET_CHAIN]
  const { data: cusdBalance, refetch: refetchBalance } = useBalance({
    address,
    token: cusdAddress,
  })

  const isWrongChain = isConnected && chainId !== TARGET_CHAIN
  const isConnecting = status === 'connecting' || status === 'reconnecting'

  return {
    address,
    isConnected,
    isConnecting,
    isMiniPayEnv,
    isWrongChain,
    chainId,
    targetChainId: TARGET_CHAIN,
    cusdBalance,
    cusdAddress,
    connectError,
    refetchBalance,
    switchToTarget: () => switchChain({ chainId: TARGET_CHAIN }),
  }
}
