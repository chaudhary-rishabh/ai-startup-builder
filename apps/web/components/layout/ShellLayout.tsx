'use client'

import { useMemo, useState } from 'react'
import { Menu } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Sidebar } from '@/components/layout/Sidebar'
import { ResizeHandle } from '@/components/layout/ResizeHandle'
import { useProjectStore } from '@/store/projectStore'

export function ShellLayout({ children }: { children: React.ReactNode }): JSX.Element {
  const isDev = useProjectStore((state) => state.mode === 'dev')
  const isModeTransitioning = useProjectStore((state) => state.isModeTransitioning)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false)

  const mainClassName = useMemo(
    () =>
      cn(
        'flex-1 overflow-y-auto transition-colors duration-[400ms]',
        isDev ? 'bg-bg text-heading' : 'bg-bg text-heading',
        isModeTransitioning ? 'pointer-events-none select-none' : '',
      ),
    [isDev, isModeTransitioning],
  )

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        desktopCollapsed={desktopSidebarCollapsed}
        onToggleDesktop={() => setDesktopSidebarCollapsed((prev) => !prev)}
      />
      <ResizeHandle />
      <main data-testid="main-content" className={mainClassName}>
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(true)}
          className="fixed left-3 top-3 z-20 rounded-md border border-divider bg-card p-2 shadow-sm md:hidden"
          aria-label="Open navigation menu"
        >
          <Menu size={16} />
        </button>
        {children}
      </main>
    </div>
  )
}
