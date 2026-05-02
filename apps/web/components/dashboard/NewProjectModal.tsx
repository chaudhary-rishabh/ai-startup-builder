'use client'

import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  BookOpen,
  Building2,
  DollarSign,
  Gamepad2,
  HardDrive,
  Lightbulb,
  Music,
  Plane,
  Rocket,
  ShoppingCart,
  Sprout,
  Dumbbell,
  Wrench,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { BuildModeSelector } from '@/components/dashboard/BuildModeSelector'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { getPhaseRoute } from '@/api/projects.api'
import { useCreateProject, useProjects } from '@/hooks/useProjects'
import type { BuildMode } from '@/types'

const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100),
  description: z.string().max(500).optional(),
  emoji: z.string().min(1),
  buildMode: z.enum(['autopilot', 'copilot', 'manual']),
})

type ProjectFormValues = z.infer<typeof projectSchema>

const projectIconOptions: { emoji: string; icon: LucideIcon }[] = [
  { emoji: '🚀', icon: Rocket },
  { emoji: '💡', icon: Lightbulb },
  { emoji: '🛒', icon: ShoppingCart },
  { emoji: '🏥', icon: Building2 },
  { emoji: '📚', icon: BookOpen },
  { emoji: '🎵', icon: Music },
  { emoji: '🏋️', icon: Dumbbell },
  { emoji: '🌱', icon: Sprout },
  { emoji: '🔧', icon: Wrench },
  { emoji: '💰', icon: DollarSign },
  { emoji: '🎮', icon: Gamepad2 },
  { emoji: '✈️', icon: Plane },
]

interface NewProjectModalProps {
  open: boolean
  onClose: () => void
}

export function NewProjectModal({ open, onClose }: NewProjectModalProps): JSX.Element | null {
  const router = useRouter()
  const { mutateAsync, isPending } = useCreateProject()
  const { data } = useProjects({ status: 'active' })
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: '',
      description: '',
      emoji: '🚀',
      buildMode: 'copilot',
    },
  })

  useEffect(() => {
    if (!open) return
    const onEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [open, onClose])

  if (!open) return null

  const selectedEmoji = watch('emoji')
  const selectedBuildMode = watch('buildMode')

  const onSubmit = async (values: ProjectFormValues): Promise<void> => {
    const project = await mutateAsync({
      name: values.name,
      emoji: values.emoji,
      buildMode: values.buildMode,
      ...(values.description ? { description: values.description } : {}),
    })
    onClose()
    router.push(getPhaseRoute(project.id, 1))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-[calc(100%-2rem)] max-w-[50vw] min-w-[360px] rounded-panel bg-card p-8 shadow-lg sm:w-[50vw]">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-[20px] font-bold text-heading">Create New Project</h2>
          <button type="button" onClick={onClose} aria-label="Close modal" className="rounded p-1 hover:bg-output">
            <X size={16} />
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-wrap gap-2">
            {projectIconOptions.map(({ emoji, icon: Icon }) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setValue('emoji', emoji)}
                className={`rounded-full border p-2 transition ${
                  selectedEmoji === emoji ? 'scale-110 border-brand bg-divider' : 'border-divider bg-card hover:border-muted'
                }`}
                title={emoji}
              >
                <Icon className="w-5 h-5 text-muted" />
              </button>
            ))}
          </div>

          <div>
            <input
              {...register('name')}
              autoFocus
              className="h-11 w-full rounded-md border border-divider bg-card px-3 text-sm"
              placeholder="RestaurantIQ, HealthAI Coach, etc."
            />
            {errors.name ? <p className="mt-1 text-xs text-error">{errors.name.message}</p> : null}
          </div>

          <div>
            <textarea
              {...register('description')}
              className="h-20 w-full rounded-md border border-divider bg-card px-3 py-2 text-sm"
              placeholder="What are you building? (optional)"
            />
            {errors.description ? <p className="mt-1 text-xs text-error">{errors.description.message}</p> : null}
          </div>

          {data?.projects?.length ? (
            <div className="rounded-chip bg-divider px-3 py-1.5 text-xs text-heading">
              <HardDrive className="w-3.5 h-3.5 inline text-muted" /> Based on your previous projects: PostgreSQL · TypeScript · Production-ready
            </div>
          ) : null}

          <BuildModeSelector
            value={selectedBuildMode}
            onChange={(mode) => setValue('buildMode', mode as BuildMode, { shouldValidate: true })}
          />

          <button
            type="submit"
            disabled={isPending}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-brand text-sm font-semibold text-white transition hover:brightness-90 disabled:opacity-70"
          >
            {isPending ? <LoadingSpinner className="text-white" /> : null}
            Create Project →
          </button>
        </form>
      </div>
    </div>
  )
}
