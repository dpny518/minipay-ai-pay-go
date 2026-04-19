'use client'

import { useEffect } from 'react'
import {
  useAccount,
  useConnect,
  useDisconnect,
  useChainId,
  useSwitchChain,
  useBalance,
} from 'wagmi'
import { injected } from 'wagmi/connectors'
import { CHAIN_IDS, CUSD_ADDRESSES } from '@/lib/contracts'

const TARGET_CHAIN = (
  Number(process.env.NEXT_PUBLIC_CHAIN_ID || CHAIN_IDS.TESTNET)
) as 42220 | 44787

export function useMiniPay() {
  const { address, isConnected, status } = useAccount()
  const { connect, isPending: isConnecting } = useConnect()
  const { disconnect } = useDisconnect()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()

  // Detect MiniPay environment
  const isMiniPayEnv =
    typeof window !== 'undefined' && !!(window as any).ethereum?.isMiniPay

  // Auto-connect inside MiniPay
  useEffect(() => {
    if (isMiniPayEnv && !isConnected && status === 'disconnected') {
      connect({ connector: injected() })
    }
  }, [isMiniPayEnv, isConnected, status, connect])

  // Auto switch to correct chain if needed
  useEffect(() => {
    if (isConnected && chainId !== TARGET_CHAIN) {
      switchChain({ chainId: TARGET_CHAIN })
    }
  }, [isConnected, chainId, switchChain])

  // cUSD balance
  const cusdAddress = CUSD_ADDRESSES[chainId] || CUSD_ADDRESSES[TARGET_CHAIN]
  const { data: cusdBalance, refetch: refetchBalance } = useBalance({
    address,
    token: cusdAddress,
  })

  const isWrongChain = isConnected && chainId !== TARGET_CHAIN

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
    refetchBalance,
    connect: () => connect({ connector: injected() }),
    disconnect,
    switchToTarget: () => switchChain({ chainId: TARGET_CHAIN }),
  }
}
