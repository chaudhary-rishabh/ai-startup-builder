import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const streamText = vi.hoisted(() => ({ current: '{}' }))

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = {
      stream: vi.fn(() => {
        const text = streamText.current
        return {
          async *[Symbol.asyncIterator]() {
            yield {
              type: 'content_block_delta',
              delta: { type: 'text_delta', text },
            }
          },
          finalMessage: async () => ({
            usage: { input_tokens: 5, output_tokens: Math.max(1, Math.ceil(text.length / 4)) },
          }),
        }
      }),
    }
  }
  return { default: MockAnthropic }
})

const updateAgentRunStatus = vi.hoisted(() => vi.fn())
const createAgentOutput = vi.hoisted(() => vi.fn())
const publishStreamEvent = vi.hoisted(() => vi.fn())
const publishStreamChunk = vi.hoisted(() => vi.fn())
const resolveDocumentContext = vi.hoisted(() => vi.fn())
const fetchProjectContext = vi.hoisted(() => vi.fn())
const fetchConversationHistory = vi.hoisted(() => vi.fn())
const saveAgentOutputToProject = vi.hoisted(() => vi.fn())
const saveDesignTokensToCanvas = vi.hoisted(() => vi.fn())
const appendFrameToCanvas = vi.hoisted(() => vi.fn())
const recordTokenUsage = vi.hoisted(() => vi.fn())
const publishAgentRunCompleted = vi.hoisted(() => vi.fn())
const checkAndEmitBudgetWarnings = vi.hoisted(() => vi.fn())

vi.mock('../../src/db/queries/agentRuns.queries.js', () => ({
  updateAgentRunStatus,
}))

vi.mock('../../src/db/queries/agentOutputs.queries.js', () => ({
  createAgentOutput,
}))

vi.mock('../../src/events/publisher.js', () => ({
  publishAgentRunCompleted,
}))

vi.mock('../../src/services/streamingService.js', () => ({
  publishStreamEvent,
  publishStreamChunk,
}))

vi.mock('../../src/services/documentIntelligence.service.js', () => ({
  resolveDocumentContext,
}))

vi.mock('../../src/services/contextThread.service.js', () => ({
  fetchProjectContext,
  fetchConversationHistory,
  saveAgentOutputToProject,
  saveDesignTokensToCanvas,
  appendFrameToCanvas,
}))

vi.mock('../../src/services/tokenBudget.service.js', () => ({
  recordTokenUsage,
  checkAndEmitBudgetWarnings,
}))

const pid = '660e8400-e29b-41d4-a716-446655440001'
const uid = '550e8400-e29b-41d4-a716-446655440000'

let executeAgentRun: (typeof import('../../src/services/agentOrchestrator.service.js'))['executeAgentRun']

describe('phase 2 agent flow (integration-style)', () => {
  let phase2Blob: Record<string, unknown> = {}

  beforeAll(async () => {
    const { registerAllAgents } = await import('../../src/agents/index.js')
    registerAllAgents()
    const mod = await import('../../src/services/agentOrchestrator.service.js')
    executeAgentRun = mod.executeAgentRun
  })

  beforeEach(() => {
    vi.clearAllMocks()
    phase2Blob = {}
    updateAgentRunStatus.mockResolvedValue(undefined)
    createAgentOutput.mockResolvedValue(undefined)
    publishStreamEvent.mockResolvedValue(undefined)
    publishStreamChunk.mockResolvedValue(undefined)
    resolveDocumentContext.mockResolvedValue({
      mode: 'direct',
      content: 'PRD_DOC_BODY',
      tokenCount: 50,
      docCount: 1,
      wasCompressed: false,
      ragUsed: false,
    })
    fetchProjectContext.mockImplementation(async () => ({
      projectId: pid,
      projectName: 'Co',
      currentPhase: 2,
      phase1Output: {
        problem: 'p',
        solution: 's',
        icp: { description: 'Founder' },
      } as never,
      phase2Output: phase2Blob as never,
    }))
    fetchConversationHistory.mockResolvedValue([])
    saveAgentOutputToProject.mockImplementation(async (_p, phase, data: Record<string, unknown>) => {
      if (phase === 2) Object.assign(phase2Blob, data)
    })
    saveDesignTokensToCanvas.mockResolvedValue(undefined)
    appendFrameToCanvas.mockResolvedValue(undefined)
    recordTokenUsage.mockResolvedValue(undefined)
    publishAgentRunCompleted.mockResolvedValue(undefined)
    checkAndEmitBudgetWarnings.mockResolvedValue(undefined)
  })

  it('system_design output: frontendStack always non-empty after parse', async () => {
    streamText.current = '{}'
    await executeAgentRun({
      runId: 'c10e8400-e29b-41d4-a716-446655440099',
      projectId: pid,
      userId: uid,
      phase: 2,
      agentType: 'system_design',
    })
    const last = createAgentOutput.mock.calls.at(-1)?.[0] as { outputData: Record<string, unknown> }
    expect(String(last.outputData['frontendStack']).length).toBeGreaterThan(0)
    expect(last.outputData['frontendStack']).toBe('Next.js 15')
  })

  it('uiux: saveDesignTokensToCanvas called, appendFrameToCanvas not called', async () => {
    streamText.current = JSON.stringify({
      screens: [
        {
          name: 'Home',
          route: '/',
          description: 'Landing',
          html: '<div class="min-h-screen bg-slate-50 p-4"><span class="text-slate-900">Hi</span></div>',
        },
      ],
      designSystem: {
        colors: {
          primary: '#111111',
          background: '#fff',
          text: '#000',
          muted: '#999',
          border: '#eee',
          success: '#0a0',
          error: '#a00',
        },
        typography: { fontFamily: 'Inter', h1: 't', h2: 't', body: 't', small: 't' },
        spacing: { base: '1', card: '2', section: '3' },
        borderRadius: { button: '1', card: '2', input: '3' },
      },
      components: [],
      screenCount: 1,
    })
    await executeAgentRun({
      runId: 'c20e8400-e29b-41d4-a716-446655440099',
      projectId: pid,
      userId: uid,
      phase: 2,
      agentType: 'uiux',
    })
    expect(saveDesignTokensToCanvas).toHaveBeenCalled()
    expect(appendFrameToCanvas).not.toHaveBeenCalled()
  })

  it('prd_generator receives document content from resolveDocumentContext', async () => {
    streamText.current = JSON.stringify({
      features: [
        {
          id: '1',
          name: 'Core',
          priority: 'must',
          description: 'd',
          userStory: 's',
          acceptanceCriteria: [],
        },
      ],
      targetUsers: 'u',
      problemStatement: 'ps',
      successMetrics: { primary: 'x', secondary: [] },
      outOfScope: ['a', 'b', 'c'],
      risks: [],
    })
    await executeAgentRun({
      runId: 'c30e8400-e29b-41d4-a716-446655440099',
      projectId: pid,
      userId: uid,
      phase: 2,
      agentType: 'prd_generator',
    })
    expect(resolveDocumentContext).toHaveBeenCalled()
    const agentTypeArg = resolveDocumentContext.mock.calls.at(-1)?.[3] as string
    expect(agentTypeArg).toBe('prd_generator')
  })

  it('user_flow does not use RAG (resolveDocumentContext skipped for non-RAG agent)', async () => {
    streamText.current = JSON.stringify({
      steps: [
        {
          id: '1',
          label: 'Start',
          type: 'action',
          description: 'd',
          dropOffRisk: 'low',
          branches: null,
        },
      ],
      ahaMoment: '1',
      criticalDropOffPoint: '1',
      retentionTrigger: 'email',
      stepCount: 1,
    })
    await executeAgentRun({
      runId: 'c40e8400-e29b-41d4-a716-446655440099',
      projectId: pid,
      userId: uid,
      phase: 2,
      agentType: 'user_flow',
    })
    expect(resolveDocumentContext).not.toHaveBeenCalled()
  })
})
