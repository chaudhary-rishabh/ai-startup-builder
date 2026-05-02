'use client'

import { formatDistanceToNow } from 'date-fns'
import { MoreHorizontal, Star } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { getPhaseRoute } from '@/api/projects.api'
import { useDeleteProject, useStarProject } from '@/hooks/useProjects'
import type { Project } from '@/types'

const phaseStyles: Record<number, string> = {
  1: 'bg-violet-100 text-violet-700',
  2: 'bg-blue-100 text-blue-700',
  3: 'bg-purple-100 text-purple-700',
  4: 'bg-teal-100 text-teal-700',
  5: 'bg-amber-100 text-amber-700',
  6: 'bg-green-100 text-green-700',
}

const phaseLabels: Record<number, string> = {
  1: 'Validate',
  2: 'Plan',
  3: 'Design',
  4: 'Build',
  5: 'Deploy',
  6: 'Growth',
}

export function ProjectCard({ project }: { project: Project }): JSX.Element {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const { mutate: starMutate } = useStarProject()
  const { mutate: deleteMutate } = useDeleteProject()

  return (
    <article className="group relative rounded-card bg-card shadow-sm transition-shadow hover:shadow-md">
      {project.isStarred ? <Star className="absolute right-3 top-3 h-4 w-4 text-muted" /> : null}

      <div className="flex items-center justify-between border-b border-divider px-4 py-4">
        <h3 className="min-w-0 truncate text-sm font-medium text-heading">{project.name}</h3>
        <div className="flex items-center gap-2">
          <span className={`rounded-chip px-2 py-1 text-[10px] font-semibold ${phaseStyles[project.currentPhase]}`}>
            {phaseLabels[project.currentPhase]}
          </span>
          <button
            type="button"
            aria-label="Open project actions"
            onClick={() => setMenuOpen((current) => !current)}
            className="rounded p-1 text-muted opacity-100 transition group-hover:opacity-100"
          >
            <MoreHorizontal size={16} />
          </button>
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="grid grid-cols-6 gap-0.5 rounded-full bg-divider p-0.5">
          {Array.from({ length: 6 }).map((_, index) => {
            const phase = index + 1
            const complete = phase < project.currentPhase
            const active = phase === project.currentPhase
            return (
              <span
                key={phase}
                data-testid="progress-segment"
                className={`h-2 ${index === 0 ? 'rounded-l-full' : ''} ${index === 5 ? 'rounded-r-full' : ''} ${
                  complete ? 'bg-success' : active ? 'bg-brand' : 'bg-transparent'
                }`}
              />
            )
          })}
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-xs text-muted">Last edited {formatDistanceToNow(new Date(project.lastActiveAt), { addSuffix: true })}</p>
        <button
          type="button"
          onClick={() => router.push(getPhaseRoute(project.id, project.currentPhase))}
          className="h-8 rounded-chip border border-brand px-3 text-xs font-semibold text-brand"
        >
          Continue →
        </button>
      </div>

      {menuOpen ? (
        <div className="absolute right-3 top-10 z-10 w-40 rounded-md border border-divider bg-card p-1 shadow-md">
          <button className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-output">Rename</button>
          <button className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-output">Duplicate</button>
          <button
            className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-output"
            onClick={() => starMutate({ id: project.id, starred: !project.isStarred })}
          >
            {project.isStarred ? 'Unstar' : 'Star'}
          </button>
          <button className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-output">Archive</button>
          <button
            className="block w-full rounded px-2 py-1 text-left text-xs text-error hover:bg-output"
            onClick={() => setConfirmDeleteOpen(true)}
          >
            Delete
          </button>
        </div>
      ) : null}

      {confirmDeleteOpen ? (
        <div role="dialog" aria-label="Confirm delete" className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 p-3">
          <div className="w-full rounded-card bg-card p-3">
            <p className="text-xs text-heading">Delete &apos;{project.name}&apos;? This cannot be undone.</p>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className="rounded px-2 py-1 text-xs" onClick={() => setConfirmDeleteOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="rounded bg-error px-2 py-1 text-xs text-white"
                onClick={() => deleteMutate(project.id)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  )
}
