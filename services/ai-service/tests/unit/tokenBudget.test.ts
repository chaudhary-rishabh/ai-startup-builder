import { afterEach, describe, expect, it, vi } from 'vitest'

describe('tokenBudget.service', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('allowed=true when remaining > estimated', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { tokensUsed: 1000, tokensLimit: 50_000 },
      }),
    })
    const { checkTokenBudget } = await import('../../src/services/tokenBudget.service.js')
    const r = await checkTokenBudget('550e8400-e29b-41d4-a716-446655440000', 1000)
    expect(r.allowed).toBe(true)
    expect(r.remaining).toBe(49_000)
  })

  it('allowed=false when remaining < estimated', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { tokensUsed: 49_000, tokensLimit: 50_000 },
      }),
    })
    const { checkTokenBudget } = await import('../../src/services/tokenBudget.service.js')
    const r = await checkTokenBudget('550e8400-e29b-41d4-a716-446655440000', 5000)
    expect(r.allowed).toBe(false)
  })

  it('recordTokenUsage swallows fetch errors', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('down'))
    const { recordTokenUsage } = await import('../../src/services/tokenBudget.service.js')
    await expect(
      recordTokenUsage('550e8400-e29b-41d4-a716-446655440000', 10, '0.001'),
    ).resolves.toBeUndefined()
  })

  it('fail-open when billing-service is down', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network'))
    const { checkTokenBudget } = await import('../../src/services/tokenBudget.service.js')
    const r = await checkTokenBudget('550e8400-e29b-41d4-a716-446655440000', 1_000_000)
    expect(r.allowed).toBe(true)
    expect(r.limit).toBe(999_999)
  })
})
