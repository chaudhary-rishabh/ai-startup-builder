'use client'

import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Circle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { getProjectFiles } from '@/api/files.api'
import { LivePreviewCard } from '@/components/phases/phase5/LivePreviewCard'
import { useAgentRun } from '@/hooks/useAgentRun'
import { cn } from '@/lib/utils'

interface EnvRow {
  key: string
  value: string
  required: boolean
}

function parseEnvExample(content: string): EnvRow[] {
  const rows: EnvRow[] = []
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    rows.push({ key, value: '', required: value === '' })
  }
  return rows
}

interface DeployWizardProps {
  projectId: string
  projectName: string
  allTestsPassed: boolean
  deployedUrl: string | null
  onDeployComplete: (url: string) => void
  onDeployToken: (chunk: string) => void
}

const steps = ['Test', 'Configure', 'Connect', 'Deploy', 'Live'] as const

export function DeployWizard({
  projectId,
  projectName,
  allTestsPassed,
  deployedUrl,
  onDeployComplete,
  onDeployToken,
}: DeployWizardProps): JSX.Element {
  const [wizardStep, setWizardStep] = useState(1)
  const [platforms, setPlatforms] = useState({ vercel: false, railway: false, supabase: false })
  const [oauth, setOauth] = useState({ vercel: false, railway: false, github: false })
  const [envRows, setEnvRows] = useState<EnvRow[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)

  const filesQuery = useQuery({
    queryKey: ['project-files', projectId, 'deploy-env'],
    queryFn: () => getProjectFiles(projectId),
    enabled: wizardStep === 3,
  })

  const envFile = useMemo(() => {
    const files = filesQuery.data ?? []
    return files.find((f) => f.path.endsWith('.env.example')) ?? files.find((f) => f.path.includes('env'))
  }, [filesQuery.data])

  const loadEnvRows = useCallback(() => {
    if (!envFile?.content) {
      setEnvRows([
        { key: 'DATABASE_URL', value: '', required: true },
        { key: 'NEXTAUTH_SECRET', value: '', required: true },
      ])
      return
    }
    setEnvRows(parseEnvExample(envFile.content))
  }, [envFile])

  useEffect(() => {
    if (wizardStep === 3 && filesQuery.isFetched) loadEnvRows()
  }, [wizardStep, filesQuery.isFetched, loadEnvRows])

  useEffect(() => {
    if (deployedUrl) setWizardStep(5)
  }, [deployedUrl])

  const deployRun = useAgentRun({
    projectId,
    agentType: 'deploy',
    phase: 5,
    onToken: (e) => onDeployToken(e.token),
    onComplete: (output) => {
      const nested = output.deployOutput as { liveUrl?: string } | undefined
      const live = nested?.liveUrl ?? (typeof output.liveUrl === 'string' ? output.liveUrl : null)
      if (live) onDeployComplete(live)
    },
    onError: () => toast.error('Deploy failed'),
  })

  const envSatisfied = envRows.every((r) => !r.required || r.value.trim().length > 0)
  const platformOk = platforms.vercel || platforms.railway || platforms.supabase
  const oauthOk =
    (!platforms.vercel || oauth.vercel) &&
    (!platforms.railway || oauth.railway) &&
    (!platforms.supabase || oauth.github)

  const connect = (key: 'vercel' | 'railway' | 'github'): void => {
    window.open('/settings/integrations', '_blank', 'noopener,noreferrer')
    setOauth((o) => ({ ...o, [key]: true }))
    toast.message('Integration connected (demo mode)')
  }

  return (
    <div className="flex h-full min-h-0 w-[320px] shrink-0 flex-col border-l border-slate-700 bg-slate-900 text-slate-200">
      <div className="border-b border-slate-700 px-3 py-3">
        <div className="flex items-center justify-between gap-1">
          {steps.map((label, i) => {
            const n = i + 1
            const done = wizardStep > n || (deployedUrl != null && n < 5)
            const active = wizardStep === n
            return (
              <div key={label} className="flex flex-1 flex-col items-center gap-1">
                {done ? (
                  <CheckCircle2 className="h-4 w-4 text-green-400" data-testid={`step-dot-${n}-done`} />
                ) : active ? (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#0D9488] text-[9px] font-bold text-white">
                    {n}
                  </span>
                ) : (
                  <Circle className="h-4 w-4 text-slate-600" data-testid={`step-dot-${n}-future`} />
                )}
                <span className="text-[9px] text-slate-500">{label}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {deployedUrl ? <LivePreviewCard liveUrl={deployedUrl} projectName={projectName} /> : null}

        {!deployedUrl && wizardStep === 1 ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-200">Choose platforms</p>
            {(
              [
                { key: 'vercel' as const, title: 'Vercel (Frontend)', sub: 'Host Next.js frontend' },
                { key: 'railway' as const, title: 'Railway / Render (Backend)', sub: 'API + workers' },
                { key: 'supabase' as const, title: 'Supabase / Atlas (Database)', sub: 'Postgres + auth' },
              ] as const
            ).map((p) => (
              <label key={p.key} className="flex cursor-pointer gap-2 rounded-md border border-slate-700 bg-slate-950 p-3">
                <input
                  type="checkbox"
                  data-testid={`platform-${p.key}`}
                  checked={platforms[p.key]}
                  onChange={(e) => setPlatforms((s) => ({ ...s, [p.key]: e.target.checked }))}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm text-slate-200">{p.title}</span>
                  <span className="text-xs text-slate-500">{p.sub}</span>
                </span>
              </label>
            ))}
            <button
              type="button"
              data-testid="wizard-step1-continue"
              disabled={!platformOk}
              onClick={() => setWizardStep(2)}
              className="mt-2 flex h-11 w-full items-center justify-center rounded-md bg-[#0D9488] text-sm font-semibold text-white disabled:opacity-40"
            >
              Continue →
            </button>
          </div>
        ) : null}

        {!deployedUrl && wizardStep === 2 ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-200">Connect accounts</p>
            {platforms.vercel ? (
              <button
                type="button"
                onClick={() => connect('vercel')}
                className="flex w-full items-center justify-between rounded-md border border-slate-600 bg-white px-3 py-2 text-sm font-medium text-slate-900"
              >
                Vercel
                <span>{oauth.vercel ? '✓ Connected' : 'Connect'}</span>
              </button>
            ) : null}
            {platforms.railway ? (
              <button
                type="button"
                onClick={() => connect('railway')}
                className="flex w-full items-center justify-between rounded-md border border-slate-600 bg-white px-3 py-2 text-sm font-medium text-slate-900"
              >
                Railway
                <span>{oauth.railway ? '✓ Connected' : 'Connect'}</span>
              </button>
            ) : null}
            {platforms.vercel || platforms.railway || platforms.supabase ? (
              <button
                type="button"
                onClick={() => connect('github')}
                className="flex w-full items-center justify-between rounded-md border border-slate-600 bg-white px-3 py-2 text-sm font-medium text-slate-900"
              >
                GitHub
                <span>{oauth.github ? '✓ Connected' : 'Connect'}</span>
              </button>
            ) : null}
            <button
              type="button"
              data-testid="wizard-step2-continue"
              disabled={!oauthOk}
              onClick={() => setWizardStep(3)}
              className="mt-2 flex h-11 w-full items-center justify-center rounded-md bg-[#0D9488] text-sm font-semibold text-white disabled:opacity-40"
            >
              Continue →
            </button>
          </div>
        ) : null}

        {!deployedUrl && wizardStep === 3 ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-200">Environment variables</p>
            {filesQuery.isLoading ? <p className="text-xs text-slate-500">Loading…</p> : null}
            <div className="overflow-hidden rounded-md border border-slate-700">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400">
                  <tr>
                    <th className="px-2 py-2">Key</th>
                    <th className="px-2 py-2">Value</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {envRows.map((row, idx) => (
                    <tr key={`${row.key}-${idx}`} className="border-t border-slate-800">
                      <td className="px-2 py-1.5 font-mono text-slate-300">{row.key}</td>
                      <td className="px-2 py-1.5">
                        <input
                          data-testid={`env-value-${row.key}`}
                          value={row.value}
                          onChange={(e) => {
                            const v = e.target.value
                            setEnvRows((rows) => rows.map((r, i) => (i === idx ? { ...r, value: v } : r)))
                          }}
                          className={cn(
                            'w-full rounded border bg-slate-950 px-2 py-1 text-slate-200',
                            row.required && !row.value.trim() ? 'border-red-500' : 'border-slate-700',
                          )}
                        />
                      </td>
                      <td className="px-1">
                        <button
                          type="button"
                          className="text-slate-500 hover:text-slate-300"
                          aria-label="Remove row"
                          onClick={() => setEnvRows((rows) => rows.filter((_, i) => i !== idx))}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              className="text-xs font-medium text-[#0D9488] hover:underline"
              onClick={() => setEnvRows((rows) => [...rows, { key: 'NEW_VAR', value: '', required: false }])}
            >
              + Add Variable
            </button>
            {!envSatisfied ? (
              <p className="text-xs text-amber-400">Deploy button disabled until all required vars are filled</p>
            ) : null}
            <button
              type="button"
              data-testid="wizard-step3-continue"
              disabled={!envSatisfied}
              onClick={() => setWizardStep(4)}
              className="flex h-11 w-full items-center justify-center rounded-md bg-[#0D9488] text-sm font-semibold text-white disabled:opacity-40"
            >
              Continue →
            </button>
          </div>
        ) : null}

        {!deployedUrl && wizardStep === 4 ? (
          <div className="space-y-4">
            <div className="rounded-md border border-slate-700 bg-slate-950 p-4 text-sm">
              <p className="font-medium text-slate-200">Ready to ship</p>
              <ul className="mt-2 list-inside list-disc text-xs text-slate-400">
                <li>
                  {[platforms.vercel && 'Vercel', platforms.railway && 'Railway', platforms.supabase && 'DB'].filter(Boolean).join(', ') ||
                    'No platform'}
                </li>
                <li>{envRows.filter((r) => r.value.trim()).length} variables configured</li>
                <li>Estimated deploy time: ~3 minutes</li>
              </ul>
            </div>
            <AlertDialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
              <AlertDialog.Trigger asChild>
                <button
                  type="button"
                  data-testid="deploy-prod-btn"
                  disabled={!allTestsPassed || deployRun.status === 'running' || deployRun.status === 'starting'}
                  className="flex h-12 w-full items-center justify-center rounded-md bg-[#0D9488] text-sm font-semibold text-white disabled:opacity-50"
                >
                  🚀 Deploy to Production
                </button>
              </AlertDialog.Trigger>
              <AlertDialog.Portal>
                <AlertDialog.Overlay className="fixed inset-0 z-[60] bg-black/50" />
                <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[61] w-[min(420px,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-slate-700 bg-slate-900 p-6 text-slate-200 shadow-xl">
                  <AlertDialog.Title className="text-lg font-semibold">Deploy to production?</AlertDialog.Title>
                  <AlertDialog.Description className="mt-2 text-sm text-slate-400">
                    This will make your app live. Review your settings before continuing.
                  </AlertDialog.Description>
                  <div className="mt-6 flex justify-end gap-2">
                    <AlertDialog.Cancel className="rounded-md border border-slate-600 px-3 py-2 text-sm">Cancel</AlertDialog.Cancel>
                    <AlertDialog.Action
                      className="rounded-md bg-[#0D9488] px-3 py-2 text-sm font-semibold text-white"
                      onClick={() => {
                        setConfirmOpen(false)
                        void deployRun.trigger()
                      }}
                    >
                      Confirm deploy
                    </AlertDialog.Action>
                  </div>
                </AlertDialog.Content>
              </AlertDialog.Portal>
            </AlertDialog.Root>
          </div>
        ) : null}
      </div>
    </div>
  )
}
