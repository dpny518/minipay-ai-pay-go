'use client'

import { useChainId } from 'wagmi'
import { WalletConnect } from '@/components/WalletConnect'
import { TaskForm } from '@/components/TaskForm'
import { TaskResultCard } from '@/components/TaskResult'
import { TaskHistory } from '@/components/TaskHistory'
import { useMiniPay } from '@/hooks/useMiniPay'
import { useTaskEscrow } from '@/hooks/useTaskEscrow'

export default function Home() {
  const { address, isConnected } = useMiniPay()
  const chainId = useChainId()

  const {
    phase,
    result,
    error,
    txHash,
    submitTask,
    reset,
  } = useTaskEscrow(address)

  return (
    <div className="min-h-screen bg-[#0a0a0a] max-w-md mx-auto flex flex-col">
      {/* Header */}
      <WalletConnect />

      {/* Hero — shown when idle and no wallet */}
      {!isConnected && phase === 'idle' && (
        <div className="px-6 py-10 text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-[#FCFF52]/10 border border-[#FCFF52]/20 flex items-center justify-center mx-auto text-3xl">
            🤖
          </div>
          <h1 className="text-2xl font-bold text-white">
            AI Tools,<br />
            <span className="text-[#FCFF52]">Pay-Per-Use</span>
          </h1>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Access powerful AI & data tools for{' '}
            <span className="text-white font-medium">micro-cents in cUSD</span>.
            No subscriptions. Pay only for real results.
          </p>
          <div className="flex justify-center gap-4 pt-2">
            {['🔍 Search', '🌐 Scrape', '🤖 AI Q&A', '👤 Enrich'].map((item) => (
              <span key={item} className="text-xs text-zinc-500">{item}</span>
            ))}
          </div>
        </div>
      )}

      {/* Task form */}
      <div className={isConnected || phase !== 'idle' ? 'mt-2' : ''}>
        <TaskForm
          isConnected={isConnected}
          phase={phase}
          onSubmit={submitTask}
          onReset={reset}
        />
      </div>

      {/* Error */}
      {error && phase === 'failed' && (
        <div className="mx-4 mt-1 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
          <p className="text-xs text-red-400 font-medium">Task failed</p>
          <p className="text-xs text-red-300/80 mt-0.5 break-words">{error}</p>
          {txHash && (
            <p className="text-[10px] text-zinc-600 mt-1 break-all">
              Tx: {txHash} — your cUSD has been refunded.
            </p>
          )}
        </div>
      )}

      {/* Result */}
      {result && (phase === 'complete') && (
        <TaskResultCard
          result={result}
          txHash={txHash}
          chainId={chainId}
          phase={phase}
        />
      )}

      {/* Divider */}
      <div className="flex-1" />

      {/* Task history */}
      {isConnected && (
        <TaskHistory userAddress={address} chainId={chainId} />
      )}

      {/* Footer */}
      <div className="px-4 py-3 border-t border-zinc-900 flex items-center justify-between">
        <p className="text-[10px] text-zinc-700">
          Powered by Celo · AgentCash · MiniPay
        </p>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-[#35D07F]" />
          <span className="text-[10px] text-zinc-700">Live</span>
        </div>
      </div>
    </div>
  )
}
