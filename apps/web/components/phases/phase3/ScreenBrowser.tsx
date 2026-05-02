'use client'

import { RotateCcw } from 'lucide-react'

import { GenerateFrameButton } from '@/components/phases/phase3/GenerateFrameButton'
import { cn } from '@/lib/utils'
import { useCanvasStore } from '@/store/canvasStore'
import type { WireframeScreen } from '@/types'

interface ScreenBrowserProps {
  wireframes: WireframeScreen[]
  generatingScreen: string | null
  onGenerate: (screen: WireframeScreen) => void
}

export function ScreenBrowser({ wireframes, generatingScreen, onGenerate }: ScreenBrowserProps): JSX.Element {
  const screens = useCanvasStore((state) => state.screens)
  const selectedScreen = useCanvasStore((state) => state.selectedScreen)
  const setSelectedScreen = useCanvasStore((state) => state.setSelectedScreen)

  return (
    <aside className="w-[240px] shrink-0 border-r border-divider bg-sidebar p-3">
      <p className="px-1 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Screens</p>
      <div className="mt-2 space-y-1">
        {wireframes.map((wireframe) => {
          const generated = screens.find((screen) => screen.screenName === wireframe.name)
          const active = selectedScreen === wireframe.name
          const isGenerating = generatingScreen === wireframe.name

          return (
            <div
              key={wireframe.id}
              className={cn(
                'group flex items-center justify-between rounded-r-md border-l-[3px] px-2 py-2 transition',
                active ? 'border-l-brand bg-white/60' : 'border-l-transparent hover:bg-white/50',
                isGenerating ? 'pointer-events-none opacity-70' : '',
              )}
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                onClick={() => {
                  if (generated) setSelectedScreen(wireframe.name)
                }}
                disabled={!generated}
              >
                {generated ? (
                  <span className="h-2.5 w-2.5 rounded-full bg-success" aria-label="Generated" />
                ) : (
                  <span className="h-2.5 w-2.5 rounded-full border border-muted" aria-label="Pending" />
                )}
                <span className="truncate text-xs text-heading">{wireframe.name}</span>
              </button>

              {generated ? (
                <button
                  type="button"
                  onClick={() => onGenerate(wireframe)}
                  className="invisible rounded p-1 text-muted hover:text-brand group-hover:visible"
                  aria-label={`Regenerate ${wireframe.name}`}
                >
                  <RotateCcw size={12} />
                </button>
              ) : (
                <GenerateFrameButton
                  onClick={() => onGenerate(wireframe)}
                  size="sm"
                  label=""
                  ariaLabel={`Generate ${wireframe.name}`}
                  className="h-6 w-6 justify-center p-0"
                  isGenerating={isGenerating}
                />
              )}
            </div>
          )
        })}
      </div>
    </aside>
  )
}
