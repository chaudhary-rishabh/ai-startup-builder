'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Brain, ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen, Rocket, Search, Settings, Star } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { getPhaseRoute } from '@/api/projects.api'
import { logout } from '@/api/auth.api'
import { NewProjectModal } from '@/components/dashboard/NewProjectModal'
import { RagModal } from '@/components/rag/RagModal'
import { ModeToggle } from '@/components/layout/ModeToggle'
import { useProjects } from '@/hooks/useProjects'
import { useRagStatus } from '@/hooks/useRagStatus'
import { useAuthStore } from '@/store/authStore'

interface SidebarProps {
  mobileOpen: boolean
  onCloseMobile: () => void
  desktopCollapsed?: boolean
  onToggleDesktop?: () => void
}

function RagDot({ status }: { status: 'active' | 'pending' | 'empty' }): JSX.Element {
  return (
    <span
      className={`h-2.5 w-2.5 rounded-full ${status === 'active' ? 'bg-success' : status === 'pending' ? 'animate-pulse bg-warning' : 'bg-muted'}`}
    />
  )
}

function SidebarContent({ collapsed, onNavigate, onToggleCollapse }: { collapsed: boolean; onNavigate: () => void; onToggleCollapse?: () => void }): JSX.Element {
  const router = useRouter()
  const pathname = usePathname()
  const { data } = useProjects({ status: 'active' })
  const starredQuery = useProjects({ starred: true })
  const ragStatus = useRagStatus()
  const user = useAuthStore((state) => state.user)
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const [query, setQuery] = useState('')
  const [starredOpen, setStarredOpen] = useState(true)
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [ragModalOpen, setRagModalOpen] = useState(false)

  const filteredProjects = useMemo(() => {
    const projects = data?.projects ?? []
    if (!query.trim()) return projects
    return projects.filter((project) => project.name.toLowerCase().includes(query.toLowerCase()))
  }, [data?.projects, query])

  const doSignOut = async (): Promise<void> => {
    await logout()
    clearAuth()
    router.push('/')
  }

  return (
    <>
      <aside
        style={{ width: collapsed ? 48 : 'var(--sidebar-width, 240px)' }}
        className="flex h-screen flex-col border-r border-divider bg-bg transition-[width] duration-300 ease-out overflow-hidden flex-shrink-0"
      >
        <div className={`flex items-center ${collapsed ? 'px-2 py-3 flex-col gap-2' : 'p-3 justify-between'}`}>
          {!collapsed ? <ModeToggle compact={false} /> : null}
          {onToggleCollapse ? (
            <button
              type="button"
              onClick={onToggleCollapse}
              className={collapsed ? 'flex h-9 w-9 items-center justify-center rounded-md hover:bg-divider text-muted' : 'rounded-md p-1 hover:bg-divider text-muted'}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={14} />}
            </button>
          ) : null}
        </div>
        {!collapsed ? (
          <div className="mb-4 flex items-center gap-2 text-heading px-3">
            <Rocket className="w-5 h-5 text-muted flex-shrink-0" />
            <span className="font-display text-[15px] font-bold whitespace-nowrap">AI Startup Builder</span>
          </div>
        ) : null}

        <div className={`mb-3 ${collapsed ? 'px-2' : 'px-3'}`}>
          {!collapsed ? (
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search projects…"
                className="h-10 w-full rounded-lg bg-card pl-8 pr-10 text-sm shadow-sm"
              />
              <span className="absolute right-2 top-3 text-[10px] text-muted">⌘K</span>
            </div>
          ) : (
            <button aria-label="Search projects" className="flex h-9 w-full items-center justify-center rounded-md bg-card">
              <Search size={14} />
            </button>
          )}
        </div>

        <div className={`mb-4 ${collapsed ? 'px-2' : 'px-3'}`}>
          <button
            type="button"
            onClick={() => setNewProjectOpen(true)}
            className={`rounded-md bg-brand text-sm font-semibold text-white hover:brightness-90 ${collapsed ? 'h-9 w-full' : 'h-10 w-full'}`}
          >
            {collapsed ? '+' : '+ New Project'}
          </button>
        </div>

        <p className={`mb-2 text-[10px] uppercase tracking-[0.08em] text-muted ${collapsed ? 'px-2' : 'px-3'}`}>{collapsed ? 'P' : 'PROJECTS'}</p>
        <div className={`space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}>
          {filteredProjects.map((project) => {
            const active = pathname?.includes(`/project/${project.id}`) ?? false
            return (
              <button
                key={project.id}
                type="button"
                className={`flex h-9 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-divider ${
                  active ? 'border-l-[3px] border-brand bg-divider' : ''
                }`}
                onClick={() => {
                  router.push(getPhaseRoute(project.id, project.currentPhase))
                  onNavigate()
                }}
              >
                {!collapsed ? <span className="min-w-0 flex-1 truncate text-[13px] text-heading">{project.name}</span> : null}
                {!collapsed ? <span className="text-[10px] text-muted">P{project.currentPhase}</span> : null}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          className={`mt-4 flex items-center justify-between text-[10px] uppercase tracking-[0.08em] text-muted ${collapsed ? 'px-2' : 'px-3'}`}
          onClick={() => setStarredOpen((current) => !current)}
        >
          <span>{collapsed ? <Star className="w-3 h-3" /> : 'STARRED'}</span>
          {!collapsed ? starredOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" /> : null}
        </button>
        <AnimatePresence initial={false}>
          {starredOpen ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className={`mt-1 space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}>
                {(starredQuery.data?.projects ?? []).map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-divider"
                    onClick={() => {
                      router.push(getPhaseRoute(project.id, project.currentPhase))
                      onNavigate()
                    }}
                  >
                    {!collapsed ? <span className="min-w-0 flex-1 truncate text-[13px]">{project.name}</span> : null}
                    <Star className="h-3 w-3 text-muted" />
                  </button>
                ))}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <p className={`mt-4 text-[10px] uppercase tracking-[0.08em] text-muted ${collapsed ? 'px-2' : 'px-3'}`}>{collapsed ? 'R' : 'RAG AI'}</p>
        <button
          type="button"
          className={`mt-1 flex h-9 w-full items-center gap-2 rounded-md px-2 hover:bg-divider ${collapsed ? 'justify-center' : ''}`}
          onClick={() => setRagModalOpen(true)}
        >
          <Brain className="h-4 w-4 flex-shrink-0" />
          {!collapsed ? <span className="flex-1 text-left text-[13px]">My AI Brain</span> : null}
          <RagDot status={ragStatus} />
        </button>

        <div className={`mt-auto flex items-center ${collapsed ? 'px-2 justify-center' : 'px-3 justify-between'}`}>
          <Link href="/settings" className="rounded-md p-2 hover:bg-divider" aria-label="Settings">
            <Settings size={16} />
          </Link>
          {!collapsed ? (
            <>
              <button
                type="button"
                className="flex items-center gap-2 rounded-md p-1 hover:bg-divider"
                onClick={() => void doSignOut()}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-[10px] text-white">
                  {user?.name?.slice(0, 1).toUpperCase() ?? 'U'}
                </span>
                <span className="text-xs text-heading">Sign out</span>
              </button>
              <span className="rounded-chip bg-output px-2 py-1 text-[10px] uppercase text-muted">{user?.plan ?? 'free'}</span>
            </>
          ) : null}
        </div>
      </aside>

      <NewProjectModal open={newProjectOpen} onClose={() => setNewProjectOpen(false)} />
      <RagModal open={ragModalOpen} onOpenChange={setRagModalOpen} />
    </>
  )
}

export function Sidebar({ mobileOpen, onCloseMobile, desktopCollapsed = false, onToggleDesktop }: SidebarProps): JSX.Element {
  return (
    <>
      <div className="hidden lg:block">
        <SidebarContent collapsed={desktopCollapsed} onNavigate={() => undefined} onToggleCollapse={onToggleDesktop} />
      </div>
      <div className="hidden md:block lg:hidden">
        <SidebarContent collapsed={true} onNavigate={() => undefined} />
      </div>

      <AnimatePresence>
        {mobileOpen ? (
          <>
            <motion.button
              key="mobile-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/30 md:hidden"
              onClick={onCloseMobile}
            />
            <motion.div
              key="mobile-sidebar"
              initial={{ x: -240 }}
              animate={{ x: 0 }}
              exit={{ x: -240 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="fixed left-0 top-0 z-50 md:hidden"
            >
              <SidebarContent collapsed={false} onNavigate={onCloseMobile} />
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  )
}
