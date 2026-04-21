import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import Redis from 'ioredis'

import { agentOutputs, agentRuns, generationPlans } from '../../src/db/schema.js'
import { getDb } from '../../src/lib/db.js'
import { getRedis } from '../../src/lib/redis.js'
import { env } from '../../src/config/env.js'

import { signTestAccessToken } from '../jwt-test.js'

const skipFullFlow = process.env['SKIP_FULL_FLOW'] === '1'

const streamState = vi.hoisted(() => ({
  text: '{}',
  delayFirstChunkMs: 0,
}))

const anthropicMessages = vi.hoisted(() => ({
  stream: vi.fn(),
  create: vi.fn(),
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = anthropicMessages
  },
}))

type ProjectStore = {
  contextByProject: Map<string, Record<string, unknown>>
  filesByProject: Map<string, Map<string, string>>
  canvasByProject: Map<string, unknown[]>
}

function createProjectStore(): ProjectStore {
  return {
    contextByProject: new Map(),
    filesByProject: new Map(),
    canvasByProject: new Map(),
  }
}

function ensureProject(store: ProjectStore, projectId: string): Record<string, unknown> {
  if (!store.contextByProject.has(projectId)) {
    store.contextByProject.set(projectId, {
      projectId,
      projectName: 'FlowCo',
      currentPhase: 1,
      phase1Output: {},
      phase2Output: {},
      phase3Output: { screens: [] as unknown[] },
    })
  }
  if (!store.filesByProject.has(projectId)) store.filesByProject.set(projectId, new Map())
  if (!store.canvasByProject.has(projectId)) store.canvasByProject.set(projectId, [])
  return store.contextByProject.get(projectId)!
}

function deepMergePhase(ctx: Record<string, unknown>, phase: number, outputData: Record<string, unknown>) {
  if (phase === 1) {
    const cur = (ctx['phase1Output'] as Record<string, unknown>) ?? {}
    ctx['phase1Output'] = { ...cur, ...outputData }
  } else if (phase === 2) {
    const cur = (ctx['phase2Output'] as Record<string, unknown>) ?? {}
    ctx['phase2Output'] = { ...cur, ...outputData }
  } else if (phase === 3) {
    const cur = (ctx['phase3Output'] as Record<string, unknown>) ?? { screens: [] }
    ctx['phase3Output'] = { ...cur, ...outputData }
  }
}

function installFetchMock(store: ProjectStore) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const method = (init?.method ?? 'GET').toUpperCase()

    if (url.includes('/internal/token-budget')) {
      return new Response(JSON.stringify({ success: true, data: { tokensUsed: 0, tokensLimit: 50_000 } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (url.includes('/internal/token-usage/increment')) {
      return new Response(JSON.stringify({ success: true }), { status: 200 })
    }

    if (url.includes('/rag/documents?') && !url.includes('/text')) {
      return new Response(JSON.stringify({ documents: [{ id: 'doc-1', filename: 'big.txt' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (url.includes('/rag/documents/') && url.includes('/text')) {
      const body = 'word '.repeat(12_000)
      return new Response(JSON.stringify({ text: body }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const mContext = url.match(/\/internal\/projects\/([^/]+)\/context/)
    if (mContext && method === 'GET') {
      const pid = mContext[1]!
      const ctx = ensureProject(store, decodeURIComponent(pid))
      return new Response(JSON.stringify({ success: true, data: ctx }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const mPhaseOut = url.match(/\/internal\/projects\/([^/]+)\/phases\/(\d+)\/output/)
    if (mPhaseOut && method === 'POST') {
      const pid = decodeURIComponent(mPhaseOut[1]!)
      const phase = Number(mPhaseOut[2])
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      const outputData = (body as { outputData?: Record<string, unknown> }).outputData ?? {}
      const ctx = ensureProject(store, pid)
      deepMergePhase(ctx, phase, outputData)
      return new Response(JSON.stringify({ success: true }), { status: 200 })
    }

    const mFilesPost = url.match(/\/internal\/projects\/([^/]+)\/files$/)
    if (mFilesPost && method === 'POST') {
      const pid = decodeURIComponent(mFilesPost[1]!)
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      const path = String((body as { path?: string }).path ?? '')
      const content = String((body as { content?: string }).content ?? '')
      ensureProject(store, pid)
      store.filesByProject.get(pid)!.set(path, content)
      return new Response(JSON.stringify({ success: true }), { status: 200 })
    }

    const mFileContent = url.match(/\/internal\/projects\/([^/]+)\/files\/content\?path=([^&]+)/)
    if (mFileContent && method === 'GET') {
      const pid = decodeURIComponent(mFileContent[1]!)
      const p = decodeURIComponent(mFileContent[2]!)
      const map = store.filesByProject.get(pid)
      const content = map?.get(p) ?? ''
      return new Response(JSON.stringify({ success: true, data: { content } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const mListFiles = url.match(/\/internal\/projects\/([^/]+)\/files$/)
    if (mListFiles && method === 'GET' && !url.includes('/files/content')) {
      const pid = decodeURIComponent(mListFiles[1]!)
      const map = store.filesByProject.get(pid) ?? new Map()
      const data = [...map.entries()].map(([path, content]) => ({ path, content }))
      return new Response(JSON.stringify({ success: true, data }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (url.includes('/canvas/append-frame') && method === 'POST') {
      const m = url.match(/\/internal\/projects\/([^/]+)\/canvas\/append-frame/)
      const pid = m ? decodeURIComponent(m[1]!) : ''
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      const arr = store.canvasByProject.get(pid) ?? []
      arr.push(body)
      store.canvasByProject.set(pid, arr)
      return new Response(JSON.stringify({ success: true }), { status: 200 })
    }

    if (url.includes('/internal/projects/') && url.endsWith('/canvas')) {
      const m = url.match(/\/internal\/projects\/([^/]+)\/canvas/)
      const pid = m ? decodeURIComponent(m[1]!) : ''
      if (method === 'GET') {
        return new Response(JSON.stringify({ data: { canvasData: store.canvasByProject.get(pid) ?? [] } }), {
          status: 200,
        })
      }
      if (method === 'PUT') {
        return new Response(JSON.stringify({ success: true }), { status: 200 })
      }
    }

    if (url.includes('/projects/') && url.includes('/conversations')) {
      return new Response(JSON.stringify({ success: true, data: { messages: [] } }), { status: 200 })
    }

    return new Response(JSON.stringify({ error: 'unmocked', url }), { status: 404 })
  })
}

async function waitForRunStatus(app: Hono, token: string, runId: string, status: string, timeoutMs = 60_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const res = await app.request(`http://localhost/ai/runs/${runId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const json = (await res.json()) as { data?: { status?: string } }
    if (json.data?.status === status) return
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`timeout waiting for run ${runId} status ${status}`)
}

describe.skipIf(skipFullFlow)('Full AI Service Flow', () => {
  const uid = '550e8400-e29b-41d4-a716-446655440000'
  const pid = '660e8400-e29b-41d4-a716-446655440001'
  let app: Hono
  let stopWorker: () => Promise<void>
  let token: string
  const store = createProjectStore()
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeAll(async () => {
    const { createApp } = await import('../../src/app.js')
    const { startAgentRunWorker, shutdownAgentRunWorker } = await import(
      '../../src/queues/agentRun.worker.js'
    )
    app = createApp()
    const worker = startAgentRunWorker()
    stopWorker = () => shutdownAgentRunWorker(worker)

    token = await signTestAccessToken({ sub: uid, plan: 'free' })

    anthropicMessages.stream.mockImplementation(() => {
      const text = streamState.text
      const delay = streamState.delayFirstChunkMs
      return {
        async *[Symbol.asyncIterator]() {
          if (delay > 0) await new Promise((r) => setTimeout(r, delay))
          yield {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text },
          }
        },
        finalMessage: async () => ({
          usage: { input_tokens: 5, output_tokens: Math.max(1, Math.ceil(text.length / 4)) },
        }),
      }
    })
    anthropicMessages.create.mockResolvedValue({
      content: [{ type: 'text', text: '# Doc\n\nBody\n' }],
      usage: { input_tokens: 2, output_tokens: 4 },
    })

    fetchSpy = installFetchMock(store)
  })

  afterAll(async () => {
    await stopWorker?.()
    fetchSpy?.mockRestore()
  })

  beforeEach(() => {
    streamState.delayFirstChunkMs = 0
  })

  it('health check returns ok', async () => {
    const res = await app.request('http://localhost/health')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { status: string; service: string }
    expect(body.status).toBe('ok')
    expect(body.service).toBe('ai-service')
  })

  it('token budget returns limits', async () => {
    const res = await app.request('http://localhost/ai/token-budget', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { data: { remaining: number; limit: number } }
    expect(body.data.limit).toBeGreaterThan(0)
    expect(body.data.remaining).toBeGreaterThanOrEqual(0)
  })

  it('phase 1 idea_analyzer completes with clarityScore', async () => {
    streamState.text = JSON.stringify({
      problem: 'Busy professionals lack time to train',
      solution: 'AI fitness coach in pocket',
      icp: {
        description: 'Busy professionals',
        demographics: '25-45 urban',
        painPoints: ['time'],
        willingnessToPay: 'medium',
      },
      assumptions: [],
      clarityScore: 75,
    })

    const res = await app.request('http://localhost/ai/runs', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId: pid,
        phase: 1,
        agentType: 'idea_analyzer',
        context: { userMessage: 'AI fitness app for busy professionals' },
      }),
    })
    expect(res.status).toBe(202)
    const started = (await res.json()) as { data: { runId: string } }
    const runId = started.data.runId
    await waitForRunStatus(app, token, runId, 'completed')

    const db = getDb()
    const [row] = await db.select().from(agentOutputs).where(eq(agentOutputs.runId, runId)).limit(1)
    expect(row).toBeDefined()
    const od = row!.outputData as Record<string, unknown>
    expect(od['clarityScore']).toBe(75)
  })

  it('phase 1 market_research publishes cross_check 1B on stream', async () => {
    streamState.text = JSON.stringify({
      competitors: [{ name: 'FitCo', description: 'd', pricing: 'p', strengths: [], weaknesses: [], targetMarket: 't' }],
      marketGap: 'gap',
      positioning: 'pos',
      pricingSuggestion: { model: 'sub', range: '$10-30', rationale: 'r' },
      marketSize: { tam: '1', sam: '1', som: '1' },
      demandScore: 78,
      scoreBreakdown: {},
      risks: [
        { description: 'r1', severity: 'high', mitigation: 'm' },
        { description: 'r2', severity: 'medium', mitigation: 'm' },
      ],
      verdict: 'yes',
      verdictReason: 'Strong demand.',
      nextSteps: [],
      keyQuestion: 'q',
    })

    const res = await app.request('http://localhost/ai/runs', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId: pid,
        phase: 1,
        agentType: 'market_research',
        context: {},
      }),
    })
    expect(res.status).toBe(202)
    const started = (await res.json()) as { data: { runId: string } }
    const runId = started.data.runId

    const sub = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })
    const events: string[] = []
    await sub.subscribe(`ai:stream:${runId}`)
    sub.on('message', (_ch, msg) => events.push(msg))

    await waitForRunStatus(app, token, runId, 'completed')
    await sub.quit().catch(() => undefined)

    const saw1b = events.some((m) => m.includes('check_1b_market'))
    expect(saw1b).toBe(true)
  })

  it('phase 2 uiux sets estimate key and emits cross checks', async () => {
    streamState.text = JSON.stringify({
      screens: [
        {
          name: 'Home',
          route: '/',
          description: 'Landing',
          html: '<div class="min-h-screen bg-slate-100 p-4"><p class="text-slate-800">Hi</p></div>',
        },
      ],
      designSystem: {
        colors: {
          primary: '#3B82F6',
          background: '#FFFFFF',
          text: '#111827',
          muted: '#64748B',
          border: '#E2E8F0',
          success: '#22C55E',
          error: '#EF4444',
        },
        typography: {
          fontFamily: 'Inter',
          h1: 'text-3xl',
          h2: 'text-xl',
          body: 'text-base',
          small: 'text-sm',
        },
        spacing: { base: '4', card: '4', section: '8' },
        borderRadius: { button: 'md', card: 'lg', input: 'md' },
      },
      components: [],
      screenCount: 1,
    })

    const res = await app.request('http://localhost/ai/runs', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId: pid,
        phase: 2,
        agentType: 'uiux',
        context: {},
      }),
    })
    expect(res.status).toBe(202)
    const started = (await res.json()) as { data: { runId: string } }
    const runId = started.data.runId

    const sub = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })
    const events: string[] = []
    await sub.subscribe(`ai:stream:${runId}`)
    sub.on('message', (_ch, msg) => events.push(msg))

    await waitForRunStatus(app, token, runId, 'completed')
    await sub.quit().catch(() => undefined)

    const r = getRedis()
    const est = await r.get(`ai:estimate:${pid}`)
    expect(est).toBeTruthy()
    expect(events.some((m) => m.includes('check_0_estimate'))).toBe(true)
    expect(events.some((m) => m.includes('check_2_phase2'))).toBe(true)
  })

  it('phase 3 generate_frame saves prototype html', async () => {
    streamState.text =
      '<div class="min-h-screen bg-gray-50 p-6"><p class="text-gray-900">Login prototype</p></div>'

    const res = await app.request('http://localhost/ai/runs', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId: pid,
        phase: 3,
        agentType: 'generate_frame',
        context: { userMessage: 'Login Screen' },
      }),
    })
    expect(res.status).toBe(202)
    const started = (await res.json()) as { data: { runId: string } }
    await waitForRunStatus(app, token, started.data.runId, 'completed')

    const saved = store.filesByProject.get(pid)?.get('/prototypes/Login Screen.html')
    expect(saved).toBeTruthy()
    expect(saved!).toContain('min-h-screen')
  })

  it('phase 4 skeleton persists generation plan', async () => {
    streamState.text = JSON.stringify([
      {
        path: 'src/db/schema.sql',
        description: 'schema',
        layer: 'db',
        batchNumber: 1,
        complexity: 'simple',
        estimatedLines: 20,
        dependencies: [],
      },
      {
        path: 'app/login/page.tsx',
        description: 'Login',
        layer: 'frontend-page',
        batchNumber: 2,
        complexity: 'medium',
        estimatedLines: 80,
        dependencies: [],
      },
    ])

    const res = await app.request('http://localhost/ai/runs', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId: pid,
        phase: 4,
        agentType: 'skeleton',
        context: {},
      }),
    })
    expect(res.status).toBe(202)
    const started = (await res.json()) as { data: { runId: string } }
    await waitForRunStatus(app, token, started.data.runId, 'completed')

    const db = getDb()
    const [plan] = await db.select().from(generationPlans).where(eq(generationPlans.projectId, pid)).limit(1)
    expect(plan).toBeDefined()
    expect(plan!.totalFiles).toBeGreaterThan(0)
    expect(plan!.status).toBe('pending')
  })

  it('document intelligence direct mode for market_research with large docs', async () => {
    streamState.text = JSON.stringify({
      competitors: [{ name: 'A', description: 'd', pricing: 'p', strengths: [], weaknesses: [], targetMarket: 't' }],
      marketGap: 'g',
      positioning: 'p',
      pricingSuggestion: { model: 'm', range: 'r', rationale: 'r' },
      marketSize: { tam: '1', sam: '1', som: '1' },
      demandScore: 55,
      scoreBreakdown: {},
      risks: [
        { description: 'r1', severity: 'high', mitigation: 'm' },
        { description: 'r2', severity: 'medium', mitigation: 'm' },
      ],
      verdict: 'yes',
      verdictReason: 'ok',
      nextSteps: [],
      keyQuestion: 'q',
    })

    const res = await app.request('http://localhost/ai/runs', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId: pid,
        phase: 1,
        agentType: 'market_research',
        context: {},
      }),
    })
    expect(res.status).toBe(202)
    const started = (await res.json()) as { data: { runId: string } }
    const runId = started.data.runId

    const sub = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })
    const payloads: string[] = []
    await sub.subscribe(`ai:stream:${runId}`)
    sub.on('message', (_ch, msg) => payloads.push(msg))

    await waitForRunStatus(app, token, runId, 'completed')
    await sub.quit().catch(() => undefined)

    const db = getDb()
    const [run] = await db.select().from(agentRuns).where(eq(agentRuns.id, runId)).limit(1)
    expect(run!.docInjectionMode).toBe('direct')
    expect(payloads.some((m) => m.includes('doc_mode') && m.includes('direct'))).toBe(true)
  })

  it('rejects concurrent second run for same phase', async () => {
    streamState.delayFirstChunkMs = 3000
    streamState.text = JSON.stringify({
      problem: 'p',
      solution: 's',
      icp: {
        description: 'd',
        demographics: 'd',
        painPoints: [],
        willingnessToPay: 'low',
      },
      assumptions: [],
      clarityScore: 50,
    })

    const first = await app.request('http://localhost/ai/runs', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId: pid,
        phase: 1,
        agentType: 'idea_analyzer',
        context: { userMessage: 'slow' },
      }),
    })
    expect(first.status).toBe(202)

    const second = await app.request('http://localhost/ai/runs', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId: pid,
        phase: 1,
        agentType: 'idea_analyzer',
        context: { userMessage: 'x' },
      }),
    })
    expect(second.status).toBe(422)
    const errBody = (await second.json()) as { error?: { code?: string } }
    expect(errBody.error?.code).toBe('AGENT_ALREADY_RUNNING')

    const json = (await first.json()) as { data: { runId: string } }
    await waitForRunStatus(app, token, json.data.runId, 'completed')
    streamState.delayFirstChunkMs = 0
  })

  it('rejects invalid agent for phase', async () => {
    const res = await app.request('http://localhost/ai/runs', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId: pid,
        phase: 1,
        agentType: 'schema_generator',
        context: {},
      }),
    })
    expect(res.status).toBe(422)
    const body = (await res.json()) as { error?: { code?: string } }
    expect(body.error?.code).toBe('INVALID_AGENT_FOR_PHASE')
  })

  it('smoke: eight agents through skeleton produce docs, plan, prototype, canvas', async () => {
    const projectId = '770e8400-e29b-41d4-a716-446655440002'
    ensureProject(store, projectId)

    const steps: Array<{ phase: number; agent: string; text: string; ctx?: Record<string, unknown> }> = [
      {
        phase: 1,
        agent: 'idea_analyzer',
        text: JSON.stringify({
          problem: 'p',
          solution: 's',
          icp: {
            description: 'd',
            demographics: 'd',
            painPoints: [],
            willingnessToPay: 'low',
          },
          assumptions: [],
          clarityScore: 60,
        }),
      },
      {
        phase: 1,
        agent: 'market_research',
        text: JSON.stringify({
          competitors: [
            {
              name: 'Co',
              description: 'd',
              pricing: 'p',
              strengths: [],
              weaknesses: [],
              targetMarket: 't',
            },
          ],
          marketGap: 'g',
          positioning: 'p',
          pricingSuggestion: { model: 'm', range: 'r', rationale: 'r' },
          marketSize: { tam: '1', sam: '1', som: '1' },
          demandScore: 60,
          scoreBreakdown: {},
          risks: [
            { description: 'r1', severity: 'high', mitigation: 'm' },
            { description: 'r2', severity: 'medium', mitigation: 'm' },
          ],
          verdict: 'yes',
          verdictReason: 'ok',
          nextSteps: [],
          keyQuestion: 'q',
        }),
      },
      {
        phase: 2,
        agent: 'prd_generator',
        text: JSON.stringify({
          features: [
            {
              id: 'f1',
              name: 'Auth',
              priority: 'must',
              description: 'Login',
              userStory: 'As a user I want login',
              acceptanceCriteria: ['Given guest When login Then session'],
            },
          ],
          targetUsers: 'Founders',
          problemStatement: 'Need auth',
          successMetrics: { primary: '10 signups', secondary: [] },
          outOfScope: ['Blockchain', 'Mobile native', 'Offline mode'],
          risks: ['Scope creep'],
          featureCount: { must: 1, should: 0, could: 0, wont: 0 },
        }),
      },
      {
        phase: 2,
        agent: 'user_flow',
        text: JSON.stringify({
          steps: [
            {
              id: 's1',
              label: 'Open app',
              type: 'action',
              description: 'User lands',
              dropOffRisk: 'none',
              branches: null,
            },
          ],
          ahaMoment: 'First value',
          criticalDropOffPoint: 'Signup',
          retentionTrigger: 'Email',
          stepCount: 1,
        }),
      },
      {
        phase: 2,
        agent: 'system_design',
        text: JSON.stringify({
          frontendStack: 'Next.js 15',
          frontendRationale: 'SSR',
          backendStack: 'Node.js + Hono',
          backendRationale: 'API',
          dbChoice: 'PostgreSQL',
          dbRationale: 'Relational',
          authStrategy: 'JWT sessions',
          authRationale: 'Simple',
          deploymentPlan: { frontend: 'Vercel', backend: 'Railway', database: 'Supabase' },
          apiEndpoints: [{ method: 'POST', path: '/api/login', description: 'Login for login page', auth: false }],
          estimatedMonthlyCost: '$50',
          scalabilityNote: 'Vertical first',
          architecture: 'single-repo',
        }),
      },
      {
        phase: 2,
        agent: 'uiux',
        text: JSON.stringify({
          screens: [
            {
              name: 'Login',
              route: '/login',
              description: 'Auth',
              html: '<div class="min-h-screen bg-white p-4"><p class="text-gray-900">Login</p></div>',
            },
          ],
          designSystem: {
            colors: {
              primary: '#3B82F6',
              background: '#FFFFFF',
              text: '#111827',
              muted: '#64748B',
              border: '#E2E8F0',
              success: '#22C55E',
              error: '#EF4444',
            },
            typography: { fontFamily: 'Inter', h1: 't', h2: 't', body: 't', small: 't' },
            spacing: { base: '4', card: '4', section: '8' },
            borderRadius: { button: 'md', card: 'lg', input: 'md' },
          },
          components: [],
          screenCount: 1,
        }),
      },
      {
        phase: 3,
        agent: 'generate_frame',
        text: '<div class="min-h-screen bg-slate-50 p-4"><span class="text-slate-800">Frame</span></div>',
        ctx: { userMessage: 'Dashboard' },
      },
      {
        phase: 4,
        agent: 'skeleton',
        text: JSON.stringify([
          {
            path: 'src/x.sql',
            description: 'db',
            layer: 'db',
            batchNumber: 1,
            complexity: 'simple',
            estimatedLines: 10,
            dependencies: [],
          },
        ]),
      },
    ]

    for (const step of steps) {
      streamState.text = step.text
      const res = await app.request('http://localhost/ai/runs', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          phase: step.phase,
          agentType: step.agent,
          context: step.ctx ?? {},
        }),
      })
      expect(res.status).toBe(202)
      const body = (await res.json()) as { data: { runId: string } }
      await waitForRunStatus(app, token, body.data.runId, 'completed')
    }

    const db = getDb()
    const runs = await db.select().from(agentRuns).where(eq(agentRuns.projectId, projectId))
    expect(runs.length).toBeGreaterThanOrEqual(8)

    const [plan] = await db
      .select()
      .from(generationPlans)
      .where(eq(generationPlans.projectId, projectId))
      .limit(1)
    expect(plan).toBeDefined()

    expect(store.filesByProject.get(projectId)?.get('/docs/01-validation-report.md')).toBeTruthy()
    expect(store.filesByProject.get(projectId)?.get('/docs/02-prd.md')).toBeTruthy()
    expect(store.filesByProject.get(projectId)?.get('/prototypes/Dashboard.html')).toBeTruthy()
    expect((store.canvasByProject.get(projectId) ?? []).length).toBeGreaterThan(0)
  })
})
