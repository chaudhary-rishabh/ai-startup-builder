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

describe('phase 1 agent flow (integration-style)', () => {
  let phase1Blob: Record<string, unknown> = {}

  beforeAll(async () => {
    const { registerAllAgents } = await import('../../src/agents/index.js')
    registerAllAgents()
    const mod = await import('../../src/services/agentOrchestrator.service.js')
    executeAgentRun = mod.executeAgentRun
  })

  beforeEach(() => {
    vi.clearAllMocks()
    phase1Blob = {}
    updateAgentRunStatus.mockResolvedValue(undefined)
    createAgentOutput.mockResolvedValue(undefined)
    publishStreamEvent.mockResolvedValue(undefined)
    publishStreamChunk.mockResolvedValue(undefined)
    resolveDocumentContext.mockResolvedValue({
      mode: 'none',
      content: '',
      tokenCount: 0,
      docCount: 0,
      wasCompressed: false,
      ragUsed: false,
    })
    fetchProjectContext.mockImplementation(async () => ({
      projectId: pid,
      projectName: 'FlowCo',
      currentPhase: 1,
      phase1Output: phase1Blob as never,
    }))
    fetchConversationHistory.mockResolvedValue([])
    saveAgentOutputToProject.mockImplementation(async (_p, phase, data: Record<string, unknown>) => {
      if (phase === 1) Object.assign(phase1Blob, data)
    })
    saveDesignTokensToCanvas.mockResolvedValue(undefined)
    appendFrameToCanvas.mockResolvedValue(undefined)
    recordTokenUsage.mockResolvedValue(undefined)
    publishAgentRunCompleted.mockResolvedValue(undefined)
    checkAndEmitBudgetWarnings.mockResolvedValue(undefined)
  })

  it('idea_analyzer completes with valid JSON from SDK', async () => {
    streamText.current = JSON.stringify({
      problem: 'Founders lose time on ops.',
      solution: 'We automate ops with AI.',
      icp: {
        description: 'Solo technical founder',
        demographics: 'US',
        painPoints: ['ops'],
        willingnessToPay: '$49',
      },
      assumptions: [],
      clarityScore: 58,
    })
    await executeAgentRun({
      runId: '770e8400-e29b-41d4-a716-446655440088',
      projectId: pid,
      userId: uid,
      phase: 1,
      agentType: 'idea_analyzer',
    })
    const last = createAgentOutput.mock.calls.at(-1)?.[0] as {
      parseSuccess: boolean
      outputData: Record<string, unknown>
    }
    expect(last?.parseSuccess).toBe(true)
    expect(last?.outputData['problem']).toContain('Founders')
  })

  it('market_validator receives merged phase1 context and documentContent when docs exist', async () => {
    phase1Blob = {
      problem: 'P0',
      solution: 'S0',
      icp: { description: 'ICP0' },
    }
    resolveDocumentContext.mockResolvedValue({
      mode: 'direct',
      content: 'MARKET_RESEARCH_DOC',
      tokenCount: 100,
      docCount: 1,
      wasCompressed: false,
      ragUsed: false,
    })
    streamText.current = JSON.stringify({
      competitors: [
        {
          name: 'Acme Co',
          description: 'd',
          pricing: 'p',
          strengths: [],
          weaknesses: [],
          targetMarket: 't',
        },
      ],
      marketGap: 'gap',
      positioning: 'pos',
      pricingSuggestion: { model: 'sub', range: '$10-20', rationale: 'r' },
      marketSize: { tam: '1', sam: '2', som: '3' },
      demandScore: 55,
      scoreBreakdown: {},
      risks: [
        { description: 'r1', severity: 'high', mitigation: 'm' },
        { description: 'r2', severity: 'low', mitigation: 'm' },
      ],
      verdict: 'yes',
      verdictReason: 'Reason one. Reason two.',
      nextSteps: [],
      keyQuestion: 'q',
    })
    await executeAgentRun({
      runId: '880e8400-e29b-41d4-a716-446655440099',
      projectId: pid,
      userId: uid,
      phase: 1,
      agentType: 'market_research',
    })
    expect(resolveDocumentContext).toHaveBeenCalled()
    expect(phase1Blob['problem']).toBe('P0')
    expect(phase1Blob['verdict']).toBe('yes')
  })

  it('market_validator uses empty documentContent when no docs', async () => {
    phase1Blob = { problem: 'P', solution: 'S', icp: {} }
    resolveDocumentContext.mockResolvedValue({
      mode: 'none',
      content: '',
      tokenCount: 0,
      docCount: 0,
      wasCompressed: false,
      ragUsed: false,
    })
    streamText.current = JSON.stringify({
      competitors: [],
      marketGap: 'none',
      positioning: 'p',
      pricingSuggestion: { model: 'm', range: 'r', rationale: 'x' },
      marketSize: { tam: '1', sam: '1', som: '1' },
      demandScore: 40,
      scoreBreakdown: {},
      risks: [
        { description: 'r1', severity: 'low', mitigation: 'm' },
        { description: 'r2', severity: 'low', mitigation: 'm' },
      ],
      verdict: 'pivot',
      verdictReason: 'a. b.',
      nextSteps: [],
      keyQuestion: 'q',
    })
    await executeAgentRun({
      runId: '990e8400-e29b-41d4-a716-446655440099',
      projectId: pid,
      userId: uid,
      phase: 1,
      agentType: 'market_research',
    })
    expect(phase1Blob['verdict']).toBe('pivot')
  })

  it('both agents: parseSuccess=false when SDK returns invalid JSON but data populated', async () => {
    streamText.current = 'NOT_JSON_AT_ALL'
    await executeAgentRun({
      runId: 'aa0e8400-e29b-41d4-a716-446655440099',
      projectId: pid,
      userId: uid,
      phase: 1,
      agentType: 'idea_analyzer',
    })
    const ideaOut = createAgentOutput.mock.calls.at(-1)?.[0] as {
      parseSuccess: boolean
      outputData: Record<string, unknown>
    }
    expect(ideaOut.parseSuccess).toBe(false)
    expect(String(ideaOut.outputData['problem']).length).toBeGreaterThan(0)

    phase1Blob = { problem: 'P', solution: 'S', icp: {} }
    resolveDocumentContext.mockResolvedValue({
      mode: 'none',
      content: '',
      tokenCount: 0,
      docCount: 0,
      wasCompressed: false,
      ragUsed: false,
    })
    streamText.current = 'also not json'
    await executeAgentRun({
      runId: 'bb0e8400-e29b-41d4-a716-446655440099',
      projectId: pid,
      userId: uid,
      phase: 1,
      agentType: 'market_research',
    })
    const mkt = createAgentOutput.mock.calls.at(-1)?.[0] as {
      parseSuccess: boolean
      outputData: Record<string, unknown>
    }
    expect(mkt.parseSuccess).toBe(false)
    expect(mkt.outputData['verdict']).toBeDefined()
  })
})
