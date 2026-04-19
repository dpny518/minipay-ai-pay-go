'use client'

import { useMiniPay } from '@/hooks/useMiniPay'
import { CHAIN_IDS } from '@/lib/contracts'

export function WalletConnect() {
  const {
    address,
    isConnected,
    isConnecting,
    isMiniPayEnv,
    isWrongChain,
    chainId,
    targetChainId,
    cusdBalance,
    connect,
    disconnect,
    switchToTarget,
  } = useMiniPay()

  const networkName = targetChainId === CHAIN_IDS.MAINNET ? 'Celo' : 'Alfajores'

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800">
      {/* Brand */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-[#FCFF52] flex items-center justify-center text-black text-xs font-black">
          AI
        </div>
        <span className="text-sm font-semibold text-white">MiniPay AI</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
          {networkName}
        </span>
      </div>

      {/* Wallet state */}
      <div className="flex items-center gap-2">
        {isWrongChain ? (
          <button
            onClick={switchToTarget}
            className="text-xs px-3 py-1.5 rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/30 active:opacity-70"
          >
            Switch to {networkName}
          </button>
        ) : isConnected && address ? (
          <button
            onClick={() => disconnect()}
            className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 active:bg-zinc-700"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-[#35D07F]" />
            <span className="font-mono">
              {address.slice(0, 6)}…{address.slice(-4)}
            </span>
            {cusdBalance && (
              <span className="text-[#35D07F] font-semibold">
                ${parseFloat(cusdBalance.formatted).toFixed(2)}
              </span>
            )}
          </button>
        ) : isConnecting ? (
          <div className="text-xs text-zinc-500 flex items-center gap-1.5">
            <div className="w-3 h-3 border border-zinc-500 border-t-white rounded-full animate-spin" />
            Connecting…
          </div>
        ) : (
          <button
            onClick={connect}
            className="text-xs px-3 py-1.5 rounded-lg bg-[#FCFF52] text-black font-semibold active:opacity-80"
          >
            {isMiniPayEnv ? 'Connect MiniPay' : 'Connect Wallet'}
          </button>
        )}
      </div>
    </div>
  )
}
