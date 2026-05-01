'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { ClipboardList } from 'lucide-react'

import type { GenerationPlan } from '@/types'

interface SkeletonPlanCardProps {
  plan: GenerationPlan | null
  isVisible: boolean
}

export function SkeletonPlanCard({ plan, isVisible }: SkeletonPlanCardProps): JSX.Element {
  return (
    <AnimatePresence initial={false}>
      {isVisible ? (
        <motion.div
          key="plan"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: isVisible ? 0.2 : 0.15 }}
          className="border-b border-slate-700 px-3 py-2"
        >
          {plan ? (
            <div
              className="rounded-md border px-4 py-3"
              style={{ backgroundColor: '#1E293B', borderColor: '#0D9488' }}
              data-testid="generation-plan-card"
            >
              <p className="text-[13px] font-medium" style={{ color: '#0D9488' }}>
                <ClipboardList className="w-4 h-4 inline text-[#0D9488] mr-1" /> Generation plan ready
              </p>
              <p className="mt-1 text-xs text-slate-300" data-testid="generation-plan-summary">
                {plan.totalFiles} files across {plan.totalBatches} batches
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Estimated time: {Math.round(plan.estimatedMs / 1000)}s
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {plan.agentBreakdown.map((row) => (
                  <span
                    key={row.agentType}
                    className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-200"
                    data-testid={`agent-chip-${row.agentType}`}
                  >
                    {row.agentType}: {row.fileCount} files
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2 rounded-md px-2 py-3" style={{ backgroundColor: '#1E293B' }}>
              <div className="h-2 w-[75%] animate-pulse rounded bg-slate-700" />
              <div className="h-2 w-[50%] animate-pulse rounded bg-slate-700" />
              <div className="h-2 w-[66%] animate-pulse rounded bg-slate-700" />
            </div>
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
