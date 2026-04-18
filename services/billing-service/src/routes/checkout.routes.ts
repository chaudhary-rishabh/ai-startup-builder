import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import { env } from '../config/env.js'
import { err, ok } from '../lib/response.js'
import { getRedis } from '../lib/redis.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { validateCoupon } from '../services/coupon.service.js'
import { initiateCheckout } from '../services/subscription.service.js'

const routes = new Hono()
routes.use('*', requireAuth)

const checkoutSchema = z.object({
  plan: z.enum(['pro', 'team']),
  billingCycle: z.enum(['monthly', 'yearly']),
  couponCode: z.string().trim().toUpperCase().optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
})

const portalSchema = z.object({
  returnUrl: z.string().url().optional(),
})

async function rateLimitOk(userId: string, bucket: string, max: number, windowSec: number): Promise<boolean> {
  const redis = getRedis()
  const k = `billing:rl:${bucket}:${userId}`
  const n = await redis.incr(k)
  if (n === 1) await redis.expire(k, windowSec)
  return n <= max
}

routes.post('/checkout', zValidator('json', checkoutSchema), async (c) => {
  const userId = c.get('userId' as never) as string
  if (!(await rateLimitOk(userId, 'checkout', 5, 60))) {
    return err(c, 429, 'RATE_LIMIT', 'Too many checkout attempts')
  }

  const body = c.req.valid('json')
  if (body.couponCode) {
    const couponResult = await validateCoupon(body.couponCode, body.plan)
    if (!couponResult.valid) {
      return err(c, 422, couponResult.error ?? 'COUPON_INVALID', 'Coupon validation failed')
    }
  }

  const successUrl = body.successUrl ?? `${env.APP_URL}/settings/billing?success=1`
  const cancelUrl = body.cancelUrl ?? `${env.APP_URL}/settings/billing?cancelled=1`
  const email = ((c.get('userEmail' as never) as string | undefined) || `${userId}@unknown.local`).toString()
  const name = ((c.get('userName' as never) as string | undefined) || 'User').toString()

  const result = await initiateCheckout({
    userId,
    email,
    name,
    planName: body.plan,
    billingCycle: body.billingCycle,
    ...(body.couponCode !== undefined ? { couponCode: body.couponCode } : {}),
    successUrl,
    cancelUrl,
  })
  return ok(c, {
    checkoutUrl: result.checkoutUrl,
    sessionId: result.sessionId,
  })
})

routes.post('/portal', zValidator('json', portalSchema), async (c) => {
  const userId = c.get('userId' as never) as string
  if (!(await rateLimitOk(userId, 'portal', 5, 60))) {
    return err(c, 429, 'RATE_LIMIT', 'Too many requests')
  }
  const body = c.req.valid('json')
  const returnUrl = body.returnUrl ?? `${env.APP_URL}/settings/billing`
  const { createPortalSession } = await import('../services/stripe.service.js')
  const { findSubscriptionByUserId } = await import('../db/queries/subscriptions.queries.js')
  const sub = await findSubscriptionByUserId(userId)
  if (!sub?.stripeCustomerId) {
    return err(c, 422, 'NO_STRIPE_CUSTOMER', 'No Stripe customer found for this user')
  }
  const portalUrl = await createPortalSession(sub.stripeCustomerId, returnUrl)
  return ok(c, { portalUrl })
})

export default routes
