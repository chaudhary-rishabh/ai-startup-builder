'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import * as Tabs from '@radix-ui/react-tabs'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import {
  changeUserPlan,
  getUserDetail,
  getUserInvoices,
  getUserLoginHistory,
  getUserProjects,
  impersonateUser,
  reactivateUser,
  suspendUser,
  updateUserNotes,
} from '@/lib/api/users.api'
import type { UserPlan } from '@/types'
import { formatCents, formatNumber } from '@/lib/dateRange'
import { cn } from '@/lib/cn'
import { PlanBadge } from '@/components/common/PlanBadge'
import { StatusBadge } from '@/components/common/StatusBadge'
import { ChangePlanModal } from '@/components/users/ChangePlanModal'
import { SuspendUserModal } from '@/components/users/SuspendUserModal'

interface UserDetailPanelProps {
  userId: string | null
  onClose: () => void
}

export function UserDetailPanel({ userId, onClose }: UserDetailPanelProps) {
  const qc = useQueryClient()
  const [notes, setNotes] = useState('')
  const [planOpen, setPlanOpen] = useState(false)
  const [suspendOpen, setSuspendOpen] = useState(false)

  const detailQuery = useQuery({
    queryKey: ['admin', 'user', userId],
    queryFn: () => getUserDetail(userId!),
    enabled: !!userId,
  })

  const projectsQuery = useQuery({
    queryKey: ['admin', 'user-projects', userId],
    queryFn: () => getUserProjects(userId!),
    enabled: !!userId,
  })

  const loginQuery = useQuery({
    queryKey: ['admin', 'user-login', userId],
    queryFn: () => getUserLoginHistory(userId!),
    enabled: !!userId,
  })

  const invoicesQuery = useQuery({
    queryKey: ['admin', 'user-invoices', userId],
    queryFn: () => getUserInvoices(userId!),
    enabled: !!userId,
  })

  const u = detailQuery.data

  useEffect(() => {
    if (u) setNotes(u.adminNotes ?? '')
  }, [u])

  if (!userId) return null

  const handleNotesBlur = async () => {
    if (!userId) return
    try {
      await updateUserNotes(userId, notes)
      toast.success('Notes saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    }
  }

  const openImpersonate = async () => {
    if (!userId) return
    try {
      const { impersonateUrl } = await impersonateUser(userId)
      window.open(impersonateUrl, '_blank', 'noopener,noreferrer')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    }
  }

  return (
    <>
      <motion.aside
        initial={{ x: 400 }}
        animate={{ x: 0 }}
        exit={{ x: 400 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        className="fixed right-0 top-14 z-30 flex h-[calc(100vh-3.5rem)] w-[400px] flex-col border-l border-divider bg-card shadow-lg"
      >
        <div className="flex h-12 flex-shrink-0 items-center justify-between border-b border-divider px-4">
          <div className="flex min-w-0 items-center gap-2">
            {u?.avatarUrl ? (
              <img
                src={u.avatarUrl}
                alt=""
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                {u?.name
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase() ?? '?'}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-heading">
                {u?.name ?? '…'}
              </p>
              <p className="truncate text-xs text-muted">{u?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/users/${userId}`}
              className="text-xs text-brand hover:underline"
            >
              View full →
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="rounded-chip p-1 text-muted hover:text-heading"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <Tabs.Root defaultValue="profile" className="flex min-h-0 flex-1 flex-col">
          <Tabs.List className="flex flex-shrink-0 border-b border-divider px-2">
            <Tabs.Trigger
              value="profile"
              className="flex-1 px-2 py-2 text-[11px] font-medium text-muted data-[state=active]:border-b-2 data-[state=active]:border-brand data-[state=active]:text-heading"
            >
              Profile
            </Tabs.Trigger>
            <Tabs.Trigger
              value="projects"
              className="flex-1 px-2 py-2 text-[11px] font-medium text-muted data-[state=active]:border-b-2 data-[state=active]:border-brand data-[state=active]:text-heading"
            >
              Projects
            </Tabs.Trigger>
            <Tabs.Trigger
              value="usage"
              className="flex-1 px-2 py-2 text-[11px] font-medium text-muted data-[state=active]:border-b-2 data-[state=active]:border-brand data-[state=active]:text-heading"
            >
              Usage
            </Tabs.Trigger>
            <Tabs.Trigger
              value="billing"
              className="flex-1 px-2 py-2 text-[11px] font-medium text-muted data-[state=active]:border-b-2 data-[state=active]:border-brand data-[state=active]:text-heading"
            >
              Billing
            </Tabs.Trigger>
            <Tabs.Trigger
              value="login"
              className="flex-1 px-2 py-2 text-[11px] font-medium text-muted data-[state=active]:border-b-2 data-[state=active]:border-brand data-[state=active]:text-heading"
            >
              Login History
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="profile" className="min-h-0 flex-1 overflow-y-auto p-4">
            {detailQuery.isLoading && (
              <div className="space-y-2">
                <div className="h-4 w-full shimmer rounded" />
                <div className="h-4 w-3/4 shimmer rounded" />
              </div>
            )}
            {u && (
              <div className="space-y-4 text-sm">
                <div className="flex flex-wrap gap-2">
                  <PlanBadge plan={u.plan} />
                  <StatusBadge status={u.status} />
                </div>
                <p>
                  <span className="text-muted">Joined: </span>
                  {formatDistanceToNow(new Date(u.joinedAt), { addSuffix: true })}
                </p>
                <p>
                  <span className="text-muted">Last active: </span>
                  {u.lastActiveAt
                    ? formatDistanceToNow(new Date(u.lastActiveAt), {
                        addSuffix: true,
                      })
                    : '—'}
                </p>
                <p>
                  <span className="text-muted">Onboarding: </span>
                  {u.onboardingDone ? 'Done' : 'Incomplete'}
                </p>
                <div>
                  <p className="text-xs font-semibold uppercase text-muted">
                    Bio
                  </p>
                  <p>{u.bio ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-muted">
                    Company
                  </p>
                  <p>{u.company ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-muted">
                    Website
                  </p>
                  <p>{u.website ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-muted">
                    Timezone
                  </p>
                  <p>{u.timezone}</p>
                </div>
                <div className="rounded-card border border-divider p-3">
                  <p className="mb-2 text-xs font-semibold text-heading">
                    Change plan
                  </p>
                  <button
                    type="button"
                    onClick={() => setPlanOpen(true)}
                    className="rounded-card border border-brand px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand/10"
                  >
                    Open plan change…
                  </button>
                </div>
              </div>
            )}
          </Tabs.Content>

          <Tabs.Content value="projects" className="min-h-0 flex-1 overflow-y-auto p-4">
            {projectsQuery.isLoading && (
              <div className="h-20 shimmer rounded-card" />
            )}
            {projectsQuery.data?.length === 0 && (
              <p className="text-sm text-muted">No projects yet</p>
            )}
            <ul className="space-y-2">
              {projectsQuery.data?.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/admin/projects/${p.id}`}
                    className="block rounded-card border border-divider p-3 hover:bg-bg"
                  >
                    <span className="mr-2">{p.emoji}</span>
                    <span className="font-medium">{p.name}</span>
                    <span className="ml-2 text-xs text-muted">
                      Phase {p.currentPhase}
                    </span>
                    <div className="mt-1 flex gap-2">
                      <StatusBadge status={p.status} />
                      <span className="text-[10px] uppercase text-muted">
                        {p.buildMode}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Tabs.Content>

          <Tabs.Content value="usage" className="min-h-0 flex-1 overflow-y-auto p-4">
            {u && (
              <div className="space-y-3 text-sm">
                <p>
                  <span className="text-muted">Total tokens (all-time): </span>
                  <span className="font-display text-xl font-bold">
                    {formatNumber(u.totalTokensUsed)}
                  </span>
                </p>
                <p>
                  <span className="text-muted">This month: </span>
                  {formatNumber(u.tokensUsedThisMonth)} / plan limit
                </p>
                <p>
                  Agent runs: {u.agentRunsTotal} total, {u.agentRunsThisMonth}{' '}
                  this month
                </p>
              </div>
            )}
          </Tabs.Content>

          <Tabs.Content value="billing" className="min-h-0 flex-1 overflow-y-auto p-4">
            {invoicesQuery.isLoading && (
              <div className="h-16 shimmer rounded" />
            )}
            {invoicesQuery.data?.length === 0 && (
              <p className="text-sm text-muted">No invoices yet</p>
            )}
            <ul className="space-y-2">
              {invoicesQuery.data?.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center justify-between rounded-card border border-divider px-3 py-2 text-sm"
                >
                  <span>{formatCents(inv.amountCents)}</span>
                  <StatusBadge status={inv.status} />
                  <a
                    href={inv.invoiceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-brand hover:underline"
                  >
                    PDF
                  </a>
                </li>
              ))}
            </ul>
          </Tabs.Content>

          <Tabs.Content value="login" className="min-h-0 flex-1 overflow-y-auto p-4">
            <ul className="space-y-3">
              {loginQuery.data?.map((ev) => (
                <li key={ev.id} className="border-b border-divider pb-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'h-2 w-2 rounded-full',
                        ev.success ? 'bg-success' : 'bg-error',
                      )}
                    />
                    <span className="font-mono text-xs">{ev.ip}</span>
                    <span className="text-xs text-muted">
                      {ev.location ?? '—'}
                    </span>
                  </div>
                  {!ev.success && ev.failureReason && (
                    <p className="text-xs text-error">{ev.failureReason}</p>
                  )}
                  <p className="mt-1 font-mono text-[10px] text-muted line-clamp-2">
                    {ev.userAgent}
                  </p>
                  <p className="text-[11px] text-muted">
                    {formatDistanceToNow(new Date(ev.occurredAt), {
                      addSuffix: true,
                    })}
                  </p>
                </li>
              ))}
            </ul>
          </Tabs.Content>
        </Tabs.Root>

        <div className="border-t border-divider p-4">
          <label className="text-xs font-semibold uppercase text-muted">
            Admin notes (private)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => void handleNotesBlur()}
            placeholder="Add internal notes about this user…"
            rows={3}
            className="mt-1 w-full rounded-card border border-divider bg-output px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-shrink-0 gap-2 border-t border-divider p-4">
          <button
            type="button"
            onClick={() => void openImpersonate()}
            className="flex-1 rounded-card border border-amber-600 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50"
          >
            Impersonate
          </button>
          {u?.status === 'suspended' ? (
            <button
              type="button"
              onClick={async () => {
                if (!userId) return
                await reactivateUser(userId)
                toast.success('Reactivated')
                void qc.invalidateQueries({ queryKey: ['admin', 'users'] })
                void qc.invalidateQueries({ queryKey: ['admin', 'user', userId] })
              }}
              className="flex-1 rounded-card border border-success py-2 text-sm font-medium text-success hover:bg-green-50"
            >
              Reactivate
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSuspendOpen(true)}
              className="flex-1 rounded-card border border-error py-2 text-sm font-medium text-error hover:bg-red-50"
            >
              Suspend
            </button>
          )}
        </div>
      </motion.aside>

      <ChangePlanModal
        open={planOpen}
        onOpenChange={setPlanOpen}
        currentPlan={u?.plan ?? 'pro'}
        onConfirm={async (plan, note) => {
          if (!userId) return
          await changeUserPlan(userId, plan, note)
          toast.success('Plan updated')
          void qc.invalidateQueries({ queryKey: ['admin', 'user', userId] })
          void qc.invalidateQueries({ queryKey: ['admin', 'users'] })
        }}
      />

      <SuspendUserModal
        open={suspendOpen}
        onOpenChange={setSuspendOpen}
        onConfirm={async (reason) => {
          if (!userId) return
          await suspendUser(userId, reason)
          toast.success('User suspended')
          void qc.invalidateQueries({ queryKey: ['admin', 'user', userId] })
          void qc.invalidateQueries({ queryKey: ['admin', 'users'] })
        }}
      />
    </>
  )
}
