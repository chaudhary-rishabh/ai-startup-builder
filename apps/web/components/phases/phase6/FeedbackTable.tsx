'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDown, ArrowUp, Meh, ThumbsDown, ThumbsUp } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'

export interface FeedbackEntry {
  id: string
  text: string
  sentiment: 'positive' | 'neutral' | 'negative'
  category: string
  frequency: number
}

type SortKey = 'text' | 'sentiment' | 'category' | 'frequency'

interface FeedbackTableProps {
  entries: FeedbackEntry[]
  isStreaming: boolean
  onAnalyzeFeedback?: () => void
}

function sentimentBadge(s: FeedbackEntry['sentiment']): string {
  if (s === 'positive') return 'bg-success-bg text-success'
  if (s === 'negative') return 'bg-error/10 text-error'
  return 'bg-divider text-muted'
}

const sentimentIcon: Record<FeedbackEntry['sentiment'], LucideIcon> = {
  positive: ThumbsUp,
  negative: ThumbsDown,
  neutral: Meh,
}

function sentimentLabel(s: FeedbackEntry['sentiment']): string {
  if (s === 'positive') return 'Positive'
  if (s === 'negative') return 'Negative'
  return 'Neutral'
}

export function FeedbackTable({ entries, isStreaming, onAnalyzeFeedback }: FeedbackTableProps): JSX.Element {
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'frequency', dir: 'desc' })
  const [expanded, setExpanded] = useState<string | null>(null)

  const sorted = useMemo(() => {
    const list = [...entries]
    const { key, dir } = sort
    const mul = dir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      if (key === 'frequency') return (a.frequency - b.frequency) * mul
      if (key === 'sentiment') return a.sentiment.localeCompare(b.sentiment) * mul
      if (key === 'category') return a.category.localeCompare(b.category) * mul
      return a.text.localeCompare(b.text) * mul
    })
    return list
  }, [entries, sort])

  const toggleSort = (key: SortKey): void => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  }

  const SortIcon = ({ column }: { column: SortKey }): JSX.Element | null => {
    if (sort.key !== column) return null
    return sort.dir === 'asc' ? <ArrowUp className="inline h-3 w-3" /> : <ArrowDown className="inline h-3 w-3" />
  }

  if (!entries.length && !isStreaming) {
    return (
      <div className="rounded-card border border-divider bg-card p-8 text-center shadow-sm">
        <p className="text-sm text-muted">No feedback submitted yet. Run the Feedback Agent to analyze.</p>
        {onAnalyzeFeedback ? (
          <button
            type="button"
            data-testid="analyze-feedback-btn"
            onClick={onAnalyzeFeedback}
            className="mt-4 h-10 rounded-md border border-brand px-4 text-sm font-medium text-brand hover:bg-brand/10"
          >
            Analyze Feedback
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div className={`overflow-hidden rounded-card border border-divider bg-card shadow-sm ${isStreaming ? 'animate-pulse' : ''}`}>
      <table className="w-full text-left text-sm">
        <thead className="border-b border-divider bg-bg text-xs uppercase text-muted">
          <tr>
            <th className="px-4 py-3">
              <button type="button" className="inline-flex items-center gap-1 font-medium" onClick={() => toggleSort('text')}>
                Feedback <SortIcon column="text" />
              </button>
            </th>
            <th className="px-4 py-3">
              <button type="button" className="inline-flex items-center gap-1 font-medium" onClick={() => toggleSort('sentiment')}>
                Sentiment <SortIcon column="sentiment" />
              </button>
            </th>
            <th className="px-4 py-3">
              <button type="button" className="inline-flex items-center gap-1 font-medium" onClick={() => toggleSort('category')}>
                Category <SortIcon column="category" />
              </button>
            </th>
            <th className="px-4 py-3">
              <button type="button" className="inline-flex items-center gap-1 font-medium" onClick={() => toggleSort('frequency')}>
                Frequency <SortIcon column="frequency" />
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const open = expanded === row.id
            const short = row.text.length > 80 ? `${row.text.slice(0, 80)}…` : row.text
            return (
              <Fragment key={row.id}>
                <tr className="cursor-pointer border-b border-divider hover:bg-bg" onClick={() => setExpanded(open ? null : row.id)}>
                  <td className="px-4 py-3 text-[13px] text-heading">{short}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium inline-flex items-center gap-1 ${sentimentBadge(row.sentiment)}`}>
                      {(() => { const Icon = sentimentIcon[row.sentiment]; return <Icon className="w-3 h-3" />; })()}
                      {sentimentLabel(row.sentiment)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">{row.category}</td>
                  <td className="px-4 py-3 text-muted">{row.frequency}</td>
                </tr>
                {open ? (
                  <tr className="border-b border-divider">
                    <td colSpan={4} className="px-4 pb-3">
                      <AnimatePresence initial={false}>
                        <motion.div
                          key="exp"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden rounded-md bg-bg p-3 text-sm text-heading"
                        >
                          {row.text}
                        </motion.div>
                      </AnimatePresence>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
