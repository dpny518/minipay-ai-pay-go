'use client'

import { useState } from 'react'
import clsx from 'clsx'
import {
  type TaskType,
  TASK_LABELS,
  TASK_DESCRIPTIONS,
  TASK_PLACEHOLDERS,
  TASK_ICONS,
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

const PHASE_MESSAGES: Partial<Record<TaskPhase, string>> = {
  checking_allowance: 'Checking cUSD balance…',
  approving:          'Approve cUSD spend in your wallet…',
  awaiting_approval:  'Waiting for approval…',
  depositing:         'Confirm task deposit in your wallet…',
  awaiting_deposit:   'Waiting for deposit…',
  processing:         'Processing your task…',
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
      {/* Task type selector */}
      <div>
        <p className="text-xs text-zinc-500 mb-2 uppercase tracking-wider font-medium">
          Choose a tool
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
          {TASK_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              disabled={isProcessing}
              className={clsx(
                'flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl border transition-all',
                'min-w-[72px] text-center',
                selectedType === type
                  ? 'bg-[#FCFF52]/10 border-[#FCFF52] text-[#FCFF52]'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 active:bg-zinc-800',
                isProcessing && 'opacity-50 cursor-not-allowed'
              )}
            >
              <span className="text-lg">{TASK_ICONS[type]}</span>
              <span className="text-[10px] font-medium leading-tight">
                {TASK_LABELS[type]}
              </span>
              <span className="text-[9px] text-zinc-500">
                {TASK_PRICE_DISPLAY[type]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Selected task info */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-400">{TASK_DESCRIPTIONS[selectedType]}</p>
        <span className="text-xs font-semibold text-[#35D07F]">
          {TASK_PRICE_DISPLAY[selectedType]} cUSD
        </span>
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={TASK_PLACEHOLDERS[selectedType]}
          disabled={isProcessing}
          rows={3}
          className={clsx(
            'w-full rounded-xl px-4 py-3 text-sm',
            'bg-zinc-900 border border-zinc-800 text-white',
            'placeholder:text-zinc-600',
            'focus:outline-none focus:border-[#FCFF52]/50',
            'resize-none',
            isProcessing && 'opacity-50 cursor-not-allowed'
          )}
        />

        {/* Status / submit */}
        {isProcessing ? (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800">
            <div className="w-4 h-4 border-2 border-zinc-700 border-t-[#FCFF52] rounded-full animate-spin flex-shrink-0" />
            <span className="text-sm text-zinc-400">
              {PHASE_MESSAGES[phase] || 'Processing…'}
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
            className={clsx(
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
