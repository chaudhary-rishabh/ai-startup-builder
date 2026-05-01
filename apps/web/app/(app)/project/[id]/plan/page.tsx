'use client'

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'

import { CopilotQuestionCard } from '@/components/phases/CopilotQuestionCard'
import { AgentStatusStrip } from '@/components/phases/AgentStatusStrip'
import { ChatPanel, type ChatMessage } from '@/components/phases/ChatPanel'
import { PRDTabs } from '@/components/phases/phase2/PRDTabs'
import { ContextPanel } from '@/components/layout/ContextPanel'
import { usePhaseAdvance } from '@/hooks/usePhaseAdvance'
import { useProject } from '@/hooks/useProject'
import api from '@/lib/axios'
import { useUIStore } from '@/store/uiStore'
import type { Phase2Output } from '@/types'

type TabKey = 'prd' | 'flow' | 'system' | 'uiux'

const placeholderMap: Record<TabKey, string> = {
  prd: 'Ask about features, user stories, priorities...',
  flow: 'Ask about user journey, flows, drop-off points...',
  system: 'Ask about tech stack, architecture, APIs...',
  uiux: 'Ask about screens, wireframes, design tokens...',
}

const tabToAgent: Record<TabKey, 'prd' | 'user_flow' | 'system_design' | 'uiux'> = {
  prd: 'prd',
  flow: 'user_flow',
  system: 'system_design',
  uiux: 'uiux',
}

export default function PlanPage({ params }: { params: Promise<{ id: string }> }): JSX.Element {
  const { id: projectId } = use(params)
  const setContextPanelOpen = useUIStore((state) => state.setContextPanelOpen)
  const { data: project } = useProject(projectId)
  const [activeTab, setActiveTab] = useState<TabKey>('prd')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [copilotAnswered, setCopilotAnswered] = useState(false)
  const [agentStatuses, setAgentStatuses] = useState<
    Array<{ agentType: string; label: string; status: 'idle' | 'running' | 'complete' | 'error'; tokenCount?: number }>
  >([
    { agentType: 'prd', label: 'PRD Generator', status: 'idle' },
    { agentType: 'user_flow', label: 'User Flow', status: 'idle' },
    { agentType: 'system_design', label: 'System Design', status: 'idle' },
    { agentType: 'uiux', label: 'UI/UX Agent', status: 'idle' },
  ])
  const [pendingMessage, setPendingMessage] = useState<{ tab: TabKey; message: string; nonce: number } | null>(null)
  const [exporting, setExporting] = useState(false)
  const triggerRef = useRef<((tab: TabKey) => Promise<void>) | null>(null)

  useEffect(() => {
    setContextPanelOpen(true)
    return () => setContextPanelOpen(false)
  }, [setContextPanelOpen])

  const allAgentsComplete = useMemo(
    () => agentStatuses.every((agent) => agent.status === 'complete'),
    [agentStatuses],
  )

  const phaseAdvance = usePhaseAdvance({
    projectId,
    currentPhase: 2,
    buildMode: project?.buildMode ?? 'copilot',
    allAgentsComplete,
    copilotAnswered,
  })

  const statusByAgent = useMemo(
    () =>
      agentStatuses.reduce<Record<string, 'idle' | 'running' | 'complete' | 'error'>>((acc, status) => {
        acc[status.agentType] = status.status
        return acc
      }, {}),
    [agentStatuses],
  )

  const isAgentRunning = agentStatuses.some((status) => status.status === 'running')

  const handleStatusChange = useCallback(
    (
      agentType: 'prd' | 'user_flow' | 'system_design' | 'uiux',
      status: 'idle' | 'running' | 'complete' | 'error',
      tokenCount?: number,
    ) => {
      const labelMap: Record<'prd' | 'user_flow' | 'system_design' | 'uiux', string> = {
        prd: 'PRD Generator',
        user_flow: 'User Flow',
        system_design: 'System Design',
        uiux: 'UI/UX Agent',
      }
      setAgentStatuses((prev) =>
        prev.map((entry) =>
          entry.agentType === agentType
            ? {
                ...entry,
                label: labelMap[agentType],
                status,
                ...(tokenCount !== undefined ? { tokenCount } : {}),
              }
            : entry,
        ),
      )
    },
    [],
  )

  const handleChatSend = async (message: string): Promise<void> => {
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])

    const agentType = tabToAgent[activeTab]
    if (statusByAgent[agentType] !== 'complete') {
      setPendingMessage({ tab: activeTab, message, nonce: Date.now() })
      if (triggerRef.current) {
        await triggerRef.current(activeTab)
      }
      return
    }

    try {
      const response = await api.post<{ data: { content: string } }>('/ai/chat', {
        messages: [...messages, userMessage].map((item) => ({ role: item.role, content: item.content })),
        context: { projectId, phase: 2, tab: activeTab },
      })
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: response.data.data.content,
          timestamp: new Date(),
        },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'system',
          content: 'Unable to fetch response right now.',
          timestamp: new Date(),
        },
      ])
    }
  }

  const handleExport = async (): Promise<void> => {
    setExporting(true)
    try {
      const response = await api.post<Blob>(
        `/projects/${projectId}/export`,
        { format: 'docx', includePhases: [2] },
        { responseType: 'blob' },
      )
      const url = URL.createObjectURL(response.data)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${project?.name ?? 'project'}-phase2.docx`
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex h-full">
      <ChatPanel
        projectId={projectId}
        phase={2}
        headerLabel="Planning Copilot"
        placeholder={placeholderMap[activeTab]}
        chatContext={activeTab}
        messages={messages}
        isAgentRunning={isAgentRunning}
        onSend={(message) => void handleChatSend(message)}
      />

      <main className="flex-1 overflow-y-auto bg-output px-6 py-6 max-md:px-4">
        <div className="mb-3 flex items-center justify-end">
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={exporting}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-divider px-3 text-xs text-heading disabled:opacity-60"
          >
            {exporting ? <Loader2 size={12} className="animate-spin" /> : null}
            Export DOCX
          </button>
        </div>

        <PRDTabs
          projectId={projectId}
          buildMode={project?.buildMode ?? 'copilot'}
          {...(project?.phase2Output ? { existingOutput: project.phase2Output as Phase2Output } : {})}
          onAllAgentsComplete={() => {}}
          onActiveTabChange={setActiveTab}
          registerTabTrigger={(trigger) => {
            triggerRef.current = trigger
          }}
          pendingMessage={pendingMessage}
          onStatusChange={handleStatusChange}
        />

        {project?.buildMode === 'copilot' && phaseAdvance.showCopilotCard ? (
          <CopilotQuestionCard
            projectId={projectId}
            phase={2}
            {...(project?.copilotPreferences ? { episodicMemory: project.copilotPreferences } : {})}
            onSubmit={() => setCopilotAnswered(true)}
          />
        ) : null}

        <div className="mt-4">
          <button
            type="button"
            onClick={() => void phaseAdvance.advance()}
            disabled={!phaseAdvance.canAdvance || phaseAdvance.isAdvancing}
            className="h-10 rounded-md bg-brand px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            Next Phase →
          </button>
        </div>
      </main>

      <ContextPanel>
        <AgentStatusStrip agents={agentStatuses} phase={2} />
      </ContextPanel>
    </div>
  )
}
