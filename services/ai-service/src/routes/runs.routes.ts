import { zValidator } from '@hono/zod-validator'
import { StartAgentRunSchema } from '@repo/validators'
import { Hono } from 'hono'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'

import * as agentOutputsQueries from '../db/queries/agentOutputs.queries.js'
import * as agentRunsQueries from '../db/queries/agentRuns.queries.js'
import { getRedis } from '../lib/redis.js'
import { accepted, err, ok } from '../lib/response.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { agentRunQueue, getConcurrencyForPlan } from '../queues/agentRun.queue.js'
import { checkTokenBudget } from '../services/tokenBudget.service.js'
import { selectModel } from '../services/modelRouter.service.js'
import { subscribeToStream } from '../services/streamingService.js'

import type { AgentType } from '@repo/types'

const PHASE_AGENT_MAP: Record<number, readonly AgentType[]> = {
  1: ['idea_analyzer', 'market_research'],
  2: ['prd_generator', 'user_flow', 'system_design', 'uiux'],
  3: ['generate_frame'],
  4: ['skeleton', 'schema_generator', 'api_generator', 'backend', 'frontend', 'integration'],
  5: ['testing', 'cicd'],
  6: ['analytics', 'feedback_analyzer', 'growth_strategy'],
}

const RUN_DETAIL_CACHE_PREFIX = 'ai:run:detail:'
const RUN_DETAIL_TTL_SEC = 30
const STREAM_MAX_MS = 120_000
const DEFAULT_ESTIMATED_TOKENS = 8000

const routes = new Hono()

routes.use('*', requireAuth)

routes.post('/runs', zValidator('json', StartAgentRunSchema), async (c) => {
  const userId = c.get('userId' as never) as string
  const plan = c.get('userPlan' as never) as string
  const body = c.req.valid('json')
  const allowed = PHASE_AGENT_MAP[body.phase]
  if (!allowed?.includes(body.agentType)) {
    return err(c, 422, 'INVALID_AGENT_FOR_PHASE', 'Agent type is not valid for the selected phase')
  }

  const activeByUser = await agentRunsQueries.findActiveRunsByUser(userId)
  const limit = getConcurrencyForPlan(plan)
  if (activeByUser.length >= limit) {
    return err(c, 422, 'CONCURRENT_RUN_LIMIT', 'Too many concurrent agent runs for your plan')
  }

  const samePhase = await agentRunsQueries.findActiveRunsByProject(body.projectId, body.phase)
  if (samePhase.length > 0) {
    return err(c, 422, 'AGENT_ALREADY_RUNNING', 'An agent run is already active for this phase')
  }

  const ctx = body.context as { userMessage?: string; estimatedTokens?: number } | undefined
  const estimatedTokens =
    typeof ctx?.estimatedTokens === 'number' && ctx.estimatedTokens > 0
      ? ctx.estimatedTokens
      : DEFAULT_ESTIMATED_TOKENS

  const budget = await checkTokenBudget(userId, estimatedTokens)
  if (!budget.allowed) {
    return err(c, 422, 'TOKEN_BUDGET_EXCEEDED', 'Token budget exceeded for this billing period')
  }

  const runId = randomUUID()
  const model = body.model ?? selectModel(body.agentType)

  await agentRunsQueries.createAgentRun({
    id: runId,
    projectId: body.projectId,
    userId,
    phase: body.phase,
    agentType: body.agentType,
    model,
    status: 'pending',
    contextTokensEstimate: estimatedTokens,
  })

  await agentRunQueue.add(
    'run',
    {
      runId,
      projectId: body.projectId,
      userId,
      phase: body.phase,
      agentType: body.agentType,
      userMessage: typeof ctx?.userMessage === 'string' ? ctx.userMessage : undefined,
      requestId: c.get('requestId' as never) as string | undefined,
      authorization: c.req.header('Authorization'),
    },
    { jobId: runId },
  )

  return accepted(c, {
    runId,
    streamUrl: `/ai/runs/${runId}/stream`,
    agentType: body.agentType,
    phase: body.phase,
    model,
    estimatedTokens,
    status: 'pending',
  })
})

routes.get('/runs/:runId/stream', async (c) => {
  const userId = c.get('userId' as never) as string
  const runId = c.req.param('runId')
  const run = await agentRunsQueries.findAgentRunById(runId)
  if (!run) {
    return err(c, 404, 'RUN_NOT_FOUND', 'Agent run not found')
  }
  if (run.userId !== userId) {
    return err(c, 403, 'FORBIDDEN', 'You do not have access to this run')
  }

  const encoder = new TextEncoder()

  if (run.status === 'completed') {
    const output = await agentOutputsQueries.findOutputByRunId(runId)
    const payload = JSON.stringify({
      type: 'complete',
      runId,
      output: output ?? null,
      ts: Date.now(),
    })
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`))
        controller.close()
      },
    })
    return new Response(body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  }

  if (run.status === 'failed' || run.status === 'cancelled') {
    const payload = JSON.stringify({
      type: 'error',
      runId,
      code: run.errorCode ?? 'RUN_TERMINATED',
      message: run.errorMessage ?? run.status,
      ts: Date.now(),
    })
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`))
        controller.close()
      },
    })
    return new Response(body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  }

  let unsubscribe: (() => Promise<void>) | undefined
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const maxTimer = setTimeout(() => {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'error', code: 'TIMEOUT', message: 'Stream timed out', runId, ts: Date.now() })}\n\n`,
          ),
        )
        void unsubscribe?.().finally(() => controller.close())
      }, STREAM_MAX_MS)

      const { unsubscribe: unsub } = await subscribeToStream(
        runId,
        (raw) => {
          if (raw.startsWith(':')) {
            controller.enqueue(encoder.encode(raw))
          } else {
            controller.enqueue(encoder.encode(`data: ${raw}\n\n`))
          }
        },
        () => {
          clearTimeout(maxTimer)
          controller.close()
        },
      )
      unsubscribe = unsub
    },
    cancel() {
      void unsubscribe?.()
    },
  })

  return new Response(body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
})

routes.get('/runs/:runId', async (c) => {
  const userId = c.get('userId' as never) as string
  const runId = c.req.param('runId')
  const cacheKey = `${RUN_DETAIL_CACHE_PREFIX}${runId}`
  const redis = getRedis()
  try {
    const cached = await redis.get(cacheKey)
    if (cached) {
      const parsed = JSON.parse(cached) as { userId: string; run: unknown }
      if (parsed.userId === userId) {
        return ok(c, parsed.run)
      }
    }
  } catch {
    /* ignore cache */
  }

  const run = await agentRunsQueries.findAgentRunById(runId)
  if (!run) {
    return err(c, 404, 'RUN_NOT_FOUND', 'Agent run not found')
  }
  if (run.userId !== userId) {
    return err(c, 403, 'FORBIDDEN', 'You do not have access to this run')
  }

  try {
    await redis.setex(cacheKey, RUN_DETAIL_TTL_SEC, JSON.stringify({ userId, run }))
  } catch {
    /* ignore */
  }

  return ok(c, run)
})

routes.get('/runs', async (c) => {
  const userId = c.get('userId' as never) as string
  const projectId = c.req.query('projectId')
  if (!projectId) {
    return err(c, 400, 'PROJECT_ID_REQUIRED', 'Query parameter projectId is required')
  }
  const page = z.coerce.number().int().min(1).catch(1).parse(c.req.query('page'))
  const limit = z.coerce.number().int().min(1).max(100).catch(20).parse(c.req.query('limit'))
  const phaseRaw = c.req.query('phase')
  const phase =
    phaseRaw !== undefined && phaseRaw !== '' ? z.coerce.number().int().min(1).max(6).parse(phaseRaw) : undefined

  const listOpts: { page: number; limit: number; userId: string; phase?: number } = {
    page,
    limit,
    userId,
  }
  if (phase !== undefined) {
    listOpts.phase = phase
  }
  const project = await agentRunsQueries.findAgentRunsByProject(projectId, listOpts)
  return ok(c, { data: project.data, total: project.total, page, limit })
})

routes.post('/runs/:runId/cancel', async (c) => {
  const userId = c.get('userId' as never) as string
  const runId = c.req.param('runId')
  const run = await agentRunsQueries.findAgentRunById(runId)
  if (!run) {
    return err(c, 404, 'RUN_NOT_FOUND', 'Agent run not found')
  }
  if (run.userId !== userId) {
    return err(c, 403, 'FORBIDDEN', 'You do not have access to this run')
  }
  const updated = await agentRunsQueries.cancelAgentRun(runId)
  try {
    const job = await agentRunQueue.getJob(runId)
    if (job) await job.remove()
  } catch {
    /* ignore */
  }
  return ok(c, { run: updated ?? run })
})

routes.post('/runs/:runId/retry', async (c) => {
  const userId = c.get('userId' as never) as string
  const plan = c.get('userPlan' as never) as string
  const oldId = c.req.param('runId')
  const prev = await agentRunsQueries.findAgentRunById(oldId)
  if (!prev) {
    return err(c, 404, 'RUN_NOT_FOUND', 'Agent run not found')
  }
  if (prev.userId !== userId) {
    return err(c, 403, 'FORBIDDEN', 'You do not have access to this run')
  }
  if (prev.status !== 'failed') {
    return err(c, 422, 'RUN_NOT_RETRYABLE', 'Only failed runs can be retried')
  }

  const activeByUser = await agentRunsQueries.findActiveRunsByUser(userId)
  if (activeByUser.length >= getConcurrencyForPlan(plan)) {
    return err(c, 422, 'CONCURRENT_RUN_LIMIT', 'Too many concurrent agent runs for your plan')
  }

  const samePhase = await agentRunsQueries.findActiveRunsByProject(prev.projectId, prev.phase)
  if (samePhase.length > 0) {
    return err(c, 422, 'AGENT_ALREADY_RUNNING', 'An agent run is already active for this phase')
  }

  const runId = randomUUID()
  const model = selectModel(prev.agentType as AgentType)

  await agentRunsQueries.createAgentRun({
    id: runId,
    projectId: prev.projectId,
    userId,
    phase: prev.phase,
    agentType: prev.agentType as AgentType,
    model,
    status: 'pending',
    retryOfRunId: oldId,
    contextTokensEstimate: prev.contextTokensEstimate ?? DEFAULT_ESTIMATED_TOKENS,
  })

  await agentRunQueue.add(
    'run',
    {
      runId,
      projectId: prev.projectId,
      userId,
      phase: prev.phase,
      agentType: prev.agentType as AgentType,
      requestId: c.get('requestId' as never) as string | undefined,
      authorization: c.req.header('Authorization'),
    },
    { jobId: runId },
  )

  return accepted(c, {
    runId,
    streamUrl: `/ai/runs/${runId}/stream`,
    agentType: prev.agentType,
    phase: prev.phase,
    model,
    status: 'pending',
    retryOfRunId: oldId,
  })
})

routes.get('/token-budget', async (c) => {
  const userId = c.get('userId' as never) as string
  const b = await checkTokenBudget(userId, 0)
  return ok(c, { remaining: b.remaining, limit: b.limit })
})

export default routes
