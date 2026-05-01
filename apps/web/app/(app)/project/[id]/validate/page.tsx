'use client'

import { use, useEffect, useState } from 'react'

import { AgentStatusStrip } from '@/components/phases/AgentStatusStrip'
import { ChatPanel, type ChatMessage } from '@/components/phases/ChatPanel'
import { ValidationOutputCards } from '@/components/phases/phase1/ValidationOutputCards'
import { ContextPanel } from '@/components/layout/ContextPanel'
import { useProject } from '@/hooks/useProject'
import { useUIStore } from '@/store/uiStore'
import type { Phase1Output } from '@/types'

export default function ValidatePage({ params }: { params: Promise<{ id: string }> }): JSX.Element {
  const { id: projectId } = use(params)
  const { data: project } = useProject(projectId)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [agentStatuses, setAgentStatuses] = useState<
    Array<{ agentType: string; label: string; status: 'idle' | 'running' | 'complete' | 'error'; tokenCount?: number }>
  >([
    { agentType: 'idea_analyzer', label: 'Idea Analyzer', status: 'idle' },
    { agentType: 'market_research', label: 'Market Research', status: 'idle' },
    { agentType: 'validation', label: 'Validation', status: 'idle' },
  ])
  const [existingPhase1Output] = useState<Phase1Output | undefined>(undefined)
  const setContextPanelOpen = useUIStore((state) => state.setContextPanelOpen)

  useEffect(() => {
    setContextPanelOpen(true)
    return () => setContextPanelOpen(false)
  }, [setContextPanelOpen])

  const isAnyAgentRunning = agentStatuses.some((agent) => agent.status === 'running')

  return (
    <div className="flex h-full">
      <ChatPanel
        projectId={projectId}
        phase={1}
        headerLabel="Idea Validator"
        placeholder="Describe your startup idea..."
        messages={messages}
        isAgentRunning={isAnyAgentRunning}
        onSend={(message) => {
          setMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), role: 'user', content: message, timestamp: new Date() },
          ])
        }}
      />
      <main className="flex-1 overflow-y-auto bg-output px-6 py-6 max-md:px-4">
        <ValidationOutputCards
          projectId={projectId}
          buildMode={project?.buildMode ?? 'copilot'}
          {...(existingPhase1Output ? { existingOutput: existingPhase1Output } : {})}
          {...(() => {
            const initialMessage = messages.find((message) => message.role === 'user')?.content
            return initialMessage ? { initialUserMessage: initialMessage } : {}
          })()}
          onStatusesChange={setAgentStatuses}
        />
      </main>
      <ContextPanel>
        <AgentStatusStrip agents={agentStatuses} phase={1} />
      </ContextPanel>
    </div>
  )
}
