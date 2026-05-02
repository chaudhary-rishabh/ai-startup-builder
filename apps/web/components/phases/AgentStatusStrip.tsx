'use client'

import { Check, Loader2, PartyPopper, XCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

interface AgentStatusItem {
  agentType: string
  label: string
  status: 'idle' | 'running' | 'complete' | 'error'
  tokenCount?: number
}

interface AgentStatusStripProps {
  agents: AgentStatusItem[]
  phase?: number
}

export function AgentStatusStrip({ agents, phase = 1 }: AgentStatusStripProps): JSX.Element {
  const firedConfettiRef = useRef(false)
  const allComplete = agents.length > 0 && agents.every((agent) => agent.status === 'complete')

  useEffect(() => {
    if (!allComplete || firedConfettiRef.current) return
    firedConfettiRef.current = true
    toast.success(`Phase ${phase} complete! Ready to move on?`)

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    void (async () => {
      const confetti = (await import('canvas-confetti')).default
      confetti({
        particleCount: 60,
        spread: 75,
        ticks: 100,
        colors: ['#8B6F47', '#16A34A', '#E0DAD3', '#C4A882'],
      })
    })()
  }, [allComplete, phase])

  return (
    <div className="mt-3 space-y-1">
      {agents.map((agent, index) => (
        <div key={agent.agentType} className="flex h-12 items-center gap-3 px-3">
          <span className="w-4 text-xs text-muted">{index + 1}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-heading">{agent.label}</p>
            {agent.status === 'running' ? <p className="animate-pulse text-xs text-warning">Running…</p> : null}
            {agent.status === 'complete' ? (
              <p className="text-[11px] text-muted">{(agent.tokenCount ?? 0).toLocaleString()} tokens</p>
            ) : null}
            {agent.status === 'error' ? <p className="text-xs text-error">Failed</p> : null}
          </div>
          <div className="flex items-center gap-1">
            {agent.status === 'idle' ? <span className="h-2.5 w-2.5 rounded-full bg-divider" /> : null}
            {agent.status === 'running' ? (
              <>
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-400" />
                <Loader2 size={12} className="animate-spin text-amber-500" />
              </>
            ) : null}
            {agent.status === 'complete' ? (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.4, 1] }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="relative inline-flex h-4 w-4 items-center justify-center rounded-full bg-success"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" className="text-white">
                  <path
                    d="M3 7 L7 11 L13 5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="20"
                    strokeDashoffset="0"
                    style={{ transition: 'stroke-dashoffset 300ms ease-out' }}
                  />
                </svg>
              </motion.span>
            ) : null}
            {agent.status === 'error' ? <XCircle size={14} className="text-error" /> : null}
          </div>
        </div>
      ))}
      {allComplete ? (
        <div className="inline-flex items-center gap-1 rounded-full bg-success-bg px-2 py-1 text-[10px] text-success">
          <Check size={10} /> Complete
        </div>
      ) : null}
    </div>
  )
}
