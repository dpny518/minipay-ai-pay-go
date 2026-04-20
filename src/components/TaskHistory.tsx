'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, ExternalLink, Search, Globe, Bot, User, Smartphone, Mail } from 'lucide-react'
import { loadHistory, type HistoryEntry } from '@/hooks/useTaskEscrow'
import { type TaskType, CHAIN_IDS } from '@/lib/contracts'
import { cn } from '@/lib/utils'

const TASK_ICON_COMPONENTS: Record<TaskType, React.ElementType> = {
  WEB_SEARCH:    Search,
  WEB_SCRAPE:    Globe,
  AI_ANSWER:     Bot,
  PEOPLE_LOOKUP: User,
  SOCIAL_MEDIA:  Smartphone,
  EMAIL_VERIFY:  Mail,
}

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
      className="flex items-center gap-0.5 text-[10px] text-[#35D07F] hover:underline"
    >
      view tx <ExternalLink className="w-2.5 h-2.5" />
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
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      <div className="space-y-2">
        {visible.map((entry) => {
          const Icon = TASK_ICON_COMPONENTS[entry.taskType] || Search
          return (
            <div
              key={entry.taskId}
              className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/50"
            >
              <Icon className="w-4 h-4 text-zinc-500 flex-shrink-0" strokeWidth={1.75} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-zinc-300 truncate">{entry.input}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={cn(
                    'text-[10px]',
                    entry.status === 'complete' ? 'text-green-400' : 'text-red-400'
                  )}>
                    {entry.status}
                  </span>
                  <span className="text-[10px] text-zinc-600">{entry.amountPaid} cUSD</span>
                  <ExplorerLink hash={entry.txHash} chainId={chainId} />
                </div>
              </div>
            </div>
          )
        })}
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
