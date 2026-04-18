'use client'

import Link from 'next/link'
import { AlertOctagon, AlertTriangle, X } from 'lucide-react'

import { useUIStore } from '@/store/uiStore'

export function TokenBudgetBanner(): JSX.Element | null {
  const tokenWarning = useUIStore((state) => state.tokenWarning)
  const setTokenWarning = useUIStore((state) => state.setTokenWarning)

  if (!tokenWarning) {
    return null
  }

  const isHighRisk = tokenWarning.percentUsed === 95

  return (
    <div
      className="sticky top-0 z-50 w-full border-b px-4 py-3"
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
