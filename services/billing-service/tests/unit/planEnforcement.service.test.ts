import { describe, expect, it, vi } from 'vitest'

import { checkTokenBudget } from '../../src/services/planEnforcement.service.js'

const m = vi.hoisted(() => ({
  getTokenBudget: vi.fn(),
}))

vi.mock('../../src/services/tokenUsage.service.js', () => ({
  getTokenBudget: m.getTokenBudget,
}))

describe('planEnforcement.service', () => {
  it('allowed=true when remaining > estimated', async () => {
    m.getTokenBudget.mockResolvedValueOnce({
      isUnlimited: false,
      tokensRemaining: 5000,
      tokensLimit: 10000,
      percentUsed: 50,
    })
    const out = await checkTokenBudget('u', 1000)
    expect(out.allowed).toBe(true)
  })

  it('allowed=false when remaining < estimated', async () => {
    m.getTokenBudget.mockResolvedValueOnce({
      isUnlimited: false,
      tokensRemaining: 100,
      tokensLimit: 10000,
      percentUsed: 99,
    })
    const out = await checkTokenBudget('u', 1000)
    expect(out.allowed).toBe(false)
  })

  it('allowed=true when unlimited plan', async () => {
    m.getTokenBudget.mockResolvedValueOnce({
      isUnlimited: true,
      tokensRemaining: -1,
      tokensLimit: -1,
      percentUsed: 0,
    })
    const out = await checkTokenBudget('u', 1000)
    expect(out.allowed).toBe(true)
    expect(out.limit).toBe(-1)
  })

  it('fails open when dependency throws', async () => {
    m.getTokenBudget.mockRejectedValueOnce(new Error('db down'))
    const out = await checkTokenBudget('u', 1000)
    expect(out.allowed).toBe(true)
    expect(out.remaining).toBe(999999)
  })
})
