import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Providers } from './providers'

const BASE_URL = 'https://minipay-ai-pay-go.pages.dev'

export const metadata: Metadata = {
  title: 'MiniPay AI — Pay-Per-Use AI Tools on Celo',
  description:
    'Run web search, scraping, AI answers & data enrichment for micro-cents in cUSD via MiniPay. No subscriptions. Pay only for real results.',
  metadataBase: new URL(BASE_URL),
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
  openGraph: {
    type: 'website',
    url: BASE_URL,
    title: 'MiniPay AI — Pay-Per-Use AI Tools on Celo',
    description:
      'Run web search, scraping, AI answers & data enrichment for micro-cents in cUSD. No subscriptions. Powered by Celo, AgentCash & MiniPay.',
    images: [
      {
        url: '/og.svg',
        width: 1200,
        height: 630,
        alt: 'MiniPay AI — Pay-Per-Use AI Tools on Celo',
      },
    ],
    siteName: 'MiniPay AI',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MiniPay AI — Pay-Per-Use AI Tools on Celo',
    description:
      'Run web search, scraping, AI answers & data enrichment for micro-cents in cUSD. No subscriptions.',
    images: ['/og.svg'],
  },
  other: {
    'talentapp:project_verification': '51a6071920650e1757f666090bf1590f6a9b579f455a5faa747d4959e91194da239d808935618cb2eb36da8d06ee036dc5b76bacadff7243e9915c2d90860f7c',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#FCFF52',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
