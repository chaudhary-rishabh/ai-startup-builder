'use client'

import { motion } from 'framer-motion'
import { Monitor } from 'lucide-react'
import { use, useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { DeployLog } from '@/components/phases/phase5/DeployLog'
import { DeployWizard } from '@/components/phases/phase5/DeployWizard'
import { TestRunner } from '@/components/phases/phase5/TestRunner'
import { useDesignMode } from '@/hooks/useDesignMode'
import { useProject } from '@/hooks/useProject'
import type { TerminalLine } from '@/types'

function classifyDeploy(content: string): TerminalLine['type'] {
  const t = content.trimStart()
  if (t.startsWith('ERROR')) return 'error'
  if (t.startsWith('✓') || t.toUpperCase().startsWith('SUCCESS')) return 'success'
  if (t.startsWith('→') || t.startsWith('>>')) return 'info'
  return 'output'
}

function appendDeployLines(prev: TerminalLine[], chunk: string): TerminalLine[] {
  const next = [...prev]
  const parts = chunk.split('\n')
  const pushLine = (raw: string): void => {
    if (!raw) return
    const type = classifyDeploy(raw)
    next.push({ id: crypto.randomUUID(), type, content: raw, timestamp: new Date() })
  }
  if (parts.length === 1) {
    const last = next[next.length - 1]
    if (last && last.type === 'output' && classifyDeploy(chunk) === 'output') {
      last.content += parts[0] ?? ''
      return next
    }
    pushLine(parts[0] ?? '')
    return next
  }
  for (let i = 0; i < parts.length; i += 1) {
    const segment = parts[i] ?? ''
    if (i === 0 && next.length && next[next.length - 1]?.type === 'output') {
      ;(next[next.length - 1] as TerminalLine).content += segment
    } else {
      pushLine(segment)
    }
  }
  return next
}

export default function DeployPage({ params }: { params: Promise<{ id: string }> }): JSX.Element {
  const { id: projectId } = use(params)
  const { data: project } = useProject(projectId)
  const { switchToDev, isModeTransitioning } = useDesignMode()
  const [allTestsPassed, setAllTestsPassed] = useState(false)
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null)
  const [deployLogLines, setDeployLogLines] = useState<TerminalLine[]>([])
  const bootLog = useRef(false)

  useEffect(() => {
    switchToDev()
  }, [switchToDev])

  useEffect(() => {
    if (bootLog.current) return
    bootLog.current = true
    setDeployLogLines((prev) => [
      ...prev,
      { id: crypto.randomUUID(), type: 'system', content: 'Phase 5 — run tests, then deploy when ready.', timestamp: new Date() },
    ])
  }, [])

  const onDeployToken = useCallback((chunk: string) => {
    setDeployLogLines((prev) => appendDeployLines(prev, chunk))
  }, [])

  if (!project) {
    return <div className="p-6 text-slate-200">Loading…</div>
  }

  return (
    <div className="relative flex h-[calc(100vh-140px)] min-h-[520px] flex-col overflow-hidden bg-slate-950 text-slate-200">
      {isModeTransitioning ? (
        <motion.div
          className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Monitor className="w-8 h-8 text-muted" />
          <p className="mt-2 text-sm text-slate-300">Entering Dev Mode…</p>
        </motion.div>
      ) : null}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="min-h-0 min-w-0 flex-1">
          <TestRunner
            projectId={projectId}
            onAllTestsPass={() => setAllTestsPassed(true)}
            onFixTestRequest={(msg) => {
              void navigator.clipboard.writeText(msg)
              toast.success('Fix prompt copied to clipboard')
            }}
          />
        </div>
        <DeployWizard
          projectId={projectId}
          projectName={project.name}
          allTestsPassed={allTestsPassed}
          deployedUrl={deployedUrl}
          onDeployComplete={(u) => setDeployedUrl(u)}
          onDeployToken={onDeployToken}
        />
      </div>
      <DeployLog lines={deployLogLines} onClear={() => setDeployLogLines([])} />
    </div>
  )
}
