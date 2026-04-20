/**
 * AgentCash task router — server-side only.
 *
 * Routes user task requests to the appropriate stableenrich.dev /
 * stablesocial.dev endpoint, handling x402 payment and SIWX auth.
 *
 * NEVER import this file in frontend components.
 */

import type { TaskType } from './contracts'
import { x402Fetch, siwxFetch } from './x402'
import type { Hex } from 'viem'

const OPERATOR_KEY = process.env.OPERATOR_PRIVATE_KEY as Hex

// ─── Result types ─────────────────────────────────────────────────────────────

export interface SearchResult {
  title:   string
  url:     string
  snippet: string
}

export interface TaskResult {
  type:    TaskType
  summary: string
  data:    unknown
  sources?: SearchResult[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function postStableEnrich(path: string, body: object): Promise<unknown> {
  const url = `https://stableenrich.dev${path}`
  const res = await x402Fetch(
    url,
    { method: 'POST', body: JSON.stringify(body) },
    OPERATOR_KEY
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`stableenrich ${path} → ${res.status}: ${text}`)
  }
  return res.json()
}

async function postSocialTrigger(path: string, body: object): Promise<string> {
  const url = `https://stablesocial.dev${path}`
  const res = await x402Fetch(
    url,
    { method: 'POST', body: JSON.stringify(body) },
    OPERATOR_KEY
  )
  if (res.status !== 202) {
    const text = await res.text()
    throw new Error(`stablesocial ${path} → ${res.status}: ${text}`)
  }
  const json = await res.json() as { token: string }
  return json.token
}

async function pollSocialJob(token: string, timeoutMs = 60_000): Promise<unknown> {
  const url = `https://stablesocial.dev/api/jobs?token=${encodeURIComponent(token)}`
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const res = await siwxFetch(url, OPERATOR_KEY, 'stablesocial.dev')
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`stablesocial /api/jobs → ${res.status}: ${text}`)
    }
    const json = await res.json() as { status: string; data?: unknown; error?: string }
    if (json.status === 'finished') return json.data
    if (json.status === 'failed')   throw new Error(`stablesocial job failed: ${json.error}`)
    // pending — wait 3 seconds and poll again
    await new Promise((r) => setTimeout(r, 3000))
  }
  throw new Error('stablesocial job timed out after 60s')
}

// ─── Task handlers ────────────────────────────────────────────────────────────

async function handleWebSearch(input: string): Promise<TaskResult> {
  const data = await postStableEnrich('/api/exa/search', {
    query:      input,
    numResults: 8,
  }) as { results?: Array<{ title: string; url: string; text?: string }> }

  const results = data.results || []
  const sources: SearchResult[] = results.map((r) => ({
    title:   r.title || '',
    url:     r.url || '',
    snippet: (r.text || '').slice(0, 300),
  }))

  return {
    type:    'WEB_SEARCH',
    summary: `Found ${results.length} results for: "${input}"`,
    data:    results,
    sources,
  }
}

/**
 * Block SSRF: reject URLs targeting internal networks, cloud metadata,
 * or non-http(s) schemes.
 */
function validateExternalUrl(raw: string): string {
  let url = raw.trim()
  if (!url.startsWith('http')) url = 'https://' + url

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('Invalid URL format')
  }

  // Only allow http(s)
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Only http/https URLs are allowed')
  }

  const hostname = parsed.hostname.toLowerCase()

  // Block private/internal IP ranges and cloud metadata
  const blockedPatterns = [
    /^localhost$/,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,          // AWS/cloud metadata endpoint
    /^0\./,
    /^\[::1?\]$/,           // IPv6 loopback
    /^metadata\.google\./,  // GCP metadata
    /\.internal$/,
    /\.local$/,
  ]

  for (const pattern of blockedPatterns) {
    if (pattern.test(hostname)) {
      throw new Error('Scraping internal/private network addresses is not allowed')
    }
  }

  return url
}

async function handleWebScrape(input: string): Promise<TaskResult> {
  const url = validateExternalUrl(input)

  const data = await postStableEnrich('/api/firecrawl/scrape', {
    url,
  }) as { markdown?: string; metadata?: { title?: string; description?: string } }

  return {
    type:    'WEB_SCRAPE',
    summary: data.metadata?.title || `Scraped: ${url}`,
    data,
  }
}

async function handleAiAnswer(input: string): Promise<TaskResult> {
  const data = await postStableEnrich('/api/exa/answer', {
    query: input,
  }) as { answer?: string; citations?: Array<{ url: string; title: string }> }

  const sources: SearchResult[] = (data.citations || []).map((c) => ({
    title:   c.title || '',
    url:     c.url   || '',
    snippet: '',
  }))

  return {
    type:    'AI_ANSWER',
    summary: (data.answer || '').slice(0, 120) + '...',
    data,
    sources,
  }
}

async function handlePeopleLookup(input: string): Promise<TaskResult> {
  // Step 1: search Apollo
  const searchData = await postStableEnrich('/api/apollo/people-search', {
    q_keywords: input,
    per_page:   1,
  }) as { people?: Array<{ id?: string; name?: string }> }

  const person = (searchData.people || [])[0]
  if (!person) {
    throw new Error(`No person found for: "${input}"`)
  }

  // Step 2: enrich Apollo person
  const enrichData = await postStableEnrich('/api/apollo/people-enrich', {
    id: person.id,
  }) as { person?: object }

  return {
    type:    'PEOPLE_LOOKUP',
    summary: `Enriched profile for: ${person.name || input}`,
    data:    enrichData.person || enrichData,
  }
}

async function handleSocialMedia(input: string): Promise<TaskResult> {
  // Parse "platform:handle" format
  const [platform, ...rest] = input.trim().split(':')
  const handle = rest.join(':').trim() || platform

  const validPlatforms = ['instagram', 'tiktok', 'facebook', 'reddit'] as const
  type Platform = typeof validPlatforms[number]

  const plat = platform.toLowerCase() as Platform
  if (!validPlatforms.includes(plat)) {
    throw new Error(
      `Unknown platform "${platform}". Use: instagram:handle, tiktok:handle, facebook:handle, reddit:handle`
    )
  }

  // Trigger the social job (paid)
  const token = await postSocialTrigger(`/api/${plat}/profile`, { handle })

  // Poll until finished (SIWX auth, free)
  const profileData = await pollSocialJob(token)

  return {
    type:    'SOCIAL_MEDIA',
    summary: `${plat.charAt(0).toUpperCase() + plat.slice(1)} profile: @${handle}`,
    data:    profileData,
  }
}

async function handleEmailVerify(input: string): Promise<TaskResult> {
  const email = input.trim().toLowerCase()
  const data = await postStableEnrich('/api/hunter/email-verifier', {
    email,
  })

  return {
    type:    'EMAIL_VERIFY',
    summary: `Verified: ${email}`,
    data,
  }
}

// ─── Main router ─────────────────────────────────────────────────────────────

export async function routeTask(
  taskType: TaskType,
  input: string
): Promise<TaskResult> {
  switch (taskType) {
    case 'WEB_SEARCH':    return handleWebSearch(input)
    case 'WEB_SCRAPE':    return handleWebScrape(input)
    case 'AI_ANSWER':     return handleAiAnswer(input)
    case 'PEOPLE_LOOKUP': return handlePeopleLookup(input)
    case 'SOCIAL_MEDIA':  return handleSocialMedia(input)
    case 'EMAIL_VERIFY':  return handleEmailVerify(input)
    default:
      throw new Error(`Unknown task type: ${taskType}`)
  }
}
