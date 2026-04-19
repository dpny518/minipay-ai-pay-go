import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'MiniPay AI Task Router',
  description:
    'Pay micro-cents in cUSD to access AI and data tools on-demand. No subscriptions.',
  icons: { icon: '/favicon.ico' },
  other: { 'talentapp:project_verification': '51a6071920650e1757f666090bf1590f6a9b579f455a5faa747d4959e91194da239d808935618cb2eb36da8d06ee036dc5b76bacadff7243e9915c2d90860f7c' },
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
