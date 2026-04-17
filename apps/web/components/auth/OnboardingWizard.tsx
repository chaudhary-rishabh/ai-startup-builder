'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import * as Select from '@radix-ui/react-select'

import api from '@/lib/axios'

const emojis = ['🚀', '💡', '🛒', '🏥', '📚', '🎵', '🏋️', '🌱', '🔧', '💰', '🎮', '✈️']

interface IdeaDraft {
  projectName: string
  description: string
  emoji: string
}

export function OnboardingWizard(): JSX.Element {
  const searchParams = useSearchParams()
  const requestedStep = Number(searchParams.get('step') ?? 1)
  const initialStep = Number.isFinite(requestedStep) ? Math.min(3, Math.max(1, requestedStep)) : 1
  const [step, setStep] = useState(initialStep)
  const [name, setName] = useState('')
  const [role, setRole] = useState<'FOUNDER' | 'DESIGNER' | 'DEVELOPER' | 'OTHER'>('FOUNDER')
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [ideaDraft, setIdeaDraft] = useState<IdeaDraft>({ projectName: '', description: '', emoji: '🚀' })
  const router = useRouter()

  const stepLabels = useMemo(() => ['Profile', 'Your Idea', 'Choose Plan'], [])

  const skipToDashboard = (): void => {
    window.location.assign('/dashboard')
  }

  const submitProfile = async (): Promise<void> => {
    try {
      await api.patch('/users/profile', { name, role, timezone, onboardingDone: false })
    } finally {
      setStep(2)
    }
  }

  const continueIdea = (): void => {
    setStep(3)
  }

  const selectPlan = async (plan: 'free' | 'pro' | 'team'): Promise<void> => {
    if (plan === 'free') {
      if (ideaDraft.projectName.trim()) {
        const projectRes = await api.post<{ data: { id: string } }>('/projects', {
          name: ideaDraft.projectName,
          description: ideaDraft.description || null,
          emoji: ideaDraft.emoji,
          buildMode: 'copilot',
        })
        await api.patch('/users/profile', { onboardingDone: true })
        router.push(`/project/${projectRes.data.data.id}/validate`)
        return
      }
      await api.patch('/users/profile', { onboardingDone: true })
      router.push('/dashboard')
      return
    }

    const checkoutRes = await api.post<{ data: { checkoutUrl: string } }>('/billing/checkout', {
      plan,
      billingCycle,
    })
    window.location.href = checkoutRes.data.data.checkoutUrl
  }

  return (
    <section className="min-h-screen bg-bg px-4 py-10">
      <div className="mx-auto max-w-2xl rounded-panel bg-card p-6 shadow-card">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex w-full items-start justify-between gap-3">
            {stepLabels.map((label, index) => {
              const indexStep = index + 1
              const complete = indexStep < step
              const active = indexStep === step
              return (
                <div key={label} className="flex flex-1 flex-col items-center">
                  <div className="mb-2 flex w-full items-center gap-2">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                        complete
                          ? 'bg-success text-white'
                          : active
                            ? 'bg-brand text-white'
                            : 'border border-divider bg-bg text-muted'
                      }`}
                    >
                      {complete ? '✓' : indexStep}
                    </span>
                    {index < stepLabels.length - 1 ? (
                      <span className={`h-0.5 flex-1 ${indexStep < step ? 'bg-brand' : 'bg-divider'}`} />
                    ) : null}
                  </div>
                  <p className="text-xs text-muted">{label}</p>
                </div>
              )
            })}
          </div>
          <a href="/dashboard" onClick={skipToDashboard} className="ml-4 text-xs text-muted underline">
            Skip
          </a>
        </div>

        {step === 1 ? (
          <div className="space-y-4">
            <h1 className="font-display text-[20px] font-bold text-heading">Tell us about yourself</h1>
            <p className="text-sm text-muted">Help us personalise your experience</p>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-11 w-full rounded-md border border-divider bg-card px-3 text-sm"
              placeholder="Your full name"
            />
            <Select.Root value={role} onValueChange={(value) => setRole(value as typeof role)}>
              <Select.Trigger className="flex h-11 w-full items-center justify-between rounded-md border border-divider bg-card px-3 text-sm">
                <Select.Value />
                <Select.Icon>▾</Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Content className="z-50 rounded-md border border-divider bg-card p-1 shadow-md">
                  <Select.Viewport>
                    <Select.Item value="FOUNDER" className="cursor-pointer rounded px-3 py-2 text-sm">
                      <Select.ItemText>Founder</Select.ItemText>
                    </Select.Item>
                    <Select.Item value="DESIGNER" className="cursor-pointer rounded px-3 py-2 text-sm">
                      <Select.ItemText>Designer</Select.ItemText>
                    </Select.Item>
                    <Select.Item value="DEVELOPER" className="cursor-pointer rounded px-3 py-2 text-sm">
                      <Select.ItemText>Developer</Select.ItemText>
                    </Select.Item>
                    <Select.Item value="OTHER" className="cursor-pointer rounded px-3 py-2 text-sm">
                      <Select.ItemText>Other</Select.ItemText>
                    </Select.Item>
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
            <input
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              className="h-11 w-full rounded-md border border-divider bg-card px-3 text-sm"
            />
            <button
              type="button"
              onClick={submitProfile}
              className="h-12 w-full rounded-md bg-brand text-sm font-semibold text-white transition hover:brightness-90"
            >
              Continue →
            </button>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <h1 className="font-display text-[20px] font-bold text-heading">What are you building?</h1>
            <p className="text-sm text-muted">
              We&apos;ll use this to set up your first project. You can skip this and add it later.
            </p>
            <input
              value={ideaDraft.projectName}
              onChange={(event) => setIdeaDraft((prev) => ({ ...prev, projectName: event.target.value }))}
              className="h-10 w-full rounded-md border border-divider bg-card px-3 text-sm"
              placeholder="RestaurantIQ, HealthAI Coach, etc."
            />
            <textarea
              value={ideaDraft.description}
              onChange={(event) => setIdeaDraft((prev) => ({ ...prev, description: event.target.value }))}
              className="h-[120px] w-full rounded-md border border-divider bg-card px-3 py-2 text-sm"
              placeholder="Describe your startup idea in 2-3 sentences..."
            />
            <div className="flex flex-wrap gap-2">
              {emojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIdeaDraft((prev) => ({ ...prev, emoji }))}
                  className={`h-9 w-9 rounded-full border text-lg transition ${
                    ideaDraft.emoji === emoji ? 'scale-110 border-brand bg-sidebar' : 'border-divider bg-card'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={continueIdea}
              className="h-12 w-full rounded-md bg-brand text-sm font-semibold text-white transition hover:brightness-90"
            >
              Continue →
            </button>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-5">
            <div>
              <h1 className="font-display text-[20px] font-bold text-heading">Choose your plan</h1>
              <p className="text-sm text-muted">Start free and upgrade any time</p>
            </div>
            <div className="inline-flex rounded-full border border-divider bg-output p-1">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`rounded-full px-4 py-1 text-xs ${billingCycle === 'monthly' ? 'bg-brand text-white' : 'text-heading'}`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('yearly')}
                className={`rounded-full px-4 py-1 text-xs ${billingCycle === 'yearly' ? 'bg-brand text-white' : 'text-heading'}`}
              >
                Yearly
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <article className="rounded-card border border-divider p-4">
                <h2 className="text-sm font-semibold">FREE</h2>
                <p className="mt-1 text-lg font-semibold">$0 / month</p>
                <p className="mt-2 text-xs text-muted">50K tokens/month, 3 projects, Phases 1-2 only</p>
                <button
                  type="button"
                  onClick={() => selectPlan('free')}
                  className="mt-4 h-10 w-full rounded-md border border-brand text-sm font-semibold text-brand"
                >
                  Get Started Free
                </button>
              </article>
              <article className="relative rounded-card border border-brand p-4">
                <span className="absolute -top-2 right-3 rounded-chip bg-brand px-2 py-1 text-[10px] font-semibold uppercase text-white">
                  Most popular
                </span>
                <h2 className="text-sm font-semibold">PRO</h2>
                <p className="mt-1 text-lg font-semibold">$29 / month</p>
                <p className="text-xs text-muted">$290 / year (save 17%)</p>
                <p className="mt-2 text-xs text-muted">500K tokens/month, 20 projects, all 6 phases</p>
                <button
                  type="button"
                  onClick={() => selectPlan('pro')}
                  className="mt-4 h-10 w-full rounded-md bg-brand text-sm font-semibold text-white"
                >
                  Start Pro →
                </button>
              </article>
              <article className="rounded-card border border-divider p-4">
                <h2 className="text-sm font-semibold">TEAM</h2>
                <p className="mt-1 text-lg font-semibold">$99 / month</p>
                <p className="mt-2 text-xs text-muted">2M tokens/month, unlimited projects</p>
                <button
                  type="button"
                  onClick={() => selectPlan('team')}
                  className="mt-4 h-10 w-full rounded-md border border-brand text-sm font-semibold text-brand"
                >
                  Contact Sales
                </button>
              </article>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
