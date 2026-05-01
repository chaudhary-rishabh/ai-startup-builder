'use client'

import confetti from 'canvas-confetti'
import { motion } from 'framer-motion'
import { PartyPopper, Share2 } from 'lucide-react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

const QRCodeSVG = dynamic(() => import('qrcode.react').then((m) => m.QRCodeSVG), {
  ssr: false,
  loading: () => <div className="mx-auto h-[120px] w-[120px] animate-pulse rounded-md bg-slate-100" />,
})

interface LivePreviewCardProps {
  liveUrl: string
  projectName: string
}

export function LivePreviewCard({ liveUrl, projectName }: LivePreviewCardProps): JSX.Element {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    confetti({
      particleCount: 80,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#8B6F47', '#D4C4A8', '#16A34A', '#F5F0E8'],
    })
  }, [])

  const share = async (): Promise<void> => {
    await navigator.clipboard.writeText(liveUrl)
    setCopied(true)
    toast.success('Copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      data-testid="live-preview-card"
      className="relative overflow-hidden rounded-panel border-2 border-success bg-card p-6"
      initial={{ boxShadow: '0 0 0 4px rgba(22,163,74,0.2)' }}
      animate={{
        boxShadow: [
          '0 0 0 4px rgba(22,163,74,0.2)',
          '0 0 0 8px rgba(22,163,74,0.35)',
          '0 0 0 5px rgba(22,163,74,0.28)',
          '0 0 0 4px rgba(22,163,74,0.2)',
        ],
      }}
      transition={{ duration: 2.4, ease: 'easeOut' }}
    >
      <div className="text-center">
        <PartyPopper className="w-8 h-8 mx-auto text-muted" />
        <h3 className="mt-2 font-display text-xl text-heading">Your startup is live!</h3>
        <p className="mt-1 text-xs text-muted">{projectName}</p>
        <Link
          href={liveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block truncate text-sm font-medium text-[#0D9488] hover:underline"
        >
          {liveUrl}
        </Link>
        <div className="mt-4 flex justify-center">
          <QRCodeSVG value={liveUrl} size={120} level="M" includeMargin />
        </div>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href={liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center rounded-md bg-success px-4 text-sm font-semibold text-white hover:brightness-95"
          >
            Open App →
          </Link>
          <button
            type="button"
            onClick={() => void share()}
            className="inline-flex h-9 items-center gap-1 rounded-md border border-brand px-4 text-sm font-medium text-brand hover:bg-brand/10"
          >
            <Share2 className="h-4 w-4" />
            {copied ? 'Copied!' : 'Share'}
          </button>
        </div>
      </div>
    </motion.div>
  )
}
