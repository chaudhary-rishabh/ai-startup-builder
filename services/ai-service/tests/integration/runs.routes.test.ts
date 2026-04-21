import { beforeEach, describe, expect, it, vi } from 'vitest'

const queueAdd = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const createAgentRun = vi.hoisted(() => vi.fn().mockResolvedValue({}))
const findActiveRunsByUser = vi.hoisted(() => vi.fn().mockResolvedValue([]))
const findActiveRunsByProject = vi.hoisted(() => vi.fn().mockResolvedValue([]))
const findAgentRunsByProject = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ data: [], total: 0 }),
)
const findAgentRunById = vi.hoisted(() => vi.fn())
const cancelAgentRun = vi.hoisted(() => vi.fn())
const getJob = vi.hoisted(() => vi.fn())

vi.mock('../../src/queues/agentRun.queue.js', () => ({
  agentRunQueue: {
    add: queueAdd,
    getJob,
  },
  getConcurrencyForPlan: (plan: string) => (plan === 'enterprise' ? 100 : 1),
}))

vi.mock('../../src/db/queries/agentRuns.queries.js', () => ({
  createAgentRun,
  findActiveRunsByUser,
  findActiveRunsByProject,
  findAgentRunsByProject,
  findAgentRunById,
  cancelAgentRun,
}))

const checkTokenBudget = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ allowed: true, remaining: 50_000, limit: 50_000 }),
)

vi.mock('../../src/services/tokenBudget.service.js', () => ({
  checkTokenBudget,
}))

const { createApp } = await import('../../src/app.js')
const { signTestAccessToken } = await import('../jwt-test.js')

const uid = '550e8400-e29b-41d4-a716-446655440000'
const pid = '660e8400-e29b-41d4-a716-446655440001'

describe('runs routes', () => {
  let app: ReturnType<typeof createApp>
  let token: string

  beforeEach(async () => {
    vi.clearAllMocks()
    app = createApp()
    token = await signTestAccessToken({ sub: uid, plan: 'free' })
    queueAdd.mockResolvedValue(undefined)
    createAgentRun.mockResolvedValue({})
    findActiveRunsByUser.mockResolvedValue([])
    findActiveRunsByProject.mockResolvedValue([])
    findAgentRunsByProject.mockResolvedValue({ data: [], total: 0 })
    checkTokenBudget.mockResolvedValue({ allowed: true, remaining: 50_000, limit: 50_000 })
    getJob.mockResolvedValue(null)
  })

  it('POST /ai/runs wrong phase/agentType → 422 INVALID_AGENT_FOR_PHASE', async () => {
    const res = await app.request('http://localhost/ai/runs', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: pid,
        phase: 1,
        agentType: 'prd_generator',
      }),
    })
    expect(res.status).toBe(422)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('INVALID_AGENT_FOR_PHASE')
  })

  it('POST /ai/runs at concurrency limit → 422 CONCURRENT_RUN_LIMIT', async () => {
    findActiveRunsByUser.mockResolvedValue([{ id: '1' }, { id: '2' }] as never[])
    const res = await app.request('http://localhost/ai/runs', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: pid,
        phase: 2,
        agentType: 'prd_generator',
      }),
    })
    expect(res.status).toBe(422)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('CONCURRENT_RUN_LIMIT')
  })

  it('POST /ai/runs phase already running → 422 AGENT_ALREADY_RUNNING', async () => {
    findActiveRunsByProject.mockResolvedValue([{ id: 'x' }] as never[])
    const res = await app.request('http://localhost/ai/runs', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: pid,
        phase: 2,
        agentType: 'prd_generator',
      }),
    })
    expect(res.status).toBe(422)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('AGENT_ALREADY_RUNNING')
  })

  it('POST /ai/runs budget exceeded → 422 TOKEN_BUDGET_EXCEEDED', async () => {
    checkTokenBudget.mockResolvedValue({ allowed: false, remaining: 100, limit: 50_000 })
    const res = await app.request('http://localhost/ai/runs', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: pid,
        phase: 2,
        agentType: 'prd_generator',
      }),
    })
    expect(res.status).toBe(422)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('TOKEN_BUDGET_EXCEEDED')
  })

  it('POST /ai/runs valid → 202 with runId and streamUrl', async () => {
    const res = await app.request('http://localhost/ai/runs', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: pid,
        phase: 2,
        agentType: 'prd_generator',
      }),
    })
    expect(res.status).toBe(202)
    const body = (await res.json()) as { data: { runId: string; streamUrl: string; status: string } }
    expect(body.data.status).toBe('pending')
    expect(body.data.runId).toMatch(/^[0-9a-f-]{36}$/i)
    expect(body.data.streamUrl).toContain('/ai/runs/')
    expect(queueAdd).toHaveBeenCalled()
  })

  it('GET /ai/runs/:runId wrong user → 403', async () => {
    findAgentRunById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440099',
      userId: '770e8400-e29b-41d4-a716-446655440002',
    } as never)
    const res = await app.request('http://localhost/ai/runs/550e8400-e29b-41d4-a716-446655440099', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(403)
  })

  it('POST /ai/runs/:runId/cancel → 200', async () => {
    findAgentRunById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440099',
      userId: uid,
      status: 'running',
    } as never)
    cancelAgentRun.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440099', status: 'cancelled' } as never)
    const res = await app.request('http://localhost/ai/runs/550e8400-e29b-41d4-a716-446655440099/cancel', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
  })

  it('GET /ai/runs requires projectId', async () => {
    const res = await app.request('http://localhost/ai/runs', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(400)
  })

  it('GET /ai/runs returns paginated data', async () => {
    findAgentRunsByProject.mockResolvedValueOnce({
      data: [
        {
          id: '1',
          projectId: pid,
          userId: uid,
          phase: 2,
          agentType: 'prd_generator',
          model: 'claude-opus-4-5',
          status: 'completed',
        } as never,
      ],
      total: 1,
    })
    const res = await app.request(`http://localhost/ai/runs?projectId=${pid}&page=1&limit=10`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
  })

  it('GET /ai/runs/:runId returns run', async () => {
    findAgentRunById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440099',
      userId: uid,
      projectId: pid,
      phase: 2,
      status: 'completed',
      agentType: 'prd_generator',
      model: 'claude-opus-4-5',
    } as never)
    const res = await app.request('http://localhost/ai/runs/550e8400-e29b-41d4-a716-446655440099', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
  })

  it('POST /ai/runs/:runId/retry on completed → 422 RUN_NOT_RETRYABLE', async () => {
    findAgentRunById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440099',
      userId: uid,
      status: 'completed',
      projectId: pid,
      phase: 2,
      agentType: 'prd_generator',
    } as never)
    const res = await app.request('http://localhost/ai/runs/550e8400-e29b-41d4-a716-446655440099/retry', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(422)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('RUN_NOT_RETRYABLE')
  })
})
