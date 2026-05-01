'use client'

import { motion } from 'framer-motion'
import { Check, RotateCcw } from 'lucide-react'
import type { ReactNode } from 'react'

interface OutputCardProps {
  title: string
  agentType: string
  isVisible: boolean
  isStreaming?: boolean
  children: ReactNode
  onRefine?: () => void
}

export function OutputCard({
  title,
  isVisible,
  isStreaming = false,
  children,
  onRefine,
}: OutputCardProps): JSX.Element | null {
  if (!isVisible) return null

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut', delay: 0.1 }}
      className="rounded-card border border-divider bg-card p-5 shadow-sm"
    >
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-heading">{title}</h3>
        <div className="flex items-center gap-2">
          {isStreaming ? (
            <span className="animate-pulse rounded-full bg-warning/20 px-2 py-1 text-[10px] font-semibold text-warning">
              Generating…
            </span>
          ) : (
            <span className="rounded-full bg-success-bg px-2 py-1 text-[10px] font-semibold text-success inline-flex items-center gap-1"><Check className="w-3 h-3" /> Done</span>
          )}
          {onRefine ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs text-muted transition hover:text-brand"
              onClick={onRefine}
            >
              <RotateCcw size={14} />
              Refine
            </button>
          ) : null}
        </div>
      </header>
      {children}
    </motion.article>
  )
}
