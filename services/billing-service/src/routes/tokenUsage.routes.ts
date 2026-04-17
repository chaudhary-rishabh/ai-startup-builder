import { Hono } from 'hono'

import { err, ok } from '../lib/response.js'
import { getRedis } from '../lib/redis.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { getTokenBudget } from '../services/tokenUsage.service.js'

const routes = new Hono()
routes.use('*', requireAuth)

async function rateLimitOk(userId: string, bucket: string, max: number, windowSec: number): Promise<boolean> {
  const redis = getRedis()
  const k = `billing:rl:${bucket}:${userId}`
  const n = await redis.incr(k)
  if (n === 1) await redis.expire(k, windowSec)
  return n <= max
}

routes.get('/token-usage', async (c) => {
  const userId = c.get('userId' as never) as string
  if (!(await rateLimitOk(userId, 'token-usage', 60, 60))) {
    return err(c, 429, 'RATE_LIMIT', 'Too many requests')
  }
  const usage = await getTokenBudget(userId)
  return ok(c, usage)
})

export default routes
