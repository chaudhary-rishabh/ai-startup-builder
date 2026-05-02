'use client'

import { Monitor, Palette } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useDesignMode } from '@/hooks/useDesignMode'

export function ModeToggle({ compact = false }: { compact?: boolean }): JSX.Element {
  const { mode, switchToDesign, switchToDev, isModeTransitioning } = useDesignMode()

  return (
    <div className="inline-flex items-center gap-0.5 rounded-full border border-divider bg-card p-0.5 shadow-sm">
      <button
        type="button"
        disabled={isModeTransitioning}
        onClick={switchToDesign}
        className={cn(
          'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors inline-flex items-center gap-1',
          mode === 'design' ? 'bg-brand/10 text-brand' : 'text-muted hover:text-heading',
        )}
      >
        <Palette className="w-3.5 h-3.5" />
        {!compact && 'Design'}
      </button>
      <button
        type="button"
        disabled={isModeTransitioning}
        onClick={switchToDev}
        className={cn(
          'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors inline-flex items-center gap-1',
          mode === 'dev' ? 'bg-brand/10 text-brand' : 'text-muted hover:text-heading',
        )}
      >
        <Monitor className="w-3.5 h-3.5" />
        {!compact && 'Dev'}
      </button>
    </div>
  )
}
