'use client'

import { useState, useEffect } from 'react'
import { loadHistory, type HistoryEntry } from '@/hooks/useTaskEscrow'
import { TASK_ICONS, CHAIN_IDS } from '@/lib/contracts'

interface Props {
  userAddress?: `0x${string}`
  chainId: number
}

function ExplorerLink({ hash, chainId }: { hash: string; chainId: number }) {
  const base =
    chainId === CHAIN_IDS.MAINNET
      ? 'https://celoscan.io/tx/'
      : 'https://alfajores.celoscan.io/tx/'
  return (
    <a
      href={base + hash}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[10px] text-[#35D07F] underline"
    >
      view tx →
    </a>
  )
}

export function TaskHistory({ userAddress, chainId }: Props) {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!userAddress) return
    setHistory(loadHistory(userAddress))
  }, [userAddress])

  if (!userAddress || history.length === 0) return null

  const visible = expanded ? history : history.slice(0, 3)

  return (
    <div className="px-4 pb-6">
      <button
        onClick={() => setExpanded((x) => !x)}
        className="flex items-center justify-between w-full py-2 text-xs text-zinc-500 hover:text-zinc-400"
      >
        <span className="uppercase tracking-wider font-medium">
          History ({history.length})
        </span>
        <span>{expanded ? '▲' : '▼'}</span>
      </button>

      <div className="space-y-2">
        {visible.map((entry) => (
          <div
            key={entry.taskId}
            className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/50"
          >
            <span className="text-base">{TASK_ICONS[entry.taskType]}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-zinc-300 truncate">{entry.input}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={
                  entry.status === 'complete'
                    ? 'text-[10px] text-green-400'
                    : 'text-[10px] text-red-400'
                }>
                  {entry.status}
                </span>
                <span className="text-[10px] text-zinc-600">
                  {entry.amountPaid} cUSD
                </span>
                <ExplorerLink hash={entry.txHash} chainId={chainId} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {history.length > 3 && (
        <button
          onClick={() => setExpanded((x) => !x)}
          className="w-full mt-2 py-1.5 text-xs text-zinc-600 hover:text-zinc-400"
        >
          {expanded ? 'Show less' : `Show ${history.length - 3} more`}
        </button>
      )}
    </div>
  )
}
