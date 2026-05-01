'use client'

import { CheckCircle2 } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

import { AuthCard } from '@/components/auth/AuthCard'
import { useUIStore } from '@/store/uiStore'

const featureBullets = [
  'Validate your idea in minutes',
  'AI-generated PRD, code, and deployment',
  'From idea to live product — guided step by step',
]

export default function LandingPage(): JSX.Element {
  const searchParams = useSearchParams()
  const addToast = useUIStore((state) => state.addToast)

  useEffect(() => {
    const redirectTarget = searchParams.get('redirect')
    if (redirectTarget && typeof window !== 'undefined') {
      sessionStorage.setItem('post_auth_redirect', redirectTarget)
    }
    if (searchParams.get('expired') === '1') {
      addToast({
        type: 'warning',
        title: 'Your session expired. Please sign in again.',
      })
    }
  }, [searchParams, addToast])

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <section className="hidden w-full bg-sidebar px-10 py-14 md:flex md:w-1/2 md:flex-col md:justify-between">
        <div>
          <p className="mb-8 font-display text-[15px] font-bold text-heading">AI Startup Builder</p>
          <h1 className="max-w-sm font-display text-[28px] font-bold leading-tight text-heading">
            Build your startup — idea to launch — in one AI workspace.
          </h1>
          <ul className="mt-8 space-y-4">
            {featureBullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-3 text-[14px] text-slate-600">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-6">
          <blockquote className="max-w-sm italic text-slate-600">
            &quot;Went from idea to MVP in 4 days. This replaced 6 tools.&quot;
          </blockquote>
          <p className="text-xs text-muted">— Sarah K., Founder</p>
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {['SK', 'AJ', 'MT'].map((initials) => (
                <div
                  key={initials}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-divider bg-bg text-[10px] font-bold text-heading"
                >
                  {initials}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted">Join 2,400+ founders</p>
          </div>
        </div>
      </section>
      <section className="flex w-full items-center justify-center bg-card px-4 py-8 md:w-1/2 md:px-8">
        <AuthCard />
      </section>
    </div>
  )
}
