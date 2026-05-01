'use client'

import { motion } from 'framer-motion'
import { Zap, Handshake, Hand } from 'lucide-react'
import type { BuildMode } from '@/types'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

interface BuildModeSelectorProps {
  value: BuildMode
  onChange: (mode: BuildMode) => void
}

const options: Array<{ mode: BuildMode; icon: LucideIcon; title: string; description: string; popular?: boolean }> = [
  {
    mode: 'autopilot',
    icon: Zap,
    title: 'Autopilot',
    description: 'Sit back - all agents run in sequence. Zero interruptions.',
  },
  {
    mode: 'copilot',
    icon: Handshake,
    title: 'Copilot',
    description: 'Agents pause between phases. You answer quick questions to guide the output.',
    popular: true,
  },
  {
    mode: 'manual',
    icon: Hand,
    title: 'Manual',
    description: 'You trigger each agent yourself. Full control, your pace.',
  },
]

export function BuildModeSelector({ value, onChange }: BuildModeSelectorProps): JSX.Element {
  const selectedIndex = options.findIndex((option) => option.mode === value)

  const moveByArrow = (offset: number): void => {
    const nextIndex = (selectedIndex + offset + options.length) % options.length
    onChange(options[nextIndex]!.mode)
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Build mode selector">
      {options.map((option) => {
        const selected = value === option.mode
        return (
          <motion.button
            key={option.mode}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={0}
            whileTap={{ scale: 0.97 }}
            onClick={() => onChange(option.mode)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onChange(option.mode)
              }
              if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                event.preventDefault()
                moveByArrow(1)
              }
              if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                event.preventDefault()
                moveByArrow(-1)
              }
            }}
            className={cn(
              'rounded-card border p-4 text-left transition-all',
              selected ? 'border-brand bg-brand/5' : 'border-divider hover:border-muted',
            )}
          >
            <option.icon className="w-6 h-6 text-muted" />
            <div className="mt-2 flex items-center gap-2">
              <p className="text-sm font-semibold text-heading">{option.title}</p>
              {option.popular ? (
                <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
                  Most popular
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">{option.description}</p>
          </motion.button>
        )
      })}
    </div>
  )
}
