'use client'

import type { DesignTokens, WireframeBlock, WireframeScreen } from '@/types'

interface WireframeGridProps {
  screens: WireframeScreen[]
  designTokens: DesignTokens | null
  isStreaming: boolean
  streamedText?: string
}

const blockColorMap: Record<WireframeBlock['type'], string> = {
  nav: '#D8D0F0',
  hero: '#D0E8D8',
  content: '#E8DFD0',
  footer: '#D0D8E8',
  sidebar: '#F0E8D0',
  card: '#E8E8E8',
  form: '#F0D8E8',
}

function tintColor(base: string, primary?: string): string {
  if (!primary) return base
  return `color-mix(in srgb, ${base} 90%, ${primary} 10%)`
}

export function WireframeGrid({
  screens,
  designTokens,
  isStreaming,
  streamedText,
}: WireframeGridProps): JSX.Element {
  if (isStreaming) {
    return (
      <div className="rounded-card bg-card p-4 text-sm text-slate-700">
        {streamedText}
        <span className="ml-1 inline-block animate-pulse">|</span>
      </div>
    )
  }

  return (
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      {screens.map((screen) => (
        <article key={screen.id} className="overflow-hidden rounded-card bg-card shadow-sm">
          <header className="border-b border-divider px-3 py-2 text-xs font-semibold text-heading">{screen.name}</header>
          <div className="min-h-[180px] bg-bg p-2">
            {screen.blocks.map((block) => (
              <div
                key={`${screen.id}-${block.label}`}
                className="mb-1 flex items-center justify-center rounded text-[10px] font-medium text-[#C4A882]"
                style={{
                  height: block.height ?? 40,
                  backgroundColor: tintColor(block.color ?? blockColorMap[block.type], designTokens?.primaryColor),
                }}
              >
                {block.label}
              </div>
            ))}
          </div>
        </article>
      ))}
    </section>
  )
}
