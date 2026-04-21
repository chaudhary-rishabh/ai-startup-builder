import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const triggers: Record<string, ReturnType<typeof vi.fn>> = {}

vi.mock('@/hooks/useAgentRun', () => ({
  useAgentRun: (opts: { agentType: string }) => {
    const key = opts.agentType
    if (!triggers[key]) triggers[key] = vi.fn()
    return {
      status: 'idle',
      runId: null,
      streamedText: '',
      docMode: null,
      crossChecks: [],
      tokensUsed: 0,
      isStreaming: false,
      trigger: triggers[key],
      cancel: vi.fn(),
      reset: vi.fn(),
    }
  },
}))

import { AgentButtons } from '@/components/phases/phase4/AgentButtons'

describe('AgentButtons', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const k of Object.keys(triggers)) {
      delete triggers[k]
    }
  })

  const base = {
    projectId: 'p1',
    onAgentStart: vi.fn(),
    onAgentComplete: vi.fn(),
    onFilesAppear: vi.fn(),
    onTerminalToken: vi.fn(),
    onFileStart: vi.fn(),
    onFileComplete: vi.fn(),
    onBatchStart: vi.fn(),
    onBatchComplete: vi.fn(),
    onRegisterStop: vi.fn(),
    hasExistingFiles: false,
  }

  it('renders 5 buttons in order', () => {
    render(<AgentButtons {...base} buildMode="copilot" autopilotStart={false} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThanOrEqual(5)
    expect(screen.getByTestId('agent-btn-schema_gen')).toBeInTheDocument()
    expect(screen.getByTestId('agent-btn-api_gen')).toBeInTheDocument()
  })

  it('clicking schema triggers useAgentRun.trigger', async () => {
    const user = userEvent.setup()
    render(<AgentButtons {...base} buildMode="copilot" autopilotStart={false} />)
    await user.click(screen.getByTestId('agent-btn-schema_gen'))
    expect(triggers.schema_gen).toHaveBeenCalled()
  })

  it('API button is visually disabled before schema in copilot', () => {
    render(<AgentButtons {...base} buildMode="copilot" autopilotStart={false} />)
    const api = screen.getByTestId('agent-btn-api_gen')
    expect(api.className).toMatch(/opacity-40/)
  })
})
