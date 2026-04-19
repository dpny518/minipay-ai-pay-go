'use client'

import { useState } from 'react'
import { Search, Globe, Bot, User, Smartphone, Mail, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  type TaskType,
  TASK_LABELS,
  TASK_DESCRIPTIONS,
  TASK_PLACEHOLDERS,
  TASK_PRICE_DISPLAY,
} from '@/lib/contracts'
import { type TaskPhase } from '@/hooks/useTaskEscrow'

const TASK_TYPES: TaskType[] = [
  'WEB_SEARCH',
  'AI_ANSWER',
  'WEB_SCRAPE',
  'PEOPLE_LOOKUP',
  'SOCIAL_MEDIA',
  'EMAIL_VERIFY',
]

const TASK_ICON_COMPONENTS: Record<TaskType, React.ElementType> = {
  WEB_SEARCH:    Search,
  WEB_SCRAPE:    Globe,
  AI_ANSWER:     Bot,
  PEOPLE_LOOKUP: User,
  SOCIAL_MEDIA:  Smartphone,
  EMAIL_VERIFY:  Mail,
}

const PHASE_MESSAGES: Partial<Record<TaskPhase, string>> = {
  checking_allowance: 'Checking cUSD balance',
  approving:          'Approve cUSD spend in your wallet',
  awaiting_approval:  'Waiting for approval',
  depositing:         'Confirm task deposit in your wallet',
  awaiting_deposit:   'Waiting for deposit',
  processing:         'Processing your task',
}

interface TaskFormProps {
  isConnected: boolean
  phase:       TaskPhase
  onSubmit:    (taskType: TaskType, input: string) => void
  onReset:     () => void
}

export function TaskForm({ isConnected, phase, onSubmit, onReset }: TaskFormProps) {
  const [selectedType, setSelectedType] = useState<TaskType>('WEB_SEARCH')
  const [input, setInput]               = useState('')

  const isIdle       = phase === 'idle'
  const isFailed     = phase === 'failed'
  const isComplete   = phase === 'complete'
  const isProcessing = !isIdle && !isFailed && !isComplete

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !isConnected || isProcessing) return
    onSubmit(selectedType, input.trim())
  }

  const handleReset = () => {
    setInput('')
    onReset()
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <div>
        <p className="text-[11px] text-zinc-500 mb-2 uppercase tracking-wider font-medium">
          Choose a tool
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
          {TASK_TYPES.map((type) => {
            const Icon = TASK_ICON_COMPONENTS[type]
            return (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                disabled={isProcessing}
                className={cn(
                  'flex-shrink-0 flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl border transition-all min-w-[72px]',
                  selectedType === type
                    ? 'bg-[#FCFF52]/10 border-[#FCFF52] text-[#FCFF52]'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 active:bg-zinc-800',
                  isProcessing && 'opacity-50 cursor-not-allowed'
                )}
              >
                <Icon className="w-4 h-4" strokeWidth={1.75} />
                <span className="text-[10px] font-medium leading-tight text-center">
                  {TASK_LABELS[type]}
                </span>
                <span className="text-[9px] text-zinc-500">
                  {TASK_PRICE_DISPLAY[type]}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-400">{TASK_DESCRIPTIONS[selectedType]}</p>
        <span className="text-xs font-semibold text-[#35D07F] ml-2 flex-shrink-0">
          {TASK_PRICE_DISPLAY[selectedType]} cUSD
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={TASK_PLACEHOLDERS[selectedType]}
          disabled={isProcessing}
          rows={3}
          className={cn(
            'w-full rounded-xl px-4 py-3 text-sm',
            'bg-zinc-900 border border-zinc-800 text-white',
            'placeholder:text-zinc-600',
            'focus:outline-none focus:border-[#FCFF52]/50',
            'resize-none',
            isProcessing && 'opacity-50 cursor-not-allowed'
          )}
        />

        {isProcessing ? (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800">
            <Loader2 className="w-4 h-4 text-[#FCFF52] animate-spin flex-shrink-0" />
            <span className="text-sm text-zinc-400">
              {PHASE_MESSAGES[phase] || 'Processing'}
            </span>
          </div>
        ) : (isComplete || isFailed) ? (
          <button
            type="button"
            onClick={handleReset}
            className="w-full py-3 rounded-xl bg-zinc-800 text-white font-medium text-sm active:bg-zinc-700"
          >
            Submit Another Task
          </button>
        ) : (
          <button
            type="submit"
            disabled={!isConnected || !input.trim()}
            className={cn(
              'w-full py-3.5 rounded-xl font-semibold text-sm transition-all',
              isConnected && input.trim()
                ? 'bg-[#FCFF52] text-black active:opacity-80'
                : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
            )}
          >
            {!isConnected
              ? 'Connect wallet to continue'
              : `Pay ${TASK_PRICE_DISPLAY[selectedType]} cUSD & Run`}
          </button>
        )}
      </form>
    </div>
  )
}
