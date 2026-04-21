import type { Metadata } from 'next'

import { TokenBudgetBanner } from '@/components/common/TokenBudgetBanner'
import { TokenBudgetWatcher } from '@/components/common/TokenBudgetWatcher'
import { QueryProvider } from '@/providers/QueryProvider'
import { ThemeProvider } from '@/providers/ThemeProvider'
import { ToastProvider } from '@/providers/ToastProvider'

import './globals.css'

export const metadata: Metadata = {
  title: 'AI Startup Builder — Idea to Launch',
  description: 'Build your startup from idea to launch with AI agents.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  openGraph: {
    title: 'AI Startup Builder',
    description: 'Idea to launch with AI agents.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <head>
        <link rel="preload" href="/fonts/Georgia.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link
          rel="preload"
          href="/fonts/JetBrainsMono-Regular.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <QueryProvider>
          <ThemeProvider>
            <ToastProvider>
              <TokenBudgetWatcher />
              <TokenBudgetBanner />
              {children}
            </ToastProvider>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
