'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { FileText } from 'lucide-react'

import type { SSEDocModeEvent } from '@/types'

function formatTokenCount(value: number): string {
  return `${(value / 1000).toFixed(1)}K`
}

function modeText(mode: SSEDocModeEvent['mode']): string {
  if (mode === 'direct') return 'direct injection'
  if (mode === 'compressed') return 'compressed'
  if (mode === 'contextual_rag') return 'contextual RAG'
  return ''
}

export function DocModeIndicator({ docMode }: { docMode: SSEDocModeEvent | null }): JSX.Element | null {
  if (!docMode || docMode.mode === 'none') return null

  const docsLabel = docMode.docCount === 1 ? 'doc' : 'docs'
  const description =
    docMode.mode === 'contextual_rag'
      ? `Using ${docMode.docCount} ${docsLabel} (contextual RAG — top 5 chunks)`
      : `Using ${docMode.docCount} ${docsLabel} (${modeText(docMode.mode)} — ${formatTokenCount(docMode.tokenCount)} tokens)`

  return (
    <AnimatePresence>
      <motion.div
        key={`${docMode.runId}-${docMode.mode}`}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="mb-3 rounded-chip border-l-[3px] border-info bg-sky-50 px-3 py-2 text-xs text-info"
      >
        <span className="inline-flex items-center gap-2">
          <FileText size={14} />
          {description}
        </span>
      </motion.div>
    </AnimatePresence>
  )
}
