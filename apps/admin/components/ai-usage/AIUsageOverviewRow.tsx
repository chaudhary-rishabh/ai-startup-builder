'use client'

import { formatNumber } from '@/lib/dateRange'
import type { AIUsageOverview } from '@/types'

interface AIUsageOverviewRowProps {
  overview: AIUsageOverview | undefined
  isLoading: boolean
}

export function AIUsageOverviewRow({
  overview,
  isLoading,
}: AIUsageOverviewRowProps) {
  if (isLoading || !overview) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-card shimmer" />
        ))}
      </div>
    )
  }

  const cards = [
    { label: 'Tokens Today', value: `${formatNumber(overview.tokensToday)}T` },
    {
      label: 'Tokens This Month',
      value: `${formatNumber(overview.tokensThisMonth)}T`,
    },
    {
      label: 'Projected Cost',
      value: `$${overview.projectedCostUsd.toFixed(2)}`,
      warn: overview.projectedCostUsd > 500,
    },
    {
      label: 'Cost This Month',
      value: `$${overview.costThisMonthUsd.toFixed(2)}`,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-card bg-card p-5 shadow-sm">
          <p className="text-[11px] uppercase tracking-wide text-muted">
            {c.label}
          </p>
          <p className="mt-2 font-display text-xl font-bold text-heading">
            {c.value}
          </p>
          {'warn' in c && c.warn && (
            <span className="mt-1 inline-block rounded-chip bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800">
              High
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
