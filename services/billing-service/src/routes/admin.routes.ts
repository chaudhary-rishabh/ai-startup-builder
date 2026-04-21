import { zValidator } from '@hono/zod-validator'
import { sql } from 'drizzle-orm'
import type { Context } from 'hono'
import { Hono } from 'hono'
import { z } from 'zod'

import { createCoupon, findCouponByCode, listCoupons } from '../db/queries/coupons.queries.js'
import { findTransactionById, updateTransactionRefund } from '../db/queries/transactions.queries.js'
import { getDb } from '../lib/db.js'
import { err } from '../lib/response.js'
import { getRedis } from '../lib/redis.js'
import { stripe } from '../lib/stripe.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { createRefund } from '../services/stripe.service.js'

const routes = new Hono()
routes.use('*', requireAuth)
routes.use('*', requireAdmin)

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

function getPeriodStart(period: 'month' | 'quarter' | 'year'): Date {
  const now = new Date()
  if (period === 'year') {
    return new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0))
  }
  if (period === 'quarter') {
    const q = Math.floor(now.getUTCMonth() / 3) * 3
    return new Date(Date.UTC(now.getUTCFullYear(), q, 1, 0, 0, 0))
  }
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0))
}

async function rateLimitOk(userId: string, bucket: string, max: number, windowSec: number): Promise<boolean> {
  const redis = getRedis()
  const key = `billing:rl:admin:${bucket}:${userId}`
  const n = await redis.incr(key)
  if (n === 1) await redis.expire(key, windowSec)
  return n <= max
}

function requireSuperAdmin(c: Context): Response | null {
  const role = c.get('userRole' as never) as string
  if (role !== 'super_admin') return err(c, 403, 'FORBIDDEN', 'Super admin access required')
  return null
}

const refundSchema = z.object({
  transactionId: z.string().uuid(),
  amountCents: z.number().int().positive().optional(),
  reason: z.enum(['duplicate', 'fraudulent', 'requested_by_customer']),
  note: z.string().max(500).optional(),
})

routes.post('/admin/refund', zValidator('json', refundSchema), async (c) => {
  const userId = c.get('userId' as never) as string
  if (!(await rateLimitOk(userId, 'refund', 5, 60))) {
    return err(c, 429, 'RATE_LIMIT', 'Too many refund requests')
  }
  const forbidden = requireSuperAdmin(c)
  if (forbidden) return forbidden

  const body = c.req.valid('json')
  const tx = await findTransactionById(body.transactionId)
  if (!tx) return err(c, 404, 'TRANSACTION_NOT_FOUND', 'Transaction not found')
  if (tx.status === 'refunded') return err(c, 422, 'ALREADY_REFUNDED', 'Transaction already refunded')
  if (!tx.stripeChargeId) return err(c, 422, 'NO_CHARGE_ID', 'Transaction has no Stripe charge id')

  const remaining = tx.amountCents - tx.refundedAmountCents
  if (body.amountCents !== undefined && body.amountCents > remaining) {
    return err(
      c,
      422,
      'REFUND_EXCEEDS_AMOUNT',
      `Cannot refund ${body.amountCents} cents — only ${remaining} cents remaining`,
    )
  }

  const refund = await createRefund({
    stripeChargeId: tx.stripeChargeId,
    ...(body.amountCents !== undefined ? { amountCents: body.amountCents } : {}),
    reason: body.reason,
  })

  const amountRefunded = body.amountCents ?? remaining
  const newRefundedAmount = tx.refundedAmountCents + amountRefunded
  const newStatus = newRefundedAmount >= tx.amountCents ? 'refunded' : 'succeeded'
  await updateTransactionRefund(tx.id, {
    refundedAmountCents: newRefundedAmount,
    refundedAt: new Date(),
    status: newStatus,
  })

  return c.json(
    {
      success: true,
      data: {
        refundId: refund.id,
        amountRefunded: refund.amount,
        status: refund.status,
        transactionStatus: newStatus,
      },
    },
    200,
  )
})

const revenueQuerySchema = z.object({
  period: z.enum(['month', 'quarter', 'year']).default('month'),
})

routes.get('/admin/revenue', zValidator('query', revenueQuerySchema), async (c) => {
  const userId = c.get('userId' as never) as string
  if (!(await rateLimitOk(userId, 'revenue', 30, 60))) {
    return err(c, 429, 'RATE_LIMIT', 'Too many revenue requests')
  }

  const { period } = c.req.valid('query')
  const cacheKey = `billing:admin:revenue:${period}`
  const redis = getRedis()
  const cached = await redis.get(cacheKey)
  if (cached) {
    return c.json({ success: true, data: JSON.parse(cached) }, 200)
  }

  const periodStart = getPeriodStart(period)
  const now = new Date()
  const db = getDb()

  const mrrRes = (await db.execute(sql`
    SELECT COALESCE(SUM(
      CASE
        WHEN sub.billing_cycle = 'monthly' THEN p.price_monthly_cents
        WHEN sub.billing_cycle = 'yearly' THEN p.price_yearly_cents / 12
        ELSE 0
      END
    ), 0)::int AS mrr_cents
    FROM billing.subscriptions sub
    JOIN billing.plans p ON sub.plan_id = p.id
    WHERE sub.status = 'active'
      AND sub.stripe_subscription_id IS NOT NULL
  `)) as unknown as { rows?: Array<{ mrr_cents: number }> }

  const revenueRes = (await db.execute(sql`
    SELECT
      COALESCE(SUM(amount_cents), 0)::int AS revenue_cents,
      COUNT(*)::int AS tx_count
    FROM billing.transactions
    WHERE status = 'succeeded'
      AND created_at >= ${periodStart.toISOString()}
  `)) as unknown as { rows?: Array<{ revenue_cents: number; tx_count: number }> }

  const byPlanRes = (await db.execute(sql`
    SELECT p.name AS plan, COUNT(sub.id)::int AS count
    FROM billing.subscriptions sub
    JOIN billing.plans p ON sub.plan_id = p.id
    WHERE sub.status = 'active'
    GROUP BY p.name
  `)) as unknown as { rows?: Array<{ plan: string; count: number }> }

  const churnedRes = (await db.execute(sql`
    SELECT COUNT(*)::int AS count
    FROM billing.subscriptions
    WHERE status = 'cancelled'
      AND updated_at >= ${periodStart.toISOString()}
  `)) as unknown as { rows?: Array<{ count: number }> }

  const newSubsRes = (await db.execute(sql`
    SELECT COUNT(*)::int AS count
    FROM billing.subscriptions
    WHERE stripe_subscription_id IS NOT NULL
      AND created_at >= ${periodStart.toISOString()}
  `)) as unknown as { rows?: Array<{ count: number }> }

  const mrrCents = Number(mrrRes.rows?.[0]?.mrr_cents ?? 0)
  const revenueInPeriodCents = Number(revenueRes.rows?.[0]?.revenue_cents ?? 0)
  const transactionCount = Number(revenueRes.rows?.[0]?.tx_count ?? 0)
  const subscribersByPlan = (byPlanRes.rows ?? []).map((r) => ({
    plan: r.plan,
    count: Number(r.count),
  }))
  const churnedSubscribers = Number(churnedRes.rows?.[0]?.count ?? 0)
  const newSubscribers = Number(newSubsRes.rows?.[0]?.count ?? 0)
  const totalActiveSubscribers = subscribersByPlan.reduce((acc, p) => acc + p.count, 0)
  const arpuCents = totalActiveSubscribers > 0 ? Math.round(mrrCents / totalActiveSubscribers) : 0

  const data = {
    period,
    periodStart: periodStart.toISOString(),
    periodEnd: now.toISOString(),
    mrrCents,
    mrrFormatted: formatCents(mrrCents),
    revenueInPeriodCents,
    revenueInPeriodFormatted: formatCents(revenueInPeriodCents),
    transactionCount,
    subscribersByPlan,
    newSubscribers,
    churnedSubscribers,
    arpuCents,
    totalActiveSubscribers,
  }

  await redis.setex(cacheKey, 300, JSON.stringify(data))
  return c.json({ success: true, data }, 200)
})

const createCouponSchema = z.object({
  code: z.string().min(3).max(50).transform((v) => v.toUpperCase()),
  discountType: z.enum(['percent', 'amount']),
  discountValue: z.number().positive(),
  maxUses: z.number().int().positive().optional(),
  validForPlans: z.array(z.enum(['pro', 'team'])).default([]),
  expiresAt: z.string().datetime().optional(),
  createInStripe: z.boolean().default(true),
})

routes.post('/admin/coupons', zValidator('json', createCouponSchema), async (c) => {
  const userId = c.get('userId' as never) as string
  if (!(await rateLimitOk(userId, 'coupons-create', 10, 60))) {
    return err(c, 429, 'RATE_LIMIT', 'Too many coupon create requests')
  }
  const forbidden = requireSuperAdmin(c)
  if (forbidden) return forbidden

  const body = c.req.valid('json')
  const existing = await findCouponByCode(body.code)
  if (existing) return err(c, 409, 'COUPON_CODE_EXISTS', 'Coupon code already exists')

  let stripeCouponId: string | null = null
  if (body.createInStripe) {
    const stripeCoupon = await stripe.coupons.create({
      ...(body.discountType === 'percent'
        ? { percent_off: body.discountValue }
        : { amount_off: Math.round(body.discountValue * 100), currency: 'usd' }),
      duration: 'once',
      name: body.code,
      ...(body.maxUses !== undefined ? { max_redemptions: body.maxUses } : {}),
      ...(body.expiresAt !== undefined
        ? { redeem_by: Math.floor(new Date(body.expiresAt).getTime() / 1000) }
        : {}),
    })
    stripeCouponId = stripeCoupon.id
  }

  const coupon = await createCoupon({
    code: body.code,
    discountType: body.discountType,
    discountValue: body.discountValue.toString(),
    maxUses: body.maxUses ?? null,
    validForPlans: body.validForPlans,
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    stripeCouponId,
  })

  return c.json({ success: true, data: coupon }, 201)
})

routes.get('/admin/coupons', async (c) => {
  const coupons = await listCoupons()
  return c.json({ success: true, data: { coupons } }, 200)
})

export default routes
