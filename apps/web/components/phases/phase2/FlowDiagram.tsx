'use client'

import type { FlowStep } from '@/types'

interface FlowDiagramProps {
  flowSteps: FlowStep[]
  isStreaming: boolean
  streamedText?: string
}

function Node({ step }: { step: FlowStep }): JSX.Element {
  if (step.type === 'decision') {
    return (
      <div className="relative flex flex-col items-center">
        <div className="flex h-24 w-24 items-center justify-center">
          <div
            className="flex h-16 w-16 items-center justify-center border border-warning bg-warning/10"
            style={{ transform: 'rotate(45deg)' }}
            data-testid="flow-node-decision"
          >
            <span className="-rotate-45 px-1 text-center text-xs text-amber-800">{step.label}</span>
          </div>
        </div>
        {step.isDropOffRisk ? (
          <span className="absolute -right-24 top-8 rounded-full bg-warning/10 px-2 py-0.5 text-[10px] text-amber-800">
            ⚠ Drop-off risk
          </span>
        ) : null}
      </div>
    )
  }

  if (step.type === 'start' || step.type === 'end' || step.type === 'result') {
    const classes =
      step.type === 'result'
        ? 'border-success bg-success/10 text-green-700'
        : 'border-success bg-success/10 text-heading'
    return (
      <div className="flex items-center gap-2">
        <div className={`rounded-full border px-5 py-2 text-xs font-medium ${classes}`}>
          {step.type === 'start' ? 'Start' : step.type === 'end' ? 'End' : step.label}
        </div>
        {step.isDropOffRisk ? (
          <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] text-amber-800">
            ⚠ Drop-off risk
          </span>
        ) : null}
      </div>
    )
  }

  return (
    <div className="max-w-[260px] rounded-md border border-divider bg-card px-4 py-2 text-center text-[13px] font-medium text-heading shadow-sm">
      <span className="border-l-[3px] border-brand pl-2">{step.label}</span>
      {step.isDropOffRisk ? (
        <span className="ml-2 rounded-full bg-warning/10 px-2 py-0.5 text-[10px] text-amber-800">⚠ Drop-off risk</span>
      ) : null}
    </div>
  )
}

export function FlowDiagram({ flowSteps, isStreaming, streamedText }: FlowDiagramProps): JSX.Element | null {
  if (isStreaming) {
    return (
      <div className="rounded-card bg-card p-4 text-sm text-slate-700">
        {streamedText}
        <span className="ml-1 inline-block animate-pulse">|</span>
      </div>
    )
  }
  if (!flowSteps.length) return null

  return (
    <div className="mx-auto max-w-[400px]">
      {flowSteps.map((step, index) => (
        <div key={step.id} className="flex flex-col items-center">
          <Node step={step} />
          {index < flowSteps.length - 1 ? (
            <div className="my-1 flex flex-col items-center" data-testid="flow-connector">
              <div className="h-6 w-0 border-l-2 border-[#C4A882]" />
              <div className="h-0 w-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-[#C4A882]" />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}
