'use client'

import { useEffect, useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import type { IntegrationKey } from '@/types'
import { cn } from '@/lib/cn'

const SERVICE_ORDER: IntegrationKey['service'][] = [
  'minimax',
  'deepseek',
  'deepseek_r1',
  'gemini',
  'stripe',
  'github',
  'resend',
  'pinecone',
]

function ServiceIcon({ service }: { service: IntegrationKey['service'] }) {
  const cls = 'h-6 w-6'
  switch (service) {
    case 'minimax':
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden>
          <rect width="24" height="24" rx="4" fill="#6366F1" />
        </svg>
      )
    case 'deepseek':
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden>
          <rect width="24" height="24" rx="4" fill="#0EA5E9" />
        </svg>
      )
    case 'deepseek_r1':
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden>
          <rect width="24" height="24" rx="4" fill="#0284C7" />
        </svg>
      )
    case 'gemini':
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden>
          <rect width="24" height="24" rx="4" fill="#4285F4" />
        </svg>
      )
    case 'stripe':
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden>
          <rect width="24" height="24" rx="4" fill="#635BFF" />
        </svg>
      )
    case 'github':
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden>
          <path
            fill="#24292f"
            d="M12 2C6.48 2 2 6.58 2 12.26c0 4.5 2.87 8.32 6.84 9.67.5.1.68-.22.68-.48 0-.24-.01-.87-.01-1.7-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.1-1.5-1.1-1.5-.9-.63.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.56 2.34 1.11 2.91.85.09-.67.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.36 9.36 0 0 1 12 6.84c.85.004 1.71.12 2.51.35 1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.07.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.82 0 .27.18.59.69.48A10.01 10.01 0 0 0 22 12.26C22 6.58 17.52 2 12 2z"
          />
        </svg>
      )
    case 'resend':
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden>
          <rect width="24" height="24" rx="5" fill="#000" />
        </svg>
      )
    case 'pinecone':
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden>
          <polygon
            points="12,2 22,8 22,16 12,22 2,16 2,8"
            fill="#3ECF8E"
          />
        </svg>
      )
    default:
      return <div className={cn(cls, 'rounded bg-divider')} />
  }
}

function StatusBadge({ row }: { row: IntegrationKey }) {
  if (row.validationStatus === 'valid') {
    return (
      <span className="rounded-chip bg-green-50 px-2 py-0.5 text-[11px] font-medium text-success">
        Valid ✓
      </span>
    )
  }
  if (row.validationStatus === 'invalid') {
    return (
      <span className="rounded-chip bg-red-50 px-2 py-0.5 text-[11px] font-medium text-error">
        Invalid ✗
      </span>
    )
  }
  return (
    <span className="rounded-chip bg-gray-100 px-2 py-0.5 text-[11px] text-muted">
      Unchecked
    </span>
  )
}

interface IntegrationsSettingsProps {
  keys: IntegrationKey[]
  isLoading: boolean
  onUpdate: (service: string, apiKey: string) => Promise<void>
  onValidate: (service: string) => Promise<{ valid: boolean; message: string }>
}

export function IntegrationsSettings({
  keys,
  isLoading,
  onUpdate,
  onValidate,
}: IntegrationsSettingsProps) {
  const ordered = useMemo(() => {
    const map = new Map(keys.map((k) => [k.service, k]))
    const out: IntegrationKey[] = []
    for (const s of SERVICE_ORDER) {
      const row = map.get(s)
      if (row) out.push(row)
    }
    for (const k of keys) {
      if (!SERVICE_ORDER.includes(k.service)) out.push(k)
    }
    return out
  }, [keys])

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-card rounded-card shadow-sm p-4 shimmer h-24" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {ordered.map((row) => (
        <IntegrationRow
          key={row.service}
          row={row}
          onUpdate={onUpdate}
          onValidate={onValidate}
        />
      ))}
      <div className="bg-amber-50 border border-amber-200 rounded-card p-3 text-sm text-amber-950">
        ⚠️ API keys are stored encrypted at rest using AES-256. They are never
        logged, shown in full, or transmitted in plain text after saving.
      </div>
    </div>
  )
}

function IntegrationRow({
  row,
  onUpdate,
  onValidate,
}: {
  row: IntegrationKey
  onUpdate: (service: string, apiKey: string) => Promise<void>
  onValidate: (service: string) => Promise<{ valid: boolean; message: string }>
}) {
  const [show, setShow] = useState(false)
  const [value, setValue] = useState(row.apiKey)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [validating, setValidating] = useState(false)
  const [inline, setInline] = useState<{ ok: boolean; text: string } | null>(
    null,
  )

  useEffect(() => {
    setValue(row.apiKey)
    setDirty(false)
    setInline(null)
  }, [row.apiKey, row.service])

  const maskedLoaded =
    row.apiKey.includes('•') || (row.isSet && row.apiKey.length > 0)

  const lastText = row.lastValidatedAt
    ? `Validated ${formatDistanceToNow(new Date(row.lastValidatedAt), { addSuffix: true })}`
    : 'Never validated'

  const runValidate = async () => {
    setValidating(true)
    setInline(null)
    try {
      const r = await onValidate(row.service)
      setInline({ ok: r.valid, text: r.message })
    } catch {
      setInline({ ok: false, text: 'Validation failed' })
    } finally {
      setValidating(false)
    }
  }

  const runSave = async () => {
    setSaving(true)
    try {
      await onUpdate(row.service, value)
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-card rounded-card shadow-sm p-4 flex flex-wrap items-start gap-4">
      <div className="min-w-[200px] flex-1">
        <div className="flex items-start gap-2">
          <ServiceIcon service={row.service} />
          <div>
            <p className="text-[13px] font-semibold text-heading">{row.label}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <StatusBadge row={row} />
              <span className="text-[11px] text-muted">{lastText}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-[320px] flex-1 min-w-[200px]">
        <div className="relative">
          <input
            type={show ? 'text' : 'password'}
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setDirty(true)
            }}
            onFocus={() => {
              if (!dirty && maskedLoaded) {
                setDirty(true)
                setValue('')
              }
            }}
            className="h-9 w-full rounded-card border border-divider pr-9 pl-2 text-xs font-mono"
          />
          <button
            type="button"
            className="absolute right-1 top-1/2 -translate-y-1/2 text-muted"
            onClick={() => setShow((s) => !s)}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {inline ? (
          <p
            className={cn(
              'mt-1 text-[11px]',
              inline.ok ? 'text-success' : 'text-error',
            )}
          >
            {inline.ok ? '✓ ' : '✗ '}
            {inline.text}
          </p>
        ) : null}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={validating}
          onClick={() => void runValidate()}
          className="h-8 w-[88px] rounded-card border border-divider bg-white text-xs font-medium hover:bg-bg disabled:opacity-60"
        >
          {validating ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" /> : 'Validate'}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void runSave()}
          className="h-8 w-[72px] rounded-card bg-brand text-xs font-semibold text-white hover:opacity-95 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" /> : 'Save'}
        </button>
      </div>
    </div>
  )
}
