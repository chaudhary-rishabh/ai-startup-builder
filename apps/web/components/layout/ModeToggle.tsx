'use client'

import { motion } from 'framer-motion'
import { Monitor, Palette } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useDesignMode } from '@/hooks/useDesignMode'

export function ModeToggle({ compact = false }: { compact?: boolean }): JSX.Element {
  const { mode, switchToDesign, switchToDev, isModeTransitioning } = useDesignMode()

  return (
    <div className="relative flex rounded-full border border-divider bg-card p-0.5 shadow-sm">
      <motion.div
        layoutId="mode-indicator"
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className={cn(
          'absolute inset-y-0.5 rounded-full',
          mode === 'design' ? 'left-0.5 right-1/2 bg-design' : 'left-1/2 right-0.5 bg-dev',
        )}
      />
      <button
        type="button"
        disabled={isModeTransitioning}
        onClick={switchToDesign}
        className={cn(
          'relative z-10 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors inline-flex items-center gap-1',
          mode === 'design' ? 'text-white' : 'text-heading',
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
          'relative z-10 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors inline-flex items-center gap-1',
          mode === 'dev' ? 'text-white' : 'text-heading',
        )}
      >
        <Monitor className="w-3.5 h-3.5" />
        {!compact && 'Dev'}
      </button>
    </div>
  )
}
