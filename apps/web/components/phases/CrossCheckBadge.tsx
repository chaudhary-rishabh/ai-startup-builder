'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useState } from 'react'

import type { SSECrossCheckEvent } from '@/types'

const container = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } }
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }

export function CrossCheckBadge({ crossChecks }: { crossChecks: SSECrossCheckEvent[] }): JSX.Element | null {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  if (!crossChecks.length) return null

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="mt-3 flex flex-col gap-1.5">
      <AnimatePresence>
        {crossChecks.map((check) => {
          const key = `${check.runId}-${check.check}`
          const isExpanded = expanded[key] ?? false
          return (
            <motion.button
              key={key}
              type="button"
              variants={item}
              className={`w-full rounded-chip border px-3 py-2 text-left text-xs ${
                check.passed
                  ? 'border-green-300 bg-success-bg text-green-700'
                  : 'border-yellow-300 bg-yellow-50 text-yellow-800'
              }`}
              onClick={() => {
                if (!check.passed) {
                  setExpanded((prev) => ({ ...prev, [key]: !isExpanded }))
                }
              }}
            >
              <span className="inline-flex items-center gap-2">
                {check.passed ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                {check.passed
                  ? `Quality check ${check.check} passed`
                  : `Check ${check.check}: ${check.issues.length} issue${check.issues.length === 1 ? '' : 's'} auto-fixed`}
              </span>
              {!check.passed && isExpanded ? (
                <ul className="mt-2 list-disc pl-4 text-[11px] text-yellow-900">
                  {check.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              ) : null}
            </motion.button>
          )
        })}
      </AnimatePresence>
    </motion.div>
  )
}
