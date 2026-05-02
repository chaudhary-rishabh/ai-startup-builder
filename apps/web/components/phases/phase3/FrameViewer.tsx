'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef } from 'react'

import { useCanvasStore } from '@/store/canvasStore'

interface FrameViewerProps {
  iframeWidth: number
  zoom: number
}

export function FrameViewer({ iframeWidth, zoom }: FrameViewerProps): JSX.Element {
  const screens = useCanvasStore((state) => state.screens)
  const selectedScreen = useCanvasStore((state) => state.selectedScreen)

  const selected = useMemo(
    () => screens.find((screen) => screen.screenName === selectedScreen) ?? null,
    [screens, selectedScreen],
  )
  const isPhoneViewport = iframeWidth <= 430
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  useEffect(() => {
    if (!selected || !iframeRef.current) return
    iframeRef.current.setAttribute('srcdoc', selected.html)
  }, [selected])

  return (
    <section className="relative flex flex-1 flex-col overflow-hidden bg-output" style={{ backgroundImage: 'radial-gradient(#E0DAD3 0.8px, transparent 0.8px)', backgroundSize: '16px 16px' }}>
      <div className="flex flex-1 items-center justify-center p-6">
        <AnimatePresence mode="wait">
          {selected ? (
            <motion.div
              key={selected.screenName}
              initial={{ opacity: 0.4 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0.4 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="flex flex-col items-center"
            >
              <div
                className={isPhoneViewport ? 'rounded-[24px] border-8 border-[#1f1f1f] bg-black p-2 shadow-lg' : ''}
                data-testid={isPhoneViewport ? 'phone-chrome' : undefined}
              >
                <iframe
                  ref={iframeRef}
                  title={`${selected.screenName} preview`}
                  data-testid="frame-viewer-iframe"
                  sandbox="allow-scripts allow-same-origin"
                  className="rounded-md border border-divider bg-white shadow-lg"
                  style={{
                    width: `${iframeWidth}px`,
                    height: `${Math.max(680, Math.round(iframeWidth * 0.62))}px`,
                    transform: `scale(${zoom})`,
                    transformOrigin: 'top center',
                  }}
                />
              </div>

              <div className="mt-3 rounded-full border border-divider bg-card px-3 py-1 text-xs text-muted">
                {selected.screenName} · {selected.route} · {new Date(selected.generatedAt).toLocaleTimeString()}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0.2 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0.2 }}
              className="rounded-card border border-dashed border-divider bg-card/80 px-5 py-4 text-sm text-muted"
            >
              Select a generated screen to preview it here.
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}
