import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import { err, ok } from '../lib/response.js'
import { logger } from '../lib/logger.js'
import { checkTokenBudget } from '../services/planEnforcement.service.js'
import { incrementUsage } from '../services/tokenUsage.service.js'

const BudgetQuerySchema = z.object({
  userId: z.string().uuid(),
  estimatedTokens: z.coerce.number().int().positive(),
})

const IncrementSchema = z.object({
  userId: z.string().uuid(),
  tokensUsed: z.coerce.number().int().min(0).max(10_000_000),
  costUsd: z.string(),
})

const routes = new Hono()

routes.use('*', async (c, next) => {
  const internal = c.req.header('X-Internal-Service')
  if (internal !== 'ai-service') {
    return err(c, 403, 'INTERNAL_SERVICE_REQUIRED', 'Internal service access required')
  }
  await next()
})

routes.get('/token-budget', async (c) => {
  try {
    const parsed = BudgetQuerySchema.safeParse({
      userId: c.req.query('userId'),
      estimatedTokens: c.req.query('estimatedTokens'),
    })
    if (!parsed.success) {
      return err(c, 422, 'VALIDATION_ERROR', 'Invalid userId or estimatedTokens')
    }
    const result = await checkTokenBudget(parsed.data.userId, parsed.data.estimatedTokens)
    return ok(c, result)
  } catch (error) {
    logger.warn('GET /internal/token-budget failed open', { error })
    return ok(c, { allowed: true, remaining: 999999, limit: 999999, percentUsed: 0 })
  }
})

routes.post('/token-usage/increment', zValidator('json', IncrementSchema), async (c) => {
  try {
    const body = c.req.valid('json')
    await incrementUsage(body.userId, {
      tokensUsed: body.tokensUsed,
      costUsd: body.costUsd,
    })
    return ok(c, { updated: true })
  } catch (error) {
    logger.error('POST /internal/token-usage/increment soft-failed', { error })
    return ok(c, { updated: false })
  }
})

export default routes
