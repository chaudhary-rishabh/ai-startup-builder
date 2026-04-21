import { Hono } from 'hono'
import { z } from 'zod'

import { env } from '../config/env.js'
import { findSubscriptionByUserId } from '../db/queries/subscriptions.queries.js'
import { err, ok } from '../lib/response.js'
import { getRedis } from '../lib/redis.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { listInvoices } from '../services/stripe.service.js'

const routes = new Hono()
routes.use('*', requireAuth)

const limitSchema = z.coerce.number().int().min(1).max(50).default(10)

async function rateLimitOk(userId: string, bucket: string, max: number, windowSec: number): Promise<boolean> {
  const redis = getRedis()
  const k = `billing:rl:${bucket}:${userId}`
  const n = await redis.incr(k)
  if (n === 1) await redis.expire(k, windowSec)
  return n <= max
}

routes.get('/invoices', async (c) => {
  const userId = c.get('userId' as never) as string
  if (!(await rateLimitOk(userId, 'invoices', 30, 60))) {
    return err(c, 429, 'RATE_LIMIT', 'Too many requests')
  }

  const redis = getRedis()
  const cacheKey = `billing:invoices:${userId}`
  const cached = await redis.get(cacheKey)
  if (cached) {
    try {
      return ok(c, JSON.parse(cached) as { invoices: unknown[] })
    } catch {
      // continue
    }
  }

  const sub = await findSubscriptionByUserId(userId)
  if (!sub?.stripeCustomerId) {
    return ok(c, { invoices: [] as unknown[] })
  }

  const parsedLimit = limitSchema.safeParse(c.req.query('limit') ?? '10')
  const limit = parsedLimit.success ? parsedLimit.data : 10
  const stripeInvoices = await listInvoices(sub.stripeCustomerId, limit)
  const invoices = stripeInvoices.map((inv) => ({
    id: inv.id,
    number: inv.number,
    amountPaid: inv.amount_paid,
    currency: inv.currency,
    status: inv.status,
    periodStart:
      inv.period_start !== null && inv.period_start !== undefined
        ? new Date(inv.period_start * 1000).toISOString()
        : null,
    periodEnd:
      inv.period_end !== null && inv.period_end !== undefined
        ? new Date(inv.period_end * 1000).toISOString()
        : null,
    pdfUrl: inv.invoice_pdf,
    hostedInvoiceUrl: inv.hosted_invoice_url,
    createdAt: new Date(inv.created * 1000).toISOString(),
  }))
  const payload = { invoices }
  await redis.setex(cacheKey, Math.max(120, env.SUBSCRIPTION_CACHE_TTL), JSON.stringify(payload))
  return ok(c, payload)
})

export default routes
