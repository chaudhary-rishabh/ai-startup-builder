'use client'

import { Check, ChevronDown, ChevronUp, Loader2, Plus, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'

import { useInlineEdit } from '@/hooks/useInlineEdit'
import type { MoSCoWFeature } from '@/types'

interface FeatureListProps {
  projectId: string
  features: MoSCoWFeature[]
  isStreaming: boolean
  streamedText?: string
  onFeatureAdd: (feature: Omit<MoSCoWFeature, 'id'>) => void
}

function SaveIndicator({ saveStatus }: { saveStatus: 'idle' | 'saving' | 'saved' | 'error' }): JSX.Element | null {
  if (saveStatus === 'idle') return null
  if (saveStatus === 'saving') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-warning">
        <Loader2 size={12} className="animate-spin" aria-label="Saving" />
        Saving…
      </span>
    )
  }
  if (saveStatus === 'saved') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-success">
        <Check size={12} aria-label="Saved" />
        Saved ✓
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-error" title="Save failed. Click to retry.">
      <XCircle size={12} /> Failed to save
    </span>
  )
}

const priorities: Array<MoSCoWFeature['priority']> = ['Must', 'Should', 'Could', 'Wont']

const priorityChipClasses: Record<MoSCoWFeature['priority'], string> = {
  Must: 'border border-error/20 bg-error/10 text-error',
  Should: 'border border-warning/20 bg-warning/10 text-warning',
  Could: 'border border-info/20 bg-info/10 text-info',
  Wont: 'border border-divider bg-divider text-muted',
}

function FeatureCard({
  projectId,
  feature,
  featureIndex,
  isOpen,
  criteria,
  onToggle,
  onCriteriaChange,
}: {
  projectId: string
  feature: MoSCoWFeature
  featureIndex: number
  isOpen: boolean
  criteria: boolean[]
  onToggle: () => void
  onCriteriaChange: (next: boolean[]) => void
}): JSX.Element {
  const pathBase = `prd.features[${featureIndex}]`
  const nameEdit = useInlineEdit({
    projectId,
    phase: 2,
    field: `${pathBase}.name`,
    initialValue: feature.name,
  })
  const descriptionEdit = useInlineEdit({
    projectId,
    phase: 2,
    field: `${pathBase}.description`,
    initialValue: feature.description,
  })

  return (
    <div className="rounded-chip border border-divider bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span {...nameEdit.contentEditableProps} className="text-[13px] font-medium text-heading">
            {nameEdit.value}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${priorityChipClasses[feature.priority]}`}>
            {feature.priority}
          </span>
          <SaveIndicator saveStatus={nameEdit.saveStatus} />
        </div>
        <button type="button" aria-label="Expand feature details" onClick={onToggle}>
          {isOpen ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
        </button>
      </div>

      {isOpen ? (
        <div className="mt-3 space-y-2">
          <p {...descriptionEdit.contentEditableProps} className="text-xs text-muted">
            {descriptionEdit.value}
          </p>
          <SaveIndicator saveStatus={descriptionEdit.saveStatus} />

          {feature.userStories?.length ? (
            <div className="space-y-1">
              {feature.userStories.map((story) => (
                <div key={story.id} className="rounded-md bg-bg px-2 py-1 text-[11px] italic text-muted">
                  As a {story.role}, I want {story.want}, so that {story.soThat}
                </div>
              ))}
            </div>
          ) : null}

          {feature.acceptanceCriteria?.length ? (
            <div className="space-y-1">
              {feature.acceptanceCriteria.map((item, criteriaIndex) => {
                const checked = criteria[criteriaIndex] ?? true
                return (
                  <label key={item} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        const next = [...criteria]
                        next[criteriaIndex] = event.target.checked
                        onCriteriaChange(next)
                      }}
                    />
                    <span className={checked ? 'line-through text-success' : 'text-slate-700'}>{item}</span>
                  </label>
                )
              })}
            </div>
          ) : null}

          <button type="button" className="inline-flex items-center gap-1 text-xs text-muted hover:text-brand">
            <Plus size={12} />
            Add Story
          </button>
        </div>
      ) : null}
    </div>
  )
}

export function FeatureList({
  projectId,
  features,
  isStreaming,
  streamedText,
  onFeatureAdd,
}: FeatureListProps): JSX.Element {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [criteriaState, setCriteriaState] = useState<Record<string, boolean[]>>({})
  const [modalOpen, setModalOpen] = useState(false)
  const [newFeatureName, setNewFeatureName] = useState('')
  const [newFeaturePriority, setNewFeaturePriority] = useState<MoSCoWFeature['priority']>('Must')
  const [newFeatureDescription, setNewFeatureDescription] = useState('')

  const grouped = useMemo(
    () =>
      priorities.map((priority) => ({
        priority,
        label: priority === 'Wont' ? "Won't Have" : `${priority} Have`,
        features: features
          .map((feature, index) => ({ feature, index }))
          .filter((entry) => entry.feature.priority === priority),
      })).filter((section) => section.features.length > 0),
    [features],
  )

  if (isStreaming) {
    return (
      <div className="rounded-card bg-card p-4 text-sm text-slate-700">
        {streamedText}
        <span className="ml-1 inline-block animate-pulse">|</span>
      </div>
    )
  }

  return (
    <section className="space-y-4">
      {grouped.map((section) => (
        <article key={section.priority}>
          <header className="mb-2 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-heading">{section.label}</h3>
            <span className="rounded-full bg-output px-2 py-0.5 text-[11px] text-muted">{section.features.length}</span>
          </header>
          <div className="space-y-2">
            {section.features.map(({ feature, index }) => {
              const isOpen = expanded[feature.id] ?? false
              const criteria = criteriaState[feature.id] ?? feature.acceptanceCriteria?.map(() => true) ?? []

              return (
                <FeatureCard
                  key={feature.id}
                  projectId={projectId}
                  feature={feature}
                  featureIndex={index}
                  isOpen={isOpen}
                  criteria={criteria}
                  onToggle={() => setExpanded((prev) => ({ ...prev, [feature.id]: !isOpen }))}
                  onCriteriaChange={(next) => setCriteriaState((prev) => ({ ...prev, [feature.id]: next }))}
                />
              )
            })}
          </div>
        </article>
      ))}

      <button
        type="button"
        className="inline-flex h-9 items-center gap-1 rounded-md border border-brand px-3 text-sm text-brand"
        onClick={() => setModalOpen(true)}
      >
        <Plus size={12} /> Add Feature
      </button>

      {modalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-card bg-card p-4">
            <h4 className="text-sm font-semibold text-heading">Add Feature</h4>
            <div className="mt-3 space-y-2">
              <input
                className="h-9 w-full rounded-md border border-divider px-3 text-sm"
                placeholder="Feature name"
                value={newFeatureName}
                onChange={(event) => setNewFeatureName(event.target.value)}
              />
              <select
                className="h-9 w-full rounded-md border border-divider px-3 text-sm"
                value={newFeaturePriority}
                onChange={(event) => setNewFeaturePriority(event.target.value as MoSCoWFeature['priority'])}
              >
                {priorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
              <textarea
                className="h-20 w-full rounded-md border border-divider px-3 py-2 text-sm"
                placeholder="Description"
                value={newFeatureDescription}
                onChange={(event) => setNewFeatureDescription(event.target.value)}
              />
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button type="button" className="text-xs text-muted" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white"
                onClick={() => {
                  if (!newFeatureName.trim()) return
                  onFeatureAdd({
                    name: newFeatureName.trim(),
                    priority: newFeaturePriority,
                    description: newFeatureDescription.trim(),
                    acceptanceCriteria: [],
                    userStories: [],
                  })
                  setModalOpen(false)
                  setNewFeatureName('')
                  setNewFeatureDescription('')
                }}
              >
                Save Feature
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
