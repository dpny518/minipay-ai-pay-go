'use client'

import { useChainId } from 'wagmi'
import { Zap, Search, Globe, Bot, User, AlertCircle } from 'lucide-react'
import { WalletConnect } from '@/components/WalletConnect'
import { TaskForm } from '@/components/TaskForm'
import { TaskResultCard } from '@/components/TaskResult'
import { TaskHistory } from '@/components/TaskHistory'
import { useMiniPay } from '@/hooks/useMiniPay'
import { useTaskEscrow } from '@/hooks/useTaskEscrow'

const FEATURE_PILLS = [
  { icon: Search, label: 'Web Search' },
  { icon: Globe,  label: 'Scrape' },
  { icon: Bot,    label: 'AI Q&A' },
  { icon: User,   label: 'Enrich' },
]

const ADD_CASH_URL = 'https://link.minipay.xyz/add_cash?tokens=USDM'

export default function Home() {
  const { address, isConnected, isMiniPayEnv, cusdBalance } = useMiniPay()
  const chainId = useChainId()

  const { phase, result, error, txHash, submitTask, reset } = useTaskEscrow(address)

  // Low balance: less than $0.10 cUSD
  const isLowBalance = isConnected && cusdBalance &&
    parseFloat(cusdBalance.formatted) < 0.10

  return (
    <div className="min-h-screen bg-[#0a0a0a] max-w-md mx-auto flex flex-col">
      <WalletConnect />

      {/* Not in MiniPay — show info screen */}
      {!isMiniPayEnv && !isConnected && (
        <div className="px-6 py-10 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#FCFF52]/10 border border-[#FCFF52]/20 flex items-center justify-center mx-auto">
            <Zap className="w-7 h-7 text-[#FCFF52]" strokeWidth={1.75} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white leading-tight">
              AI Tools,{' '}
              <span className="text-[#FCFF52]">Pay-Per-Use</span>
            </h1>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Access powerful AI and data tools for{' '}
              <span className="text-white font-medium">micro-cents in cUSD</span>{' '}
              via MiniPay. No subscriptions.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            {FEATURE_PILLS.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800">
                <Icon className="w-3 h-3 text-zinc-500" strokeWidth={1.75} />
                <span className="text-[11px] text-zinc-500">{label}</span>
              </div>
            ))}
          </div>
          <a
            href="https://link.minipay.xyz/discover"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-2 px-5 py-3 rounded-xl text-white text-sm font-semibold"
            style={{ backgroundColor: '#07955F' }}
          >
            {/* MiniPay airplane icon */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 3L3 10.5l6.75 2.25L12 21l2.25-6.75L21 3z"/>
            </svg>
            Open in MiniPay
          </a>
        </div>
      )}

      {/* Low balance warning with Add Cash deeplink */}
      {isLowBalance && phase === 'idle' && (
        <div className="mx-4 mt-3 p-3 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-between">
          <p className="text-xs text-orange-400">Low balance — add cUSD to continue</p>
          <a
            href={ADD_CASH_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-2.5 py-1 rounded-lg text-white font-medium flex-shrink-0 ml-2"
            style={{ backgroundColor: '#07955F' }}
          >
            Add Cash
          </a>
        </div>
      )}

      <div className={isConnected || phase !== 'idle' ? 'mt-2' : ''}>
        <TaskForm
          isConnected={isConnected}
          phase={phase}
          onSubmit={submitTask}
          onReset={reset}
        />
      </div>

      {error && phase === 'failed' && (
        <div className="mx-4 mt-1 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
            <p className="text-xs text-red-400 font-medium">Task failed</p>
          </div>
          <p className="text-xs text-red-300/80 break-words">{error}</p>
          {txHash && (
            <p className="text-[10px] text-zinc-600 mt-1 break-all">
              Tx: {txHash} — your cUSD has been refunded.
            </p>
          )}
        </div>
      )}

      {result && phase === 'complete' && (
        <TaskResultCard result={result} txHash={txHash} chainId={chainId} phase={phase} />
      )}

      <div className="flex-1" />

      {isConnected && (
        <TaskHistory userAddress={address} chainId={chainId} />
      )}

      <div className="px-4 py-3 border-t border-zinc-900 flex items-center justify-between">
        <p className="text-[10px] text-zinc-700">
          Powered by Celo · AgentCash · MiniPay
        </p>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#35D07F]" />
          <span className="text-[10px] text-zinc-700">Live</span>
        </div>
      </div>
    </div>
  )
}
