'use client'

import { Handshake, Save } from 'lucide-react'
import { useMemo, useState } from 'react'

import { submitCopilotPreferences } from '@/api/agents.api'

interface CopilotQuestionCardProps {
  projectId: string
  phase: number
  episodicMemory?: {
    scale?: string
    platform?: string
    architecture?: string
    brandFeel?: string
  }
  onSubmit: () => void
}

export function CopilotQuestionCard({
  projectId,
  phase,
  episodicMemory,
  onSubmit,
}: CopilotQuestionCardProps): JSX.Element {
  const [scale, setScale] = useState(episodicMemory?.scale ?? 'MVP')
  const [platform, setPlatform] = useState(episodicMemory?.platform ?? 'Web')
  const [primaryColor, setPrimaryColor] = useState('#8B6F47')
  const [architecture, setArchitecture] = useState(episodicMemory?.architecture ?? 'Serverless')
  const [brandFeel, setBrandFeel] = useState(episodicMemory?.brandFeel ?? 'Professional')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const memorySet = useMemo(
    () => ({
      scale: Boolean(episodicMemory?.scale),
      platform: Boolean(episodicMemory?.platform),
      architecture: Boolean(episodicMemory?.architecture),
      brandFeel: Boolean(episodicMemory?.brandFeel),
    }),
    [episodicMemory],
  )

  const doSubmit = async (): Promise<void> => {
    setIsSubmitting(true)
    try {
      await submitCopilotPreferences(projectId, { scale, platform, primaryColor, architecture, brandFeel })
      onSubmit()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto mt-5 max-w-[480px] rounded-card border border-divider bg-card p-6 shadow-md">
      <p className="font-display text-base font-bold text-heading inline-flex items-center gap-1"><Handshake className="w-4 h-4 text-muted" /> Quick question before Phase {phase + 1}</p>
      <p className="mt-1 text-xs text-muted">Your answers guide the AI agents.</p>

      <div className="mt-4 space-y-4 text-sm">
        <fieldset aria-label="scale">
          <legend className="mb-2 text-xs font-semibold text-heading">How big are you thinking?</legend>
          <div className="grid grid-cols-3 gap-2">
            {['MVP', 'Small SaaS', 'Production-ready'].map((option) => (
              <label key={option} className={`cursor-pointer rounded-md border px-2 py-2 text-xs ${scale === option ? 'border-brand bg-brand/10' : 'border-divider'}`}>
                <input className="sr-only" type="radio" name="scale" checked={scale === option} onChange={() => setScale(option)} />
                {option}
                {memorySet.scale && episodicMemory?.scale === option ? <span className="ml-1 text-[10px]"><Save className="w-3 h-3 inline text-muted" /> From last project</span> : null}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset aria-label="platform">
          <legend className="mb-2 text-xs font-semibold text-heading">Primary platform?</legend>
          <div className="grid grid-cols-3 gap-2">
            {['Web', 'Mobile', 'Both'].map((option) => (
              <label key={option} className={`cursor-pointer rounded-md border px-2 py-2 text-xs ${platform === option ? 'border-brand bg-brand/10' : 'border-divider'}`}>
                <input className="sr-only" type="radio" name="platform" checked={platform === option} onChange={() => setPlatform(option)} />
                {option}
                {memorySet.platform && episodicMemory?.platform === option ? <span className="ml-1 text-[10px]"><Save className="w-3 h-3 inline text-muted" /> From last project</span> : null}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="color-picker" className="mb-2 block text-xs font-semibold text-heading">
            Brand color?
          </label>
          <div className="flex items-center gap-3">
            <input
              id="color-picker"
              aria-label="color"
              type="color"
              value={primaryColor}
              onChange={(event) => setPrimaryColor(event.target.value)}
              className="h-10 w-10 cursor-pointer rounded-full border-0 p-0"
            />
            <span className="text-xs text-muted">{primaryColor}</span>
          </div>
        </div>

        <div>
          <label htmlFor="architecture" className="mb-2 block text-xs font-semibold text-heading">
            Backend preference?
          </label>
          <select
            id="architecture"
            className="h-10 w-full rounded-md border border-divider bg-card px-3 text-sm"
            value={architecture}
            onChange={(event) => setArchitecture(event.target.value)}
          >
            <option>Serverless</option>
            <option>Monolith</option>
            <option>Microservices</option>
          </select>
          {memorySet.architecture ? <span className="mt-1 inline-block text-[10px]"><Save className="w-3 h-3 inline text-muted" /> From last project</span> : null}
        </div>

        <fieldset aria-label="brandFeel">
          <legend className="mb-2 text-xs font-semibold text-heading">Brand personality?</legend>
          <div className="grid grid-cols-2 gap-2">
            {['Professional', 'Playful', 'Minimal', 'Bold'].map((option) => (
              <label key={option} className={`cursor-pointer rounded-md border px-2 py-2 text-xs ${brandFeel === option ? 'border-brand bg-brand/10' : 'border-divider'}`}>
                <input className="sr-only" type="radio" name="brandFeel" checked={brandFeel === option} onChange={() => setBrandFeel(option)} />
                {option}
                {memorySet.brandFeel && episodicMemory?.brandFeel === option ? <span className="ml-1 text-[10px]"><Save className="w-3 h-3 inline text-muted" /> From last project</span> : null}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <button
        type="button"
        disabled={isSubmitting}
        onClick={() => void doSubmit()}
        className="mt-5 h-12 w-full rounded-md bg-brand text-sm font-semibold text-white disabled:opacity-60"
      >
        Continue to Phase {phase + 1} →
      </button>
      <button type="button" onClick={onSubmit} className="mt-2 w-full text-xs text-muted underline">
        Skip for now →
      </button>
    </div>
  )
}
