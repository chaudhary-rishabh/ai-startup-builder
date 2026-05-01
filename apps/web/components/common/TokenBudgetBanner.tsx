'use client'

import Link from 'next/link'
import { AlertOctagon, AlertTriangle, CreditCard, X } from 'lucide-react'

import { useCreditState } from '@/components/providers/CreditStateProvider'
import { useUIStore } from '@/store/uiStore'

export function TokenBudgetBanner(): JSX.Element | null {
  const tokenWarning = useUIStore((state) => state.tokenWarning)
  const setTokenWarning = useUIStore((state) => state.setTokenWarning)
  const { creditState, isOneTimeCredits, planTier, currentMonth, resetAt } = useCreditState()

  if (creditState === 'exhausted') {
    const resetLabel =
      resetAt != null && resetAt !== ''
        ? new Date(resetAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : null
    return (
      <div
        className="sticky top-0 z-[60] flex min-h-[48px] w-full flex-col justify-center border-b border-amber-300 bg-amber-100 px-4 py-2 md:h-12 md:flex-row md:items-center md:py-0"
        role="status"
      >
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-2 text-sm text-amber-950">
          <CreditCard className="w-4 h-4" />
          <span className="font-medium">
            {isOneTimeCredits
              ? 'Your 50,000 free credits have been used'
              : `Your ${planTier} credits for ${currentMonth || 'this period'} have been used.${
                  resetLabel ? ` Resets on ${resetLabel}.` : ''
                }`}
          </span>
          <span className="text-amber-900/90">· Your work is saved and accessible</span>
          <span className="ml-auto flex flex-wrap items-center gap-3">
            <Link
              href="/settings/billing#topup"
              className="font-semibold text-amber-950 underline underline-offset-2"
            >
              Add Credits from ₹199
            </Link>
            <Link href="/settings/billing" className="font-semibold text-amber-950 underline underline-offset-2">
              Upgrade Plan
            </Link>
          </span>
        </div>
      </div>
    )
  }

  if (!tokenWarning) {
    return null
  }

  const isHighRisk = tokenWarning.percentUsed === 95

  return (
    <div
      className="sticky top-0 z-[60] w-full border-b px-4 py-3"
      style={{
        backgroundColor: isHighRisk ? '#FEE2E2' : '#FEF3C7',
        borderBottomColor: isHighRisk ? '#DC2626' : '#D97706',
      }}
    >
      <div className="mx-auto flex max-w-6xl items-start gap-3 text-sm text-heading">
        {isHighRisk ? (
          <AlertOctagon className="mt-0.5 h-5 w-5 text-error" />
        ) : (
          <AlertTriangle className="mt-0.5 h-5 w-5 text-warning" />
        )}
        <div className="flex-1">
          {isHighRisk ? (
            <p>
              Warning: only 5% of tokens remaining this month. {tokenWarning.tokensRemaining.toLocaleString()} tokens
              left. Resets {tokenWarning.resetDate}.
            </p>
          ) : (
            <p>
              You&apos;ve used 80% of your plan tokens this month. {tokenWarning.tokensRemaining.toLocaleString()}{' '}
              tokens remaining. Resets {tokenWarning.resetDate}.
            </p>
          )}
          <div className="mt-1 flex gap-4">
            <Link href="/settings/billing" className="font-semibold underline underline-offset-2">
              {isHighRisk ? 'Upgrade now →' : 'Upgrade plan →'}
            </Link>
            {isHighRisk ? (
              <Link href="/settings/billing" className="font-semibold underline underline-offset-2">
                View usage →
              </Link>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          aria-label="Dismiss budget warning"
          onClick={() => setTokenWarning(null)}
          className="rounded p-1 hover:bg-black/5"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
