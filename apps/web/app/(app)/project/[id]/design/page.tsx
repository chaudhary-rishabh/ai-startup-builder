'use client'

import { use, useCallback, useEffect, useMemo, useState } from 'react'

import { DesignToolbar } from '@/components/phases/phase3/DesignToolbar'
import { FrameViewer } from '@/components/phases/phase3/FrameViewer'
import { ScreenBrowser } from '@/components/phases/phase3/ScreenBrowser'
import { useDesignMode } from '@/hooks/useDesignMode'
import { useGenerateFrame } from '@/hooks/useGenerateFrame'
import { useProject } from '@/hooks/useProject'
import { useCanvasStore } from '@/store/canvasStore'
import { useUIStore } from '@/store/uiStore'
import type { WireframeScreen } from '@/types'

function getRouteForScreen(screenName: string): string {
  return `/${screenName.toLowerCase().replace(/\s+/g, '-')}`
}

export default function DesignPage({ params }: { params: Promise<{ id: string }> }): JSX.Element {
  const { id: projectId } = use(params)
  const { data: project } = useProject(projectId)
  const { switchToDesign, isModeTransitioning } = useDesignMode()
  const setContextPanelOpen = useUIStore((state) => state.setContextPanelOpen)
  const screens = useCanvasStore((state) => state.screens)
  const selectedScreen = useCanvasStore((state) => state.selectedScreen)
  const setSelectedScreen = useCanvasStore((state) => state.setSelectedScreen)
  const { generateFrame, isGenerating } = useGenerateFrame({ projectId })

  const [zoom, setZoom] = useState(1)
  const [viewportWidth, setViewportWidth] = useState(1440)
  const [generatingScreen, setGeneratingScreen] = useState<string | null>(null)
  const [isGeneratingAll, setIsGeneratingAll] = useState(false)

  const wireframes = useMemo<WireframeScreen[]>(
    () => project?.phase2Output?.uiux?.wireframes ?? [],
    [project?.phase2Output?.uiux?.wireframes],
  )

  useEffect(() => {
    switchToDesign()
  }, [switchToDesign])

  useEffect(() => {
    setContextPanelOpen(false)
  }, [setContextPanelOpen])

  useEffect(() => {
    if (selectedScreen) return
    const firstGenerated = wireframes.find((wireframe) => screens.some((screen) => screen.screenName === wireframe.name))
    if (firstGenerated) {
      setSelectedScreen(firstGenerated.name)
    }
  }, [screens, selectedScreen, setSelectedScreen, wireframes])

  const handleGenerate = useCallback(
    async (screen: WireframeScreen): Promise<void> => {
      setGeneratingScreen(screen.name)
      try {
        await generateFrame({
          screenName: screen.name,
          route: getRouteForScreen(screen.name),
        })
        setSelectedScreen(screen.name)
      } finally {
        setGeneratingScreen(null)
      }
    },
    [generateFrame, setSelectedScreen],
  )

  const handleGenerateAll = useCallback(async (): Promise<void> => {
    setIsGeneratingAll(true)
    try {
      for (const screen of wireframes) {
        await handleGenerate(screen)
      }
    } finally {
      setIsGeneratingAll(false)
    }
  }, [handleGenerate, wireframes])

  return (
    <div className="relative flex h-full flex-col bg-bg">
      {isModeTransitioning ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-bg/95 text-sm font-semibold text-heading">
          Entering Design Mode…
        </div>
      ) : null}

      <DesignToolbar
        projectId={projectId}
        screenCount={wireframes.length}
        zoom={zoom}
        setZoom={setZoom}
        viewportWidth={viewportWidth}
        setViewportWidth={setViewportWidth}
        onGenerateAll={handleGenerateAll}
        isGeneratingAll={isGeneratingAll || isGenerating}
      />

      <div className="flex min-h-0 flex-1">
        <ScreenBrowser wireframes={wireframes} generatingScreen={generatingScreen} onGenerate={(screen) => void handleGenerate(screen)} />
        <FrameViewer iframeWidth={viewportWidth} zoom={zoom} />
      </div>
    </div>
  )
}
