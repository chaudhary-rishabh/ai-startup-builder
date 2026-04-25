'use client'

import type { FileTreeBatchProgress } from '@/hooks/useFileTree'

const AGENT_LABELS: Record<string, string> = {
  schema_gen: '📐 Schema',
  api_gen: '🔌 API',
  backend: '⚙️ Backend',
  frontend: '⚛️ Frontend',
  integration: '🔗 Integration',
}

interface BatchProgressBarProps {
  progress: FileTreeBatchProgress | null
}

export function BatchProgressBar({ progress }: BatchProgressBarProps): JSX.Element | null {
  if (!progress || !progress.isActive) return null

  const label = AGENT_LABELS[progress.agentType] ?? progress.agentType
  const pct = progress.total > 0 ? Math.min(100, (progress.current / progress.total) * 100) : 0

  return (
    <div
      className="flex h-9 flex-col justify-center border-b border-slate-700 bg-slate-800 px-3"
      data-testid="batch-progress-bar"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-300">
          Batch {progress.current} of {progress.total}
        </span>
        <span className="rounded-full bg-teal-500/20 px-2 py-0.5 text-[10px] text-teal-400">{label}</span>
        <span className="text-[11px] text-slate-400">
          {progress.filesGenerated} / {progress.estimatedBatchFiles} files
        </span>
      </div>
      <div className="mt-1 h-[3px] w-full rounded bg-slate-700">
        <div
          className="h-full rounded bg-[#0D9488] transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
          data-testid="batch-progress-fill"
        />
      </div>
    </div>
  )
}
