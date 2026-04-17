import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getRedis } from '../../src/lib/redis.js'
import {
  publishAgentRunCompleted,
  publishTokenBudgetWarning,
} from '../../src/events/publisher.js'

describe('publisher', () => {
  let xaddSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    const redis = getRedis()
    xaddSpy = vi.spyOn(redis, 'xadd').mockResolvedValue('1-0' as never)
  })

  afterEach(() => {
    xaddSpy?.mockRestore()
  })

  it('publishAgentRunCompleted writes stream event fields', async () => {
    await publishAgentRunCompleted(
      'r1',
      'p1',
      'u1',
      2,
      'prd_generator',
      { a: 1 },
      100,
      50,
      'claude-opus-4-5',
    )
    expect(xaddSpy).toHaveBeenCalled()
    const args = xaddSpy.mock.calls[0] as string[]
    const payloadIdx = args.indexOf('payload') + 1
    const payload = JSON.parse(args[payloadIdx] as string) as { agentType: string; tokensUsed: number }
    expect(payload.agentType).toBe('prd_generator')
    expect(payload.tokensUsed).toBe(100)
  })

  it('publishTokenBudgetWarning emits warning payload', async () => {
    await publishTokenBudgetWarning('u1', 80, 40_000, 50_000)
    const args = xaddSpy.mock.calls[0] as string[]
    const payloadIdx = args.indexOf('payload') + 1
    const payload = JSON.parse(args[payloadIdx] as string) as { percentUsed: number }
    expect(payload.percentUsed).toBe(80)
  })
})
