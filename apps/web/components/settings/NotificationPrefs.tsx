'use client'

import * as Switch from '@radix-ui/react-switch'
import * as Tooltip from '@radix-ui/react-tooltip'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { getNotificationPrefs, updateNotificationPrefs, type NotificationPreferences } from '@/api/user.api'

export function NotificationPrefs(): JSX.Element {
  const queryClient = useQueryClient()
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const debounceRef = useRef<number | null>(null)

  const prefsQuery = useQuery({
    queryKey: ['notification-prefs'],
    queryFn: getNotificationPrefs,
  })

  useEffect(() => {
    if (prefsQuery.data) setPrefs(prefsQuery.data)
  }, [prefsQuery.data])

  const saveMut = useMutation({
    mutationFn: (next: Partial<NotificationPreferences>) => updateNotificationPrefs(next),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notification-prefs'] })
      setSaving(false)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2000)
    },
    onError: () => setSaving(false),
  })

  const scheduleSave = (next: Partial<NotificationPreferences>): void => {
    setSaving(true)
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      saveMut.mutate(next)
    }, 500)
  }

  if (!prefs) {
    return prefsQuery.isLoading ? (
      <div className="flex items-center gap-2 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading notification preferences…
      </div>
    ) : (
      <div className="h-8" />
    )
  }

  const row = (label: string, checked: boolean, onChange: (v: boolean) => void, disabled?: boolean): JSX.Element => (
    <div className="flex items-center justify-between py-2">
      <span className={`text-sm ${disabled ? 'text-muted' : 'text-heading'}`}>{label}</span>
      <Switch.Root
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onChange(v === true)}
        className="h-6 w-11 rounded-full bg-divider data-[state=checked]:bg-brand"
      >
        <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white transition-transform data-[state=checked]:translate-x-5" />
      </Switch.Root>
    </div>
  )

  return (
    <section className="border-t border-divider pt-10">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-heading">Notifications</h2>
        <div className="flex items-center gap-2 text-xs text-muted">
          {saving ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving…
            </>
          ) : null}
          {saved && !saving ? <span className="text-success">Saved</span> : null}
        </div>
      </div>

      <div className="mt-4 rounded-card border border-divider bg-bg p-4">
        <p className="text-xs font-semibold uppercase text-muted">Email notifications</p>
        {row('Email Notifications', prefs.emailEnabled, (v) => {
          const next = { ...prefs, emailEnabled: v }
          setPrefs(next)
          scheduleSave({ emailEnabled: v })
        })}
        {prefs.emailEnabled ? (
          <div className="ml-2 space-y-1 border-l border-divider pl-3">
            {row('Phase complete', prefs.phaseComplete, (v) => {
              const next = { ...prefs, phaseComplete: v }
              setPrefs(next)
              scheduleSave({ phaseComplete: v })
            })}
            {row('Weekly digest', prefs.weeklyDigest, (v) => {
              const next = { ...prefs, weeklyDigest: v }
              setPrefs(next)
              scheduleSave({ weeklyDigest: v })
            })}
            {row('Billing events', prefs.billingEvents, (v) => {
              const next = { ...prefs, billingEvents: v }
              setPrefs(next)
              scheduleSave({ billingEvents: v })
            })}
          </div>
        ) : null}
      </div>

      <div className="mt-4 rounded-card border border-divider bg-bg p-4">
        <p className="text-xs font-semibold uppercase text-muted">In-app notifications</p>
        {row('In-App Notifications', prefs.inAppEnabled, (v) => {
          const next = { ...prefs, inAppEnabled: v }
          setPrefs(next)
          scheduleSave({ inAppEnabled: v })
        })}
        {prefs.inAppEnabled ? (
          <div className="ml-2 space-y-1 border-l border-divider pl-3">
            {row('Agent run done', prefs.agentDone, (v) => {
              const next = { ...prefs, agentDone: v }
              setPrefs(next)
              scheduleSave({ agentDone: v })
            })}
            {row('Phase complete', prefs.phaseComplete, (v) => {
              const next = { ...prefs, phaseComplete: v }
              setPrefs(next)
              scheduleSave({ phaseComplete: v })
            })}
            {row('Billing events', prefs.billingEvents, (v) => {
              const next = { ...prefs, billingEvents: v }
              setPrefs(next)
              scheduleSave({ billingEvents: v })
            })}
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between rounded-card border border-divider bg-bg px-4 py-3">
        <Tooltip.Provider>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <span className="text-sm text-muted">Security alerts</span>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content className="rounded-md bg-slate-900 px-2 py-1 text-xs text-white" sideOffset={6}>
                Security alerts cannot be disabled
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
        {row('Security alerts', true, () => {}, true)}
      </div>
    </section>
  )
}
