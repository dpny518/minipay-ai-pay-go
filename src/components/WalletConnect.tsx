'use client'

import { Loader2, AlertTriangle, Zap, ExternalLink } from 'lucide-react'
import { useMiniPay } from '@/hooks/useMiniPay'
import { CHAIN_IDS } from '@/lib/contracts'

export function WalletConnect() {
  const {
    address,
    isConnected,
    isConnecting,
    isMiniPayEnv,
    isWrongChain,
    targetChainId,
    cusdBalance,
    connectError,
    switchToTarget,
  } = useMiniPay()

  const networkName = targetChainId === CHAIN_IDS.MAINNET ? 'Celo' : 'Alfajores'

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800">
      {/* Brand */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-[#FCFF52] flex items-center justify-center">
          <Zap className="w-4 h-4 text-black" strokeWidth={2.5} />
        </div>
        <span className="text-sm font-semibold text-white">MiniPay AI</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
          {networkName}
        </span>
      </div>

      {/* Wallet state — no connect button, auto-connects */}
      <div className="flex items-center gap-2">
        {isWrongChain ? (
          <button
            onClick={switchToTarget}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/30 active:opacity-70"
          >
            <AlertTriangle className="w-3 h-3" />
            Switch to {networkName}
          </button>
        ) : isConnected && address ? (
          <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300">
            <div className="w-1.5 h-1.5 rounded-full bg-[#35D07F]" />
            <span className="font-mono">
              {address.slice(0, 6)}…{address.slice(-4)}
            </span>
            {cusdBalance && (
              <span className="text-[#35D07F] font-semibold">
                ${parseFloat(cusdBalance.formatted).toFixed(2)}
              </span>
            )}
          </div>
        ) : isConnecting ? (
          <div className="text-xs text-zinc-500 flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" />
            Connecting
          </div>
        ) : connectError ? (
          <div className="text-xs text-red-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3" />
            Open in MiniPay
          </div>
        ) : !isMiniPayEnv ? (
          <a
            href="https://link.minipay.xyz/discover"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 border border-zinc-700"
          >
            Open in MiniPay
            <ExternalLink className="w-3 h-3" />
          </a>
        ) : (
          <div className="text-xs text-zinc-500 flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" />
            Connecting
          </div>
        )}
      </div>
    </div>
  )
}
