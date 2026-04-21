import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ProjectContext } from '@repo/types'

const findPlanByProjectId = vi.hoisted(() => vi.fn())
const updatePlanProgress = vi.hoisted(() => vi.fn())
const anthropicMessages = vi.hoisted(() => ({
  create: vi.fn(),
  stream: vi.fn(),
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = anthropicMessages
  },
}))

vi.mock('../../src/db/queries/generationPlans.queries.js', () => ({
  findPlanByProjectId,
  updatePlanProgress,
}))

vi.mock('../../src/services/streamingService.js', () => ({
  publishStreamChunk: vi.fn(),
  publishStreamEvent: vi.fn(),
}))

vi.mock('../../src/services/tokenBudget.service.js', () => ({
  recordTokenUsage: vi.fn(),
}))

import { registerAllAgents } from '../../src/agents/index.js'
import { orchestratePhase4 } from '../../src/services/batchOrchestrator.service.js'
import { publishStreamEvent } from '../../src/services/streamingService.js'

describe('orchestratePhase4', () => {
  const ctx = { projectId: 'p', projectName: 'P', currentPhase: 4 } as ProjectContext
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    registerAllAgents()
    vi.clearAllMocks()
    vi.mocked(publishStreamEvent).mockResolvedValue(undefined)
    anthropicMessages.create.mockReset()
    anthropicMessages.create.mockResolvedValue({
      content: [{ type: 'text', text: '[]' }],
      usage: { input_tokens: 5, output_tokens: 6 },
    })
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const s = String(input)
      if (s.includes('/internal/projects/p1/files') && !s.includes('/files/content')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: [
              { path: 'src/index.ts', content: 'x'.repeat(80) },
              { path: 'app/layout.tsx', content: 'y'.repeat(80) },
              { path: '.env.example', content: 'z'.repeat(80) },
            ],
          }),
          { status: 200 },
        )
      }
      return new Response('{}', { status: 404 })
    })
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('no-ops for skeleton agent type', async () => {
    await orchestratePhase4('r1', 'p1', 'u1', 'skeleton', ctx)
    expect(findPlanByProjectId).not.toHaveBeenCalled()
  })

  it('integration: loads files and publishes cross_check 3C', async () => {
    findPlanByProjectId.mockResolvedValue({
      id: 'plan-1',
      projectId: 'p1',
      planData: { files: [] },
      tier: 'small',
      totalFiles: 3,
      totalBatches: 1,
      architecture: 'single-repo',
      status: 'pending',
      completedBatches: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never)

    await orchestratePhase4('r1', 'p1', 'u1', 'integration', ctx)

    expect(findPlanByProjectId).toHaveBeenCalledWith('p1')
    expect(anthropicMessages.create).toHaveBeenCalledTimes(1)
    expect(publishStreamEvent).toHaveBeenCalledWith(
      'r1',
      'cross_check',
      expect.objectContaining({ check: 'integration_audit' }),
    )
    expect(publishStreamEvent).toHaveBeenCalledWith(
      'r1',
      'cross_check',
      expect.objectContaining({ check: '3C' }),
    )
  })

  it('throws when backend runs without a saved plan', async () => {
    findPlanByProjectId.mockResolvedValue(undefined)
    await expect(orchestratePhase4('r1', 'p1', 'u1', 'backend', ctx)).rejects.toThrow(
      'Run skeleton agent first',
    )
  })
})
