// ─── Task Types ───────────────────────────────────────────────────────────────

export type TaskType =
  | 'WEB_SEARCH'
  | 'WEB_SCRAPE'
  | 'AI_ANSWER'
  | 'PEOPLE_LOOKUP'
  | 'SOCIAL_MEDIA'
  | 'EMAIL_VERIFY'

export const TASK_LABELS: Record<TaskType, string> = {
  WEB_SEARCH:    'Web Search',
  WEB_SCRAPE:    'Web Scrape',
  AI_ANSWER:     'AI Answer',
  PEOPLE_LOOKUP: 'People Lookup',
  SOCIAL_MEDIA:  'Social Media',
  EMAIL_VERIFY:  'Email Verify',
}

export const TASK_DESCRIPTIONS: Record<TaskType, string> = {
  WEB_SEARCH:    'Search the web with neural AI',
  WEB_SCRAPE:    'Scrape any URL — JS-rendered',
  AI_ANSWER:     'Ask anything, get cited answers',
  PEOPLE_LOOKUP: "Find & enrich a person's profile",
  SOCIAL_MEDIA:  'Fetch Instagram / TikTok / Facebook data',
  EMAIL_VERIFY:  'Verify email deliverability',
}

export const TASK_PLACEHOLDERS: Record<TaskType, string> = {
  WEB_SEARCH:    'What are the latest developments in Celo blockchain?',
  WEB_SCRAPE:    'https://example.com',
  AI_ANSWER:     'Explain DeFi yield farming to a beginner',
  PEOPLE_LOOKUP: 'Satoshi Nakamoto Bitcoin creator',
  SOCIAL_MEDIA:  'instagram:username  or  tiktok:username',
  EMAIL_VERIFY:  'user@company.com',
}

export const TASK_ICONS: Record<TaskType, string> = {
  WEB_SEARCH:    '🔍',
  WEB_SCRAPE:    '🌐',
  AI_ANSWER:     '🤖',
  PEOPLE_LOOKUP: '👤',
  SOCIAL_MEDIA:  '📱',
  EMAIL_VERIFY:  '✉️',
}

// ─── Pricing (in cUSD, 18 decimals) ──────────────────────────────────────────
// Markup over AgentCash API cost to cover: gas, API fees, platform margin

export const TASK_PRICES_CUSD: Record<TaskType, bigint> = {
  WEB_SEARCH:    25_000_000_000_000_000n, // $0.025 cUSD (Exa $0.01 + margin)
  WEB_SCRAPE:    30_000_000_000_000_000n, // $0.030 cUSD (Firecrawl $0.0126 + margin)
  AI_ANSWER:     25_000_000_000_000_000n, // $0.025 cUSD (Exa Answer $0.01 + margin)
  PEOPLE_LOOKUP: 100_000_000_000_000_000n,// $0.100 cUSD (Apollo $0.0695 + margin)
  SOCIAL_MEDIA:  120_000_000_000_000_000n,// $0.120 cUSD (StableSocial $0.06 + margin)
  EMAIL_VERIFY:  60_000_000_000_000_000n, // $0.060 cUSD (Hunter $0.03 + margin)
}

export const TASK_PRICE_DISPLAY: Record<TaskType, string> = {
  WEB_SEARCH:    '$0.025',
  WEB_SCRAPE:    '$0.030',
  AI_ANSWER:     '$0.025',
  PEOPLE_LOOKUP: '$0.100',
  SOCIAL_MEDIA:  '$0.120',
  EMAIL_VERIFY:  '$0.060',
}

// Cost breakdown for transparency: what the API costs vs what user pays
export const TASK_COST_BREAKDOWN: Record<TaskType, { apiCost: string; protocolFee: string; total: string }> = {
  WEB_SEARCH:    { apiCost: '$0.010', protocolFee: '$0.015', total: '$0.025' },
  WEB_SCRAPE:    { apiCost: '$0.013', protocolFee: '$0.017', total: '$0.030' },
  AI_ANSWER:     { apiCost: '$0.010', protocolFee: '$0.015', total: '$0.025' },
  PEOPLE_LOOKUP: { apiCost: '$0.070', protocolFee: '$0.030', total: '$0.100' },
  SOCIAL_MEDIA:  { apiCost: '$0.060', protocolFee: '$0.060', total: '$0.120' },
  EMAIL_VERIFY:  { apiCost: '$0.030', protocolFee: '$0.030', total: '$0.060' },
}

// ─── Networks ────────────────────────────────────────────────────────────────

export const CHAIN_IDS = {
  MAINNET: 42220,
  TESTNET: 44787,
} as const

export const CUSD_ADDRESSES: Record<number, `0x${string}`> = {
  [CHAIN_IDS.MAINNET]: '0x765DE816845861e75A25fCA122bb6898B8B1282a',
  [CHAIN_IDS.TESTNET]: '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1',
}

export const ESCROW_ADDRESSES: Record<number, `0x${string}`> = {
  [CHAIN_IDS.MAINNET]: (process.env.NEXT_PUBLIC_ESCROW_ADDRESS_MAINNET || '0x') as `0x${string}`,
  [CHAIN_IDS.TESTNET]: (process.env.NEXT_PUBLIC_ESCROW_ADDRESS_TESTNET || '0x') as `0x${string}`,
}

// ─── ABIs ─────────────────────────────────────────────────────────────────────

export const TASK_ESCROW_ABI = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'taskId', type: 'bytes32' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'tasks',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'taskId', type: 'bytes32' }],
    outputs: [
      { name: 'user',        type: 'address' },
      { name: 'amount',      type: 'uint256' },
      { name: 'depositedAt', type: 'uint64'  },
      { name: 'status',      type: 'uint8'   },
    ],
  },
  {
    name: 'getTask',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'taskId', type: 'bytes32' }],
    outputs: [
      {
        components: [
          { name: 'user',        type: 'address' },
          { name: 'amount',      type: 'uint256' },
          { name: 'depositedAt', type: 'uint64'  },
          { name: 'status',      type: 'uint8'   },
        ],
        name: '',
        type: 'tuple',
      },
    ],
  },
  {
    name: 'TASK_EXPIRY',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'userRefund',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'taskId', type: 'bytes32' }],
    outputs: [],
  },
  // Events
  {
    name: 'TaskDeposited',
    type: 'event',
    inputs: [
      { name: 'taskId', type: 'bytes32', indexed: true },
      { name: 'user',   type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'TaskReleased',
    type: 'event',
    inputs: [
      { name: 'taskId', type: 'bytes32', indexed: true },
      { name: 'user',   type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'fee',    type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'TaskRefunded',
    type: 'event',
    inputs: [
      { name: 'taskId', type: 'bytes32', indexed: true },
      { name: 'user',   type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const

export const CUSD_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount',  type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner',   type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const
