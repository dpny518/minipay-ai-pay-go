'use client'

import { ExternalLink, Mail, Phone, CheckCircle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TaskResult as TResult } from '@/lib/agentcash'
import { CHAIN_IDS } from '@/lib/contracts'

interface Props {
  result: TResult
  txHash: string | null
  chainId: number
  phase: string
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
      className="flex items-center gap-1 text-xs text-[#35D07F] hover:underline"
    >
      {hash.slice(0, 14)}…{hash.slice(-6)}
      <ExternalLink className="w-3 h-3" />
    </a>
  )
}

function WebSearchResult({ data }: { data: unknown }) {
  const results = (data as any)?.results || (data as any[]) || []
  return (
    <div className="space-y-2">
      {results.slice(0, 6).map((r: any, i: number) => (
        <div key={i} className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
          <a
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-[#FCFF52] hover:underline line-clamp-1"
          >
            {r.title || r.url}
          </a>
          <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
            {r.text || r.snippet || r.summary || ''}
          </p>
          <p className="text-[10px] text-zinc-600 mt-1 truncate">{r.url}</p>
        </div>
      ))}
    </div>
  )
}

function WebScrapeResult({ data }: { data: unknown }) {
  const d = data as any
  const markdown = d?.markdown || d?.content || JSON.stringify(data, null, 2)
  return (
    <pre className="whitespace-pre-wrap break-words text-xs text-zinc-300 bg-zinc-900 p-3 rounded-lg border border-zinc-800 max-h-80 overflow-y-auto">
      {markdown}
    </pre>
  )
}

function AiAnswerResult({ data }: { data: unknown }) {
  const d = data as any
  const answer = d?.answer || d?.text || JSON.stringify(data)
  const citations = d?.citations as any[] | undefined
  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-200 leading-relaxed">{answer}</p>
      {citations && citations.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2">Sources</p>
          <div className="space-y-1">
            {citations.slice(0, 4).map((c: any, i: number) => (
              <a key={i} href={c.url} target="_blank" rel="noopener noreferrer"
                 className="flex items-center gap-1 text-xs text-[#35D07F] hover:underline truncate">
                {c.title || c.url}
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PeopleLookupResult({ data }: { data: unknown }) {
  const p = (data as any) || {}
  const name    = p.name || (p.first_name ? `${p.first_name} ${p.last_name || ''}`.trim() : 'Unknown')
  const title   = p.title || p.headline || ''
  const company = p.organization?.name || p.company || p.employer || ''
  const email   = p.email || p.email_addresses?.[0]?.email || ''
  const phone   = p.phone_numbers?.[0]?.sanitized_number || ''
  const linkedin = p.linkedin_url || ''

  return (
    <div className="space-y-2">
      <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-2">
        <p className="text-base font-semibold text-white">{name}</p>
        {title   && <p className="text-xs text-zinc-400">{title}</p>}
        {company && <p className="text-xs text-zinc-400">{company}</p>}
        {email && (
          <p className="flex items-center gap-1.5 text-xs text-[#35D07F]">
            <Mail className="w-3 h-3" /> {email}
          </p>
        )}
        {phone && (
          <p className="flex items-center gap-1.5 text-xs text-zinc-300">
            <Phone className="w-3 h-3" /> {phone}
          </p>
        )}
        {linkedin && (
          <a href={linkedin} target="_blank" rel="noopener noreferrer"
             className="flex items-center gap-1 text-xs text-[#FCFF52] hover:underline">
            LinkedIn <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
      <details className="text-xs text-zinc-600">
        <summary className="cursor-pointer hover:text-zinc-400">Raw data</summary>
        <pre className="mt-2 p-2 bg-zinc-900 rounded text-[10px] overflow-auto max-h-40">
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  )
}

function SocialMediaResult({ data }: { data: unknown }) {
  const p = (data as any) || {}
  return (
    <div className="space-y-2">
      <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1.5">
        {p.username  && <p className="font-semibold text-white">@{p.username || p.handle}</p>}
        {p.full_name && <p className="text-sm text-zinc-300">{p.full_name}</p>}
        {p.biography && <p className="text-xs text-zinc-400 line-clamp-3">{p.biography}</p>}
        <div className="flex gap-4 mt-2">
          {p.follower_count !== undefined && (
            <span className="text-xs text-zinc-300">
              <span className="font-semibold text-white">{(p.follower_count as number).toLocaleString()}</span> followers
            </span>
          )}
          {p.following_count !== undefined && (
            <span className="text-xs text-zinc-300">
              <span className="font-semibold text-white">{(p.following_count as number).toLocaleString()}</span> following
            </span>
          )}
        </div>
      </div>
      <details className="text-xs text-zinc-600">
        <summary className="cursor-pointer hover:text-zinc-400">Raw data</summary>
        <pre className="mt-2 p-2 bg-zinc-900 rounded text-[10px] overflow-auto max-h-40">
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  )
}

function EmailVerifyResult({ data }: { data: unknown }) {
  const d = (data as any) || {}
  const status = d.status || d.result || d.deliverability || 'unknown'
  const score  = d.score ?? d.confidence ?? null
  const isGood = ['valid', 'deliverable', 'safe-to-send'].includes(String(status).toLowerCase())

  return (
    <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-2">
      <div className="flex items-center gap-2">
        {isGood
          ? <CheckCircle className="w-4 h-4 text-green-400" />
          : <XCircle className="w-4 h-4 text-red-400" />
        }
        <span className={cn(
          'px-2 py-0.5 rounded-full text-xs font-semibold',
          isGood ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
        )}>
          {status}
        </span>
        {score !== null && <span className="text-xs text-zinc-400">Score: {score}</span>}
      </div>
      {d.email && <p className="text-sm text-zinc-300">{d.email}</p>}
      <details className="text-xs text-zinc-600">
        <summary className="cursor-pointer hover:text-zinc-400">Full response</summary>
        <pre className="mt-2 p-2 bg-zinc-900 rounded text-[10px] overflow-auto max-h-40">
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  )
}

const RESULT_COMPONENTS: Record<string, React.ComponentType<{ data: unknown }>> = {
  WEB_SEARCH:    WebSearchResult,
  WEB_SCRAPE:    WebScrapeResult,
  AI_ANSWER:     AiAnswerResult,
  PEOPLE_LOOKUP: PeopleLookupResult,
  SOCIAL_MEDIA:  SocialMediaResult,
  EMAIL_VERIFY:  EmailVerifyResult,
}

export function TaskResultCard({ result, txHash, chainId }: Props) {
  const Component = RESULT_COMPONENTS[result.type]

  return (
    <div className="mx-4 mt-1 rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#35D07F]" />
          <span className="text-xs font-medium text-zinc-300 truncate max-w-[200px]">
            {result.summary}
          </span>
        </div>
        <span className="text-[10px] text-zinc-600 uppercase tracking-wide flex-shrink-0">
          {result.type.replace('_', ' ')}
        </span>
      </div>

      <div className="px-4 py-3">
        {Component ? (
          <Component data={result.data} />
        ) : (
          <pre className="text-xs text-zinc-400 overflow-auto">
            {JSON.stringify(result.data, null, 2)}
          </pre>
        )}
      </div>

      {txHash && (
        <div className="px-4 py-2 border-t border-zinc-800 flex items-center justify-between">
          <span className="text-[10px] text-zinc-600">Transaction</span>
          <ExplorerLink hash={txHash} chainId={chainId} />
        </div>
      )}
    </div>
  )
}
