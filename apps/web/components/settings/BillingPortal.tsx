'use client'

import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PlanBadge, TokenUsageBar } from '@repo/ui'
import { useState } from 'react'
import { toast } from 'sonner'

import {
  cancelSubscription,
  createCheckoutSession,
  createPortalSession,
  getInvoices,
  getPlans,
  getSubscription,
  getTokenBudget,
} from '@/api/billing.api'

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100)
}

export function BillingPortal(): JSX.Element {
  const queryClient = useQueryClient()
  const [cancelOpen, setCancelOpen] = useState(false)

  const budgetQuery = useQuery({ queryKey: ['token-budget'], queryFn: getTokenBudget })
  const subQuery = useQuery({ queryKey: ['billing-subscription'], queryFn: getSubscription })
  const invoicesQuery = useQuery({ queryKey: ['billing-invoices'], queryFn: getInvoices })
  const plansQuery = useQuery({ queryKey: ['billing-plans'], queryFn: getPlans })

  const cancelMut = useMutation({
    mutationFn: cancelSubscription,
    onSuccess: async () => {
      setCancelOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['billing-subscription'] })
      toast.success('Subscription will cancel at period end')
    },
  })

  const budget = budgetQuery.data
  const sub = subQuery.data
  const invoices = invoicesQuery.data ?? []
  const plans = plansQuery.data ?? []

  const badgePlan: 'free' | 'pro' | 'enterprise' =
    sub?.planTier === 'free' ? 'free' : sub?.planTier === 'enterprise' ? 'enterprise' : 'pro'

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl text-heading">Billing</h1>

      {sub ? (
        <div className="rounded-card border border-divider bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <PlanBadge plan={badgePlan} />
            <div>
              <p className="font-display text-xl text-heading capitalize">{sub.planTier} plan</p>
              <p className="text-xs text-muted">
                {sub.cancelAtPeriodEnd
                  ? `Cancels ${new Date(sub.currentPeriodEnd).toLocaleDateString()}`
                  : `Renews ${new Date(sub.currentPeriodEnd).toLocaleDateString()}`}
              </p>
            </div>
            <span
              className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${
                sub.status === 'active' ? 'bg-success-bg text-success' : sub.status === 'past_due' ? 'bg-amber-500/15 text-amber-700' : 'bg-error/10 text-error'
              }`}
            >
              {sub.status === 'active' ? 'Active' : sub.status === 'past_due' ? 'Past Due' : 'Cancelled'}
            </span>
          </div>
        </div>
      ) : null}

      {budget ? (
        <div className="rounded-card border border-divider bg-card p-6 shadow-sm">
          <p className="text-sm font-medium text-heading">
            Token Usage — {budget.currentMonth}
          </p>
          <div className="mt-3">
            <TokenUsageBar used={budget.tokensUsed} limit={budget.tokensLimit} />
          </div>
          <p className="mt-2 text-xs text-muted">
            {budget.tokensUsed.toLocaleString()} / {budget.tokensLimit.toLocaleString()} tokens · Resets {new Date(budget.resetAt).toLocaleDateString()}
          </p>
        </div>
      ) : null}

      <div>
        <h2 className="font-display text-lg text-heading">Upgrade</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {plans.map((plan) => {
            const current = plan.tier === sub?.planTier
            return (
              <div
                key={plan.tier}
                className={`rounded-card border bg-card p-4 shadow-sm ${current ? 'border-brand ring-1 ring-brand' : 'border-divider'}`}
              >
                <p className="font-display text-lg text-heading">{plan.name}</p>
                <p className="mt-1 text-sm text-muted">
                  ${(plan.price.monthly / 100).toFixed(0)}/mo · {plan.tokenLimit.toLocaleString()} tokens
                </p>
                <ul className="mt-2 list-inside list-disc text-xs text-muted">
                  {plan.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                {current ? (
                  <p className="mt-3 text-xs font-medium text-brand">Current plan</p>
                ) : (
                  <button
                    type="button"
                    className="mt-3 w-full rounded-md border border-brand py-2 text-sm font-medium text-brand hover:bg-brand/10"
                    onClick={async () => {
                      const { checkoutUrl } = await createCheckoutSession({ planTier: plan.tier, billingCycle: 'monthly' })
                      window.open(checkoutUrl, '_blank', 'noopener,noreferrer')
                    }}
                  >
                    Upgrade
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <h2 className="font-display text-lg text-heading">Billing history</h2>
        {invoices.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No invoices yet</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-card border border-divider">
            <table className="w-full text-left text-sm">
              <thead className="bg-bg text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Amount</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Invoice</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-t border-divider">
                    <td className="px-4 py-2 text-muted">{new Date(inv.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-2 text-heading">{formatMoney(inv.amount, inv.currency)}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          inv.status === 'paid' ? 'bg-success-bg text-success' : 'bg-amber-500/15 text-amber-700'
                        }`}
                      >
                        {inv.status === 'paid' ? 'Paid' : 'Open'}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <a href={inv.invoiceUrl} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                        PDF ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          data-testid="manage-billing-btn"
          className="rounded-md border border-brand px-4 py-2 text-sm font-medium text-brand hover:bg-brand/10"
          onClick={async () => {
            const { portalUrl } = await createPortalSession()
            window.open(portalUrl, '_blank', 'noopener,noreferrer')
          }}
        >
          Manage Billing →
        </button>
        <button type="button" className="text-xs text-muted underline" onClick={() => setCancelOpen(true)}>
          Cancel Plan
        </button>
      </div>

      <AlertDialog.Root open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(400px,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-panel border border-divider bg-card p-6 shadow-lg">
            <AlertDialog.Title className="text-heading">Cancel subscription?</AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm text-muted">Your plan will remain active until the end of the billing period.</AlertDialog.Description>
            <div className="mt-4 flex justify-end gap-2">
              <AlertDialog.Cancel className="rounded-md border border-divider px-3 py-2 text-sm">Back</AlertDialog.Cancel>
              <AlertDialog.Action className="rounded-md bg-error px-3 py-2 text-sm font-medium text-white" onClick={() => void cancelMut.mutateAsync()}>
                Confirm cancel
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  )
}
