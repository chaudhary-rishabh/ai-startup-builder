'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import * as Switch from '@radix-ui/react-switch'
import * as Select from '@radix-ui/react-select'
import { ChevronDown, Loader2, Check } from 'lucide-react'
import type { GeneralSettings as GeneralSettingsType } from '@/types'
import { IANA_TIMEZONES } from '@/lib/timezones'
import { uploadLogo } from '@/lib/api/settings.api'
import { cn } from '@/lib/cn'

const schema = z.object({
  platformName: z.string().min(1, 'Required'),
  supportEmail: z.string().email('Invalid email'),
  timezone: z.string().min(1),
  maintenanceMode: z.boolean(),
  maintenanceMessage: z.string(),
})

type FormValues = z.infer<typeof schema>

interface GeneralSettingsProps {
  settings: GeneralSettingsType | undefined
  isLoading: boolean
  onSave: (payload: Partial<GeneralSettingsType>) => Promise<void>
}

export function GeneralSettings({
  settings,
  isLoading,
  onSave,
}: GeneralSettingsProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      platformName: 'AI Startup Builder',
      supportEmail: '',
      timezone: 'America/New_York',
      maintenanceMode: false,
      maintenanceMessage: '',
    },
  })

  const maintenanceMode = watch('maintenanceMode')

  useEffect(() => {
    if (!settings) return
    reset({
      platformName: settings.platformName,
      supportEmail: settings.supportEmail,
      timezone: settings.timezone,
      maintenanceMode: settings.maintenanceMode,
      maintenanceMessage: settings.maintenanceMessage,
    })
    setLogoPreview(settings.logoUrl)
  }, [settings, reset])

  const onSubmit = async (values: FormValues) => {
    setSaving(true)
    try {
      await onSave(values)
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  const handleLogoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) return
    const okType = file.type === 'image/png' || file.type === 'image/svg+xml'
    if (!okType) return
    const { logoUrl } = await uploadLogo(file)
    setLogoPreview(logoUrl)
    e.target.value = ''
  }

  if (isLoading) {
    return (
      <div className="bg-card rounded-card shadow-sm p-6 space-y-4">
        <div className="h-10 w-2/3 shimmer rounded-card" />
        <div className="h-11 w-full shimmer rounded-card" />
        <div className="h-20 w-20 rounded-full shimmer" />
        <div className="h-11 w-full shimmer rounded-card" />
        <div className="h-11 w-full shimmer rounded-card" />
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="bg-card rounded-card shadow-sm p-6 text-sm text-muted">
        Settings could not be loaded.
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-card rounded-card shadow-sm p-6 space-y-5"
    >
      <div>
        <label className="block text-sm font-medium text-heading mb-1.5">
          Platform Name
        </label>
        <input
          {...register('platformName')}
          className="h-11 w-full rounded-card border border-divider px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
        {errors.platformName && (
          <p className="mt-1 text-xs text-error">{errors.platformName.message}</p>
        )}
      </div>

      <div>
        <p className="text-sm font-medium text-heading mb-2">Logo</p>
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 overflow-hidden rounded-full bg-bg border border-divider flex items-center justify-center text-muted text-xs">
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element -- user-uploaded logo URL
              <img
                src={logoPreview}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span>No logo</span>
            )}
          </div>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/svg+xml"
              className="hidden"
              onChange={handleLogoPick}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-card border border-divider bg-white px-3 py-2 text-sm font-medium text-heading hover:bg-bg"
            >
              Upload Logo
            </button>
            <p className="mt-1 text-[11px] text-muted">PNG or SVG, max 2MB</p>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-heading mb-1.5">
          Support Email
        </label>
        <input
          type="email"
          {...register('supportEmail')}
          className="h-11 w-full rounded-card border border-divider px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <p className="mt-1 text-[11px] text-muted">
          Used in all customer-facing emails
        </p>
        {errors.supportEmail && (
          <p className="mt-1 text-xs text-error">{errors.supportEmail.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-heading mb-1.5">
          Platform Timezone
        </label>
        <Select.Root
          value={watch('timezone')}
          onValueChange={(v) => setValue('timezone', v)}
        >
          <Select.Trigger className="inline-flex h-11 w-full max-w-md items-center justify-between rounded-card border border-divider bg-white px-3 text-sm text-heading">
            <Select.Value placeholder="Timezone" />
            <Select.Icon>
              <ChevronDown className="h-4 w-4 text-muted" />
            </Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Content
              className="z-50 max-h-64 overflow-y-auto rounded-card border border-divider bg-white shadow-md"
              position="popper"
            >
              <Select.Viewport className="p-1">
                {IANA_TIMEZONES.map((tz) => (
                  <Select.Item
                    key={tz}
                    value={tz}
                    className="cursor-pointer rounded-chip px-3 py-2 text-sm outline-none data-[highlighted]:bg-bg"
                  >
                    {tz}
                  </Select.Item>
                ))}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
        <p className="mt-1 text-[11px] text-muted">
          Used for all admin date displays
        </p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-heading">Maintenance Mode</p>
          <p className="text-[11px] text-muted">
            When enabled, project routes show a maintenance page
          </p>
        </div>
        <Switch.Root
          checked={maintenanceMode}
          onCheckedChange={(v) => setValue('maintenanceMode', v)}
          className={cn(
            'relative h-12 w-[88px] shrink-0 rounded-full transition-colors',
            maintenanceMode ? 'bg-amber-400' : 'bg-divider',
          )}
        >
          <Switch.Thumb
            className={cn(
              'block h-10 w-10 translate-x-1 translate-y-1 rounded-full bg-white shadow transition-transform',
              maintenanceMode && 'translate-x-[44px]',
            )}
          />
        </Switch.Root>
      </div>

      {maintenanceMode ? (
        <div className="bg-amber-50 border border-amber-200 rounded-card p-3 text-sm text-amber-900">
          <p className="font-medium">Maintenance mode is active</p>
          <p className="mt-1 text-[13px]">
            All /project/* routes show a maintenance page. /admin is still
            accessible.
          </p>
        </div>
      ) : null}

      <div>
        <label className="block text-sm font-medium text-heading mb-1.5">
          Maintenance Message
        </label>
        <textarea
          {...register('maintenanceMessage')}
          rows={3}
          placeholder="We'll be back soon. Maintenance in progress."
          className="w-full rounded-card border border-divider px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-card bg-brand text-sm font-semibold text-white hover:opacity-95 disabled:opacity-70"
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving…
          </>
        ) : savedFlash ? (
          <>
            <Check className="h-4 w-4 text-green-200" />
            Saved!
          </>
        ) : (
          'Save General Settings'
        )}
      </button>
    </form>
  )
}
