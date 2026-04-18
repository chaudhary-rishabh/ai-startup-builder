import { beforeEach, describe, expect, it, vi } from 'vitest'

const messagesCreate = vi.hoisted(() => vi.fn())

vi.mock('@anthropic-ai/sdk', () => ({
  default: class AnthropicMock {
    messages = { create: messagesCreate }
  },
}))

const checkTokenBudget = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ allowed: true, remaining: 50_000, limit: 50_000 }),
)
const recordTokenUsage = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

vi.mock('../../src/services/tokenBudget.service.js', () => ({
  checkTokenBudget,
  recordTokenUsage,
}))

const { createApp } = await import('../../src/app.js')
const { signTestAccessToken } = await import('../jwt-test.js')

describe('chat routes', () => {
  let app: ReturnType<typeof createApp>
  let token: string

  beforeEach(async () => {
    vi.clearAllMocks()
    app = createApp()
    token = await signTestAccessToken({ sub: '550e8400-e29b-41d4-a716-446655440000' })
    messagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'hello' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    })
  })

  it('POST /ai/chat returns content and token counts', async () => {
    const res = await app.request('http://localhost/ai/chat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Say hi' }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      data: { content: string; tokensUsed: number; model: string }
    }
    expect(body.data.content).toBe('hello')
    expect(body.data.tokensUsed).toBe(15)
    expect(recordTokenUsage).toHaveBeenCalled()
  })
})
