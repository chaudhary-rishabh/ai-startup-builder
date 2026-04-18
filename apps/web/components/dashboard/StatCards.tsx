'use client'

import { Activity, CheckCircle2, FolderOpen, Zap } from 'lucide-react'
import { useMemo } from 'react'

import { useProjects } from '@/hooks/useProjects'
import { useQuery } from '@tanstack/react-query'
import { getTokenBudget } from '@/api/billing.api'

function formatCompact(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`
  }
  return String(value)
}

export function StatCards(): JSX.Element {
  const { data, isLoading } = useProjects({ status: 'active' })
  const tokenUsageQuery = useQuery({
    queryKey: ['token-budget-card'],
    queryFn: getTokenBudget,
    staleTime: 30_000,
  })

  const activeProjects = data?.projects?.length ?? 0
  const phasesComplete = useMemo(
    () => (data?.projects ?? []).reduce((sum, project) => sum + Math.max(0, project.currentPhase - 1), 0),
    [data?.projects],
  )

  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="shimmer h-28 rounded-card" />
        ))}
      </div>
    )
  }

  const cards = [
    { label: 'Active Projects', value: activeProjects, icon: FolderOpen },
    { label: 'Phases Complete', value: phasesComplete, icon: CheckCircle2 },
    { label: 'Agents Run', value: '--', icon: Zap },
    {
      label: 'Tokens Used',
      value: formatCompact(tokenUsageQuery.data?.tokensUsed ?? 0),
      icon: Activity,
    },
  ]

  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <article key={card.label} className="relative rounded-card bg-card p-6 shadow-sm">
            <p className="mb-2 text-xs uppercase tracking-[0.08em] text-muted">{card.label}</p>
            <p className="font-display text-[28px] font-bold text-heading">{card.value}</p>
            <Icon className="absolute right-4 top-4 h-5 w-5 text-muted" />
          </article>
        )
      })}
    </div>
  )
}
