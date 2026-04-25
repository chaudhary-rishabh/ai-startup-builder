'use client'

import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

import { advancePhase } from '@/api/projects.api'
import { GenerateFrameButton } from '@/components/phases/phase3/GenerateFrameButton'
import { ModeToggle } from '@/components/layout/ModeToggle'
import { useDesignMode } from '@/hooks/useDesignMode'

interface DesignToolbarProps {
  projectId: string
  screenCount: number
  zoom: number
  setZoom: Dispatch<SetStateAction<number>>
  viewportWidth: number
  setViewportWidth: (width: number) => void
  onGenerateAll: () => Promise<void>
  isGeneratingAll: boolean
}

const viewportOptions = [
  { label: '🖥️ Desktop 1440px', width: 1440 },
  { label: '💻 Laptop 1024px', width: 1024 },
  { label: '📱 Mobile 375px', width: 375 },
]

export function DesignToolbar({
  projectId,
  screenCount,
  zoom,
  setZoom,
  viewportWidth,
  setViewportWidth,
  onGenerateAll,
  isGeneratingAll,
}: DesignToolbarProps): JSX.Element {
  const router = useRouter()
  const { switchToDev } = useDesignMode()
  const [isHandingOff, setIsHandingOff] = useState(false)

  const handleHandOff = async (): Promise<void> => {
    setIsHandingOff(true)
    try {
      await advancePhase(projectId, 4)
      switchToDev()
      setTimeout(() => {
        router.push(`/project/${projectId}/build`)
      }, 400)
    } finally {
      setIsHandingOff(false)
    }
  }

  return (
    <header className="flex h-12 items-center justify-between border-b border-divider bg-card px-3">
      <div className="flex items-center gap-3">
        <ModeToggle />
        <div className="flex items-center gap-1 rounded-md border border-divider bg-white px-1 py-0.5">
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => setZoom((prev) => Math.min(4.0, Math.max(0.25, prev - 0.1)))}
            className="h-7 w-7 rounded text-heading hover:bg-bg"
          >
            −
          </button>
          <button
            type="button"
            aria-label="Fit zoom"
            onClick={() => setZoom(1)}
            className="min-w-14 rounded px-2 py-1 text-xs text-heading hover:bg-bg"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => setZoom((prev) => Math.min(4.0, Math.max(0.25, prev + 0.1)))}
            className="h-7 w-7 rounded text-heading hover:bg-bg"
          >
            +
          </button>
        </div>

        <select
          aria-label="Viewport"
          className="h-8 rounded-md border border-divider bg-white px-2 text-xs text-heading"
          value={viewportWidth}
          onChange={(event) => setViewportWidth(Number(event.target.value))}
        >
          {viewportOptions.map((option) => (
            <option key={option.width} value={option.width}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <span className="rounded-full bg-bg px-2 py-1 text-[11px] text-muted">{screenCount} screens</span>
        <GenerateFrameButton
          onClick={() => void onGenerateAll()}
          isGenerating={isGeneratingAll}
          size="md"
          label="Generate All"
        />
        <button
          type="button"
          onClick={() => void handleHandOff()}
          disabled={isHandingOff}
          className="inline-flex h-9 items-center gap-1 rounded-md bg-design px-3 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
        >
          {isHandingOff ? <Loader2 size={14} className="animate-spin" /> : null}
          Hand Off →
        </button>
      </div>
    </header>
  )
}
