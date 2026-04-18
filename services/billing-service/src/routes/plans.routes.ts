import { Hono } from 'hono'

import { findAllActivePlans } from '../db/queries/plans.queries.js'
import { err, ok } from '../lib/response.js'
import { getRedis } from '../lib/redis.js'
import { env } from '../config/env.js'

const routes = new Hono()

async function rateLimitOk(bucket: string, max: number, windowSec: number): Promise<boolean> {
  const redis = getRedis()
  const k = `billing:rl:${bucket}`
  const n = await redis.incr(k)
  if (n === 1) await redis.expire(k, windowSec)
  return n <= max
}

routes.get('/plans', async (c) => {
  if (!(await rateLimitOk('plans-public', 60, 60))) {
    return err(c, 429, 'RATE_LIMIT', 'Too many requests')
  }

  const redis = getRedis()
  const cacheKey = 'plans:public'
  const cached = await redis.get(cacheKey)
  if (cached) {
    try {
      return ok(c, JSON.parse(cached) as { plans: unknown[] })
    } catch {
      // continue
    }
  }

  const plans = await findAllActivePlans()
  const payload = {
    plans: plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      displayName: plan.displayName,
      priceMonthlyCents: plan.priceMonthlyCents,
      priceYearlyCents: plan.priceYearlyCents,
      tokenLimitMonthly: plan.tokenLimitMonthly,
      projectLimit: plan.projectLimit,
      apiKeyLimit: plan.apiKeyLimit,
      features: plan.features,
      sortOrder: plan.sortOrder,
    })),
  }
  await redis.setex(cacheKey, env.PLANS_CACHE_TTL, JSON.stringify(payload))
  return ok(c, payload)
})

export default routes
