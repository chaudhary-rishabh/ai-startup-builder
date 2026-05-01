'use client'

import { useEffect, useMemo, useState } from 'react'

import { ProjectGrid } from '@/components/dashboard/ProjectGrid'
import { StarredRow } from '@/components/dashboard/StarredRow'
import { StatCards } from '@/components/dashboard/StatCards'
import { useProjects } from '@/hooks/useProjects'
import { useAuthStore } from '@/store/authStore'

type SortMode = 'recent' | 'name' | 'phase'

function getGreeting(): string {
  const hours = new Date().getHours()
  if (hours < 12) return 'Good morning'
  if (hours < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function DashboardPage(): JSX.Element {
  const user = useAuthStore((state) => state.user)
  const { data } = useProjects({ status: 'active' })
  const [sortMode, setSortMode] = useState<SortMode>('recent')
  const [clock, setClock] = useState(() => new Date())
  const activeCount = data?.projects?.length ?? 0
  const starredCount = useMemo(() => (data?.projects ?? []).filter((project) => project.isStarred).length, [data?.projects])

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="px-8 py-6">
      <section className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[22px] font-bold text-heading">
            {getGreeting()}, {user?.name ?? 'Founder'}
          </h1>
          <p className="text-sm text-muted">{activeCount} active projects. Keep building.</p>
        </div>
        <p className="text-xs text-muted">
          {clock.toLocaleDateString('en-US', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          })}{' '}
          ·{' '}
          {clock.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          })}
        </p>
      </section>

      <section className="mb-8">
        <StatCards />
      </section>

      {starredCount > 0 ? (
        <section className="mb-8">
          <p className="mb-3 text-[10px] uppercase tracking-[0.08em] text-muted">STARRED</p>
          <StarredRow />
        </section>
      ) : null}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-[0.08em] text-muted">ALL PROJECTS</p>
          <div className="flex gap-3 text-xs">
            {(['recent', 'name', 'phase'] as const).map((sort) => (
              <button
                key={sort}
                type="button"
                className={sortMode === sort ? 'border-b-2 border-brand pb-0.5 text-heading' : 'text-muted'}
                onClick={() => setSortMode(sort)}
              >
                {sort === 'recent' ? 'Recent' : sort === 'name' ? 'Name' : 'Phase'}
              </button>
            ))}
          </div>
        </div>
        <ProjectGrid sortMode={sortMode} />
      </section>
    </div>
  )
}
