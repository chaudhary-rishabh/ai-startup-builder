'use client'

import * as Checkbox from '@radix-ui/react-checkbox'
import confetti from 'canvas-confetti'
import { Check, Rocket, Search, Smartphone, DollarSign, Wrench, Target, TrendingUp } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { updateProject } from '@/api/projects.api'
import { cn } from '@/lib/utils'

export interface GrowthActionItem {
  id: string
  title: string
  channel: 'SEO' | 'Social' | 'Paid' | 'Product'
  effort: 'low' | 'medium' | 'high'
}

interface GrowthActionsProps {
  projectId: string
  actions: GrowthActionItem[]
  playbookSteps: string[]
}

const channelChip: Record<GrowthActionItem['channel'], string> = {
  SEO: 'bg-blue-100 text-blue-700',
  Social: 'bg-purple-100 text-purple-700',
  Paid: 'bg-orange-100 text-orange-700',
  Product: 'bg-green-100 text-green-700',
}

const channelIcon: Record<GrowthActionItem['channel'], LucideIcon> = {
  SEO: Search,
  Social: Smartphone,
  Paid: DollarSign,
  Product: Wrench,
}

const channelLabel: Record<GrowthActionItem['channel'], string> = {
  SEO: 'SEO',
  Social: 'Social',
  Paid: 'Paid',
  Product: 'Product',
}

const effortChip: Record<GrowthActionItem['effort'], string> = {
  low: 'bg-success-bg text-success',
  medium: 'bg-amber-500/10 text-warning',
  high: 'bg-divider text-muted',
}

const effortLabel: Record<GrowthActionItem['effort'], string> = {
  low: 'Low effort',
  medium: 'Med effort',
  high: 'High effort',
}

function tasksKey(projectId: string): string {
  return `growth-tasks-${projectId}`
}

function playbookKey(projectId: string): string {
  return `playbook-${projectId}`
}

export function GrowthActions({ projectId, actions, playbookSteps }: GrowthActionsProps): JSX.Element {
  const router = useRouter()
  const [taskIds, setTaskIds] = useState<string[]>([])
  const [playbookDone, setPlaybookDone] = useState<boolean[]>([])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = sessionStorage.getItem(tasksKey(projectId))
      if (raw) setTaskIds(JSON.parse(raw) as string[])
    } catch {
      setTaskIds([])
    }
    try {
      const raw = localStorage.getItem(playbookKey(projectId))
      if (raw) {
        const parsed = JSON.parse(raw) as boolean[]
        setPlaybookDone(playbookSteps.map((_, i) => parsed[i] ?? false))
        return
      }
    } catch {
      /* ignore */
    }
    setPlaybookDone(playbookSteps.map(() => false))
  }, [projectId, playbookSteps])

  useEffect(() => {
    if (typeof window === 'undefined') return
    sessionStorage.setItem(tasksKey(projectId), JSON.stringify(taskIds))
  }, [projectId, taskIds])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(playbookKey(projectId), JSON.stringify(playbookDone))
  }, [projectId, playbookDone])

  const addTask = (id: string): void => {
    if (taskIds.includes(id)) return
    setTaskIds((t) => [...t, id])
    toast.success('Added to tasks')
  }

  const totalPlaybook = playbookSteps.length
  const doneCount = playbookDone.filter(Boolean).length
  const pct = totalPlaybook ? Math.round((doneCount / totalPlaybook) * 100) : 0

  const markLaunched = useCallback(async () => {
    await updateProject(projectId, { status: 'launched' })
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (!reduce) {
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.7 }, colors: ['#8B6F47', '#16A34A'] })
    }
    toast.success('Project marked as launched')
    router.push('/dashboard')
  }, [projectId, router])

  const ring = useMemo(
    () => (
      <div className="relative flex h-[72px] w-[72px] shrink-0 items-center justify-center">
        <svg width="72" height="72" viewBox="0 0 72 72" className="absolute inset-0">
          <circle cx="36" cy="36" r="30" fill="none" stroke="#D0C8C0" strokeWidth="8" />
          <circle
            cx="36"
            cy="36"
            r="30"
            fill="none"
            stroke="#8B6F47"
            strokeWidth="8"
            strokeDasharray={`${(pct / 100) * 188.5} 188.5`}
            transform="rotate(-90 36 36)"
          />
        </svg>
        <span className="relative text-[11px] font-semibold text-heading">{pct}%</span>
      </div>
    ),
    [pct],
  )

  return (
    <aside className="flex h-full w-[280px] shrink-0 flex-col border-l border-divider bg-card">
      <div className="border-b border-divider p-4">
        <h2 className="font-display text-base text-heading inline-flex items-center gap-2">Growth Actions <TrendingUp className="w-4 h-4 text-muted" /></h2>
        <p className="mt-1 text-xs text-muted">AI-generated recommendations</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {actions.map((a) => (
          <div key={a.id} className="mb-2 rounded-card bg-bg p-3">
            <p className="text-sm font-medium text-heading">{a.title}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`rounded-chip px-2 py-0.5 text-[10px] font-medium inline-flex items-center gap-1 ${channelChip[a.channel]}`}>
                {(() => { const Icon = channelIcon[a.channel]; return <Icon className="w-3 h-3" />; })()}
                {channelLabel[a.channel]}
              </span>
              <span className={`rounded-chip px-2 py-0.5 text-[10px] font-medium ${effortChip[a.effort]}`}>
                {effortLabel[a.effort]}
              </span>
            </div>
            <button
              type="button"
              data-testid={`add-task-${a.id}`}
              onClick={() => addTask(a.id)}
              className="mt-2 h-7 w-full rounded-chip border border-brand text-xs font-medium text-brand hover:bg-brand/10"
            >
              + Add to tasks
            </button>
          </div>
        ))}

        {taskIds.length ? (
          <div className="mb-4 rounded-card border border-divider bg-card p-3">
            <p className="text-xs font-medium uppercase text-muted">Task list</p>
            <ul className="mt-2 space-y-1 text-sm text-heading">
              {taskIds.map((id) => (
                <li key={id} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                  {actions.find((a) => a.id === id)?.title ?? id}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <details className="rounded-card border border-divider bg-bg p-3" open>
          <summary className="cursor-pointer text-sm font-medium text-heading inline-flex items-center gap-1"><Target className="w-3.5 h-3.5 text-muted" /> First 100 Users Playbook</summary>
          <div className="mt-3 flex gap-3">
            {ring}
            <ul className="min-w-0 flex-1 space-y-2">
              {playbookSteps.map((step, i) => {
                const done = playbookDone[i] ?? false
                return (
                  <label key={step} className={cn('flex cursor-pointer gap-2 text-sm', done && 'text-muted line-through')}>
                    <Checkbox.Root
                      className="mt-0.5 flex h-4 w-4 items-center justify-center rounded border border-divider bg-card data-[state=checked]:bg-success data-[state=checked]:text-white"
                      checked={done}
                      onCheckedChange={(v) => {
                        const checked = v === true
                        setPlaybookDone((prev) => {
                          const next = [...(prev.length ? prev : playbookSteps.map(() => false))]
                          next[i] = checked
                          return next
                        })
                      }}
                    >
                      <Checkbox.Indicator>
                        <Check className="h-3 w-3" />
                      </Checkbox.Indicator>
                    </Checkbox.Root>
                    <span>{done ? <Check className="w-3 h-3 inline text-success" /> : null}{step}</span>
                  </label>
                )
              })}
            </ul>
          </div>
        </details>
      </div>
      <div className="border-t border-divider p-4">
        <button
          type="button"
          data-testid="mark-launched-btn"
          onClick={() => void markLaunched()}
          className="flex h-11 w-full items-center justify-center rounded-md bg-success text-sm font-semibold text-white hover:brightness-95"
        >
          <Rocket className="w-4 h-4" /> Mark as Launched
        </button>
      </div>
    </aside>
  )
}
