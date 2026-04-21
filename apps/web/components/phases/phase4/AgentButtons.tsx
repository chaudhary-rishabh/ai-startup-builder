'use client'

import * as Tooltip from '@radix-ui/react-tooltip'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { useAgentRun } from '@/hooks/useAgentRun'
import type { BuildMode, SSEBatchCompleteEvent, SSEBatchStartEvent } from '@/types'

type AgentKey = 'schema_gen' | 'api_gen' | 'backend' | 'frontend' | 'integration'

const ORDER: AgentKey[] = ['schema_gen', 'api_gen', 'backend', 'frontend', 'integration']

const DEFS: { key: AgentKey; label: string; emoji: string }[] = [
  { key: 'schema_gen', label: 'Generate Schema', emoji: '📐' },
  { key: 'api_gen', label: 'Generate API', emoji: '🔌' },
  { key: 'backend', label: 'Generate Backend', emoji: '⚙️' },
  { key: 'frontend', label: 'Generate Frontend', emoji: '⚛️' },
  { key: 'integration', label: 'Connect All', emoji: '🔗' },
]

function tooltipMessage(key: AgentKey): string {
  if (key === 'api_gen') return 'Complete Schema first'
  if (key === 'backend') return 'Complete API first'
  if (key === 'frontend') return 'Complete Backend first'
  if (key === 'integration') return 'Complete Backend or Frontend first'
  return ''
}

function canRunAgent(key: AgentKey, completed: Record<AgentKey, boolean>, buildMode: BuildMode): boolean {
  if (buildMode === 'autopilot') return true
  if (key === 'schema_gen') return true
  if (key === 'api_gen') return completed.schema_gen
  if (key === 'backend') return completed.api_gen
  if (key === 'frontend') return completed.backend || buildMode === 'manual'
  if (key === 'integration') return completed.backend || completed.frontend
  return false
}

interface AgentButtonsProps {
  projectId: string
  buildMode: BuildMode
  onAgentStart: (agentType: string) => void
  onAgentComplete: (agentType: string, fileCount: number) => void
  onFilesAppear: (paths: string[]) => void
  onTerminalToken: (chunk: string) => void
  onFileStart: (path: string, language: string) => void
  onFileComplete: (path: string, size: number) => void
  onBatchStart: (event: SSEBatchStartEvent) => void
  onBatchComplete: (event: SSEBatchCompleteEvent) => void
  onRegisterStop: (fn: (() => Promise<void>) | null) => void
  autopilotStart?: boolean
  hasExistingFiles: boolean
}

export function AgentButtons({
  projectId,
  buildMode,
  onAgentStart,
  onAgentComplete,
  onFilesAppear,
  onTerminalToken,
  onFileStart,
  onFileComplete,
  onBatchStart,
  onBatchComplete,
  onRegisterStop,
  autopilotStart,
  hasExistingFiles,
}: AgentButtonsProps): JSX.Element {
  const [completed, setCompleted] = useState<Record<AgentKey, boolean>>({
    schema_gen: false,
    api_gen: false,
    backend: false,
    frontend: false,
    integration: false,
  })
  const [fileCounts, setFileCounts] = useState<Partial<Record<AgentKey, number>>>({})
  const [errors, setErrors] = useState<Partial<Record<AgentKey, boolean>>>({})
  const batchPathsRef = useRef<string[]>([])
  const autopilotChainRef = useRef(new Set<string>())

  const makeHandlers = useCallback(
    (key: AgentKey) => ({
      onComplete: (output: Record<string, unknown>) => {
        const n = typeof output.filesGenerated === 'number' ? output.filesGenerated : 0
        setFileCounts((prev) => ({ ...prev, [key]: n }))
        setCompleted((prev) => ({ ...prev, [key]: true }))
        setErrors((prev) => ({ ...prev, [key]: false }))
        onAgentComplete(key, n)
        toast.success(`${key.replace(/_/g, ' ')} complete`)
      },
      onError: () => {
        setErrors((prev) => ({ ...prev, [key]: true }))
      },
    }),
    [onAgentComplete],
  )

  const h0 = makeHandlers('schema_gen')
  const schemaRun = useAgentRun({
    projectId,
    agentType: 'schema_gen',
    phase: 4,
    onToken: (e) => onTerminalToken(e.token),
    onFileStart: (ev) => onFileStart(ev.path, ev.language),
    onFileComplete: (ev) => {
      batchPathsRef.current.push(ev.path)
      onFileComplete(ev.path, ev.size)
    },
    onBatchStart,
    onBatchComplete: (ev) => {
      onFilesAppear([...batchPathsRef.current])
      batchPathsRef.current = []
      onBatchComplete(ev)
    },
    onComplete: h0.onComplete,
    onError: h0.onError,
  })

  const h1 = makeHandlers('api_gen')
  const apiRun = useAgentRun({
    projectId,
    agentType: 'api_gen',
    phase: 4,
    onToken: (e) => onTerminalToken(e.token),
    onFileStart: (ev) => onFileStart(ev.path, ev.language),
    onFileComplete: (ev) => {
      batchPathsRef.current.push(ev.path)
      onFileComplete(ev.path, ev.size)
    },
    onBatchStart,
    onBatchComplete: (ev) => {
      onFilesAppear([...batchPathsRef.current])
      batchPathsRef.current = []
      onBatchComplete(ev)
    },
    onComplete: h1.onComplete,
    onError: h1.onError,
  })

  const h2 = makeHandlers('backend')
  const backendRun = useAgentRun({
    projectId,
    agentType: 'backend',
    phase: 4,
    onToken: (e) => onTerminalToken(e.token),
    onFileStart: (ev) => onFileStart(ev.path, ev.language),
    onFileComplete: (ev) => {
      batchPathsRef.current.push(ev.path)
      onFileComplete(ev.path, ev.size)
    },
    onBatchStart,
    onBatchComplete: (ev) => {
      onFilesAppear([...batchPathsRef.current])
      batchPathsRef.current = []
      onBatchComplete(ev)
    },
    onComplete: h2.onComplete,
    onError: h2.onError,
  })

  const h3 = makeHandlers('frontend')
  const frontendRun = useAgentRun({
    projectId,
    agentType: 'frontend',
    phase: 4,
    onToken: (e) => onTerminalToken(e.token),
    onFileStart: (ev) => onFileStart(ev.path, ev.language),
    onFileComplete: (ev) => {
      batchPathsRef.current.push(ev.path)
      onFileComplete(ev.path, ev.size)
    },
    onBatchStart,
    onBatchComplete: (ev) => {
      onFilesAppear([...batchPathsRef.current])
      batchPathsRef.current = []
      onBatchComplete(ev)
    },
    onComplete: h3.onComplete,
    onError: h3.onError,
  })

  const h4 = makeHandlers('integration')
  const integrationRun = useAgentRun({
    projectId,
    agentType: 'integration',
    phase: 4,
    onToken: (e) => onTerminalToken(e.token),
    onFileStart: (ev) => onFileStart(ev.path, ev.language),
    onFileComplete: (ev) => {
      batchPathsRef.current.push(ev.path)
      onFileComplete(ev.path, ev.size)
    },
    onBatchStart,
    onBatchComplete: (ev) => {
      onFilesAppear([...batchPathsRef.current])
      batchPathsRef.current = []
      onBatchComplete(ev)
    },
    onComplete: h4.onComplete,
    onError: h4.onError,
  })

  const runByKey = useRef({
    schema_gen: schemaRun,
    api_gen: apiRun,
    backend: backendRun,
    frontend: frontendRun,
    integration: integrationRun,
  })
  runByKey.current = { schema_gen: schemaRun, api_gen: apiRun, backend: backendRun, frontend: frontendRun, integration: integrationRun }

  useEffect(() => {
    const entries = ORDER.map((k) => [k, runByKey.current[k].status] as const)
    const active = entries.find(([, s]) => s === 'running' || s === 'starting')
    if (active) {
      const key = active[0]
      onRegisterStop(() => runByKey.current[key].cancel())
    } else {
      onRegisterStop(null)
    }
  }, [
    schemaRun.status,
    apiRun.status,
    backendRun.status,
    frontendRun.status,
    integrationRun.status,
    onRegisterStop,
  ])

  const trigger = useCallback(
    async (key: AgentKey) => {
      onAgentStart(key)
      await runByKey.current[key].trigger()
    },
    [onAgentStart],
  )

  useEffect(() => {
    if (!autopilotStart || hasExistingFiles) return
    if (buildMode !== 'autopilot') return
    const t = setTimeout(() => {
      void trigger('schema_gen')
    }, 800)
    return () => clearTimeout(t)
  }, [autopilotStart, buildMode, hasExistingFiles, trigger])

  useEffect(() => {
    if (buildMode !== 'autopilot') return
    for (let i = 0; i < ORDER.length - 1; i += 1) {
      const cur = ORDER[i]!
      const nxt = ORDER[i + 1]!
      const curSt = runByKey.current[cur].status
      const nextSt = runByKey.current[nxt].status
      const chainKey = `${cur}->${nxt}`
      if (curSt === 'complete' && nextSt === 'idle' && !errors[nxt] && !autopilotChainRef.current.has(chainKey)) {
        autopilotChainRef.current.add(chainKey)
        queueMicrotask(() => {
          void trigger(nxt)
        })
        break
      }
    }
  }, [apiRun.status, backendRun.status, buildMode, errors, frontendRun.status, integrationRun.status, schemaRun.status, trigger])

  const runLookup: Record<AgentKey, ReturnType<typeof useAgentRun>> = {
    schema_gen: schemaRun,
    api_gen: apiRun,
    backend: backendRun,
    frontend: frontendRun,
    integration: integrationRun,
  }

  const renderButton = (def: (typeof DEFS)[number]): JSX.Element => {
    const key = def.key
    const run = runLookup[key]
    const allowed = canRunAgent(key, completed, buildMode)
    const disabledByPrereq = !allowed && run.status === 'idle'
    const count = fileCounts[key] ?? 0
    const isError = errors[key]

    const baseClass =
      'relative flex min-h-10 w-full flex-col items-center justify-center rounded-md border-[1.5px] px-2 py-1 text-[13px] font-medium transition-colors'

    let stateClass = 'border-[#0D9488] text-[#0D9488] hover:bg-teal-500/10'
    if (disabledByPrereq) stateClass = 'cursor-not-allowed border-[#0D9488]/40 text-[#0D9488]/40 opacity-40'
    if (run.status === 'starting') stateClass = 'cursor-not-allowed border-[#0D9488]/60 opacity-60'
    if (run.status === 'running') stateClass = 'cursor-not-allowed border-[#0D9488] opacity-90'
    if (run.status === 'complete' && !isError) stateClass = 'border-green-600 bg-teal-500/10 text-green-600'
    if (isError) stateClass = 'border-red-600 text-red-600'

    const inner = (
      <button
        type="button"
        disabled={(run.status === 'running' || run.status === 'starting') && !isError}
        className={`${baseClass} ${stateClass}`}
        data-testid={`agent-btn-${key}`}
        onClick={() => {
          if (isError) {
            setErrors((p) => ({ ...p, [key]: false }))
            run.reset()
            void trigger(key)
            return
          }
          if (run.status === 'complete') {
            run.reset()
            setCompleted((p) => ({ ...p, [key]: false }))
            void trigger(key)
            return
          }
          if (!allowed) return
          void trigger(key)
        }}
      >
        <span className="flex items-center gap-2">
          {run.status === 'starting' ? <Loader2 className="animate-spin" size={14} /> : null}
          {run.status === 'running' ? <Loader2 className="animate-spin text-[#0D9488]" size={14} /> : null}
          {run.status === 'complete' && !isError ? <CheckCircle2 size={14} className="text-green-600" /> : null}
          {run.status !== 'starting' && run.status !== 'running' && !(run.status === 'complete' && !isError) ? (
            <span>{def.emoji}</span>
          ) : null}
          <span>
            {run.status === 'starting' ? 'Starting…' : null}
            {run.status === 'running' ? 'Generating…' : null}
            {run.status === 'complete' && !isError ? `✓ ${def.label} done — ${count} files` : null}
            {isError ? '✗ Failed — retry?' : null}
            {run.status === 'idle' && !isError ? `${def.emoji} ${def.label}` : null}
          </span>
        </span>
      </button>
    )

    if (!disabledByPrereq || run.status !== 'idle') return <div key={key}>{inner}</div>

    return (
      <Tooltip.Provider key={key} delayDuration={200}>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>{inner}</Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content className="z-50 rounded bg-slate-900 px-2 py-1 text-[11px] text-slate-200 shadow" sideOffset={4} data-testid={`tooltip-${key}`}>
              {tooltipMessage(key)}
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
    )
  }

  return <div className="flex flex-col gap-2 border-t border-slate-700 p-3">{DEFS.map(renderButton)}</div>
}
