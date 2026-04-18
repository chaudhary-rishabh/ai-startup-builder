import Stripe from 'stripe'

import { env } from '../config/env.js'
import {
  findCouponByStripeId,
  incrementCouponUsage,
} from '../db/queries/coupons.queries.js'
import { findPlanByName } from '../db/queries/plans.queries.js'
import {
  findSubscriptionByUserId,
  updateSubscriptionStatus,
} from '../db/queries/subscriptions.queries.js'
import {
  createTransaction,
  findTransactionByStripeInvoiceId,
} from '../db/queries/transactions.queries.js'
import {
  publishInvoicePaid,
  publishSubscriptionActivated,
  publishSubscriptionCancelled,
  publishSubscriptionPaymentFailed,
  publishSubscriptionUpgraded,
  publishTrialWillEnd,
} from '../events/publisher.js'
import { stripe } from '../lib/stripe.js'
import { logger } from '../lib/logger.js'
import { getRedis } from '../lib/redis.js'
import { handleUpgradeOrDowngrade } from './subscription.service.js'
import { updateTokenLimit } from './tokenUsage.service.js'

type BillingCycle = 'monthly' | 'yearly'

function resolvePlanFromPriceId(priceId: string): { planName: string; billingCycle: BillingCycle } {
  switch (priceId) {
    case env.STRIPE_PRO_MONTHLY_PRICE_ID:
      return { planName: 'pro', billingCycle: 'monthly' }
    case env.STRIPE_PRO_YEARLY_PRICE_ID:
      return { planName: 'pro', billingCycle: 'yearly' }
    case env.STRIPE_TEAM_MONTHLY_PRICE_ID:
      return { planName: 'team', billingCycle: 'monthly' }
    case env.STRIPE_TEAM_YEARLY_PRICE_ID:
      return { planName: 'team', billingCycle: 'yearly' }
    default:
      logger.warn('Unknown Stripe price ID', { priceId })
      return { planName: 'pro', billingCycle: 'monthly' }
  }
}

function mapStripeStatus(status: Stripe.Subscription.Status): string {
  switch (status) {
    case 'active':
      return 'active'
    case 'past_due':
      return 'past_due'
    case 'canceled':
      return 'cancelled'
    case 'trialing':
      return 'trialing'
    case 'paused':
      return 'paused'
    case 'incomplete':
      return 'past_due'
    case 'incomplete_expired':
      return 'cancelled'
    default:
      return 'active'
  }
}

function formatBillingPeriod(invoice: Stripe.Invoice): string {
  const startTs = invoice.lines.data[0]?.period?.start ?? invoice.created
  const start = new Date(startTs * 1000)
  return start.toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

function invoicePeriodStart(invoice: Stripe.Invoice): Date {
  const ts = invoice.lines.data[0]?.period?.start ?? invoice.created
  return new Date(ts * 1000)
}

function invoicePeriodEnd(invoice: Stripe.Invoice): Date {
  const ts = invoice.lines.data[0]?.period?.end ?? invoice.created
  return new Date(ts * 1000)
}

export async function processWebhookEvent(event: Stripe.Event): Promise<void> {
  const redis = getRedis()
  const idempotencyKey = `billing:webhook:processed:${event.id}`
  const alreadyProcessed = await redis.exists(idempotencyKey)
  if (alreadyProcessed) {
    logger.info('Webhook already processed, skipping', { eventId: event.id })
    return
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice)
        break
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
        break
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break
      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event.data.object as Stripe.Subscription)
        break
      default:
        logger.debug('Unhandled webhook event type, ignoring', { type: event.type })
    }
  } catch (error) {
    logger.error('Webhook handler error', {
      eventType: event.type,
      eventId: event.id,
      error,
    })
    return
  }

  await redis.setex(idempotencyKey, env.WEBHOOK_IDEMPOTENCY_TTL, '1')
}

export async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.['userId']
  if (!userId) {
    logger.error('checkout.session.completed missing userId in metadata', { sessionId: session.id })
    return
  }
  if (session.mode !== 'subscription') return
  if (!session.subscription || typeof session.subscription !== 'string') return

  const stripeSubId = session.subscription
  const stripeSub = await stripe.subscriptions.retrieve(stripeSubId, {
    expand: ['items.data.price.product'],
  })

  const priceId = stripeSub.items.data[0]?.price.id
  const { planName, billingCycle } = resolvePlanFromPriceId(priceId ?? '')
  const plan = await findPlanByName(planName)
  if (!plan) {
    logger.error('Could not find plan for price ID', { priceId, planName })
    return
  }

  const couponCandidate =
    (session as unknown as { discounts?: Array<{ coupon?: string | { id: string } }> }).discounts?.[0]
      ?.coupon ??
    (session as unknown as {
      total_details?: { breakdown?: { discounts?: Array<{ discount?: { coupon?: string | { id: string } } }> } }
    }).total_details?.breakdown?.discounts?.[0]?.discount?.coupon
  const stripeCouponId =
    typeof couponCandidate === 'string' ? couponCandidate : couponCandidate?.id
  if (stripeCouponId) {
    const localCoupon = await findCouponByStripeId(stripeCouponId)
    if (localCoupon) {
      await incrementCouponUsage(localCoupon.id).catch((error) =>
        logger.warn('Coupon increment failed', { error, couponId: localCoupon.id }),
      )
    }
  }

  await handleUpgradeOrDowngrade(userId, {
    newPlanId: plan.id,
    newPlanName: plan.name,
    stripeSubscriptionId: stripeSubId,
    billingCycle,
    currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
    currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
    trialEnd: stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000) : null,
  })

  await publishSubscriptionActivated({
    userId,
    plan: plan.name,
    billingCycle,
    currentPeriodEnd: new Date(stripeSub.current_period_end * 1000).toISOString(),
  })

  logger.info('Checkout completed — subscription activated', {
    userId,
    planName,
    billingCycle,
  })
}

export async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  if (!invoice.subscription || typeof invoice.subscription !== 'string') return

  const stripeSub = await stripe.subscriptions.retrieve(invoice.subscription)
  const userId = stripeSub.metadata?.['userId']
  if (!userId) return

  const existing = await findTransactionByStripeInvoiceId(invoice.id)
  if (existing) return

  const priceId = invoice.lines.data[0]?.price?.id ?? ''
  const { planName } = resolvePlanFromPriceId(priceId)
  const sub = await findSubscriptionByUserId(userId)

  await createTransaction({
    userId,
    subscriptionId: sub?.id ?? null,
    stripeInvoiceId: invoice.id,
    stripeChargeId: typeof invoice.charge === 'string' ? invoice.charge : null,
    stripeEventId: invoice.id,
    amountCents: invoice.amount_paid,
    currency: invoice.currency,
    status: 'succeeded',
    description: `${planName} Plan — ${formatBillingPeriod(invoice)}`,
    invoicePdfUrl: invoice.invoice_pdf ?? null,
  })

  await updateSubscriptionStatus(userId, {
    status: 'active',
    currentPeriodStart: invoicePeriodStart(invoice),
    currentPeriodEnd: invoicePeriodEnd(invoice),
  })

  await publishInvoicePaid({
    userId,
    amountCents: invoice.amount_paid,
    currency: invoice.currency,
    invoiceId: invoice.id,
    receiptUrl: invoice.hosted_invoice_url ?? null,
    planName,
  })
}

export async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  if (!invoice.subscription || typeof invoice.subscription !== 'string') return

  const stripeSub = await stripe.subscriptions.retrieve(invoice.subscription)
  const userId = stripeSub.metadata?.['userId']
  if (!userId) return

  await createTransaction({
    userId,
    subscriptionId: (await findSubscriptionByUserId(userId))?.id ?? null,
    stripeInvoiceId: invoice.id,
    stripeChargeId: typeof invoice.charge === 'string' ? invoice.charge : null,
    stripeEventId: invoice.id,
    amountCents: invoice.amount_due,
    currency: invoice.currency,
    status: 'failed',
    description: 'Payment failed — renewal',
  })

  await updateSubscriptionStatus(userId, { status: 'past_due' })

  const redis = getRedis()
  await redis.del(`billing:subscription:${userId}`)

  await publishSubscriptionPaymentFailed({
    userId,
    amountCents: invoice.amount_due,
    currency: invoice.currency,
    invoiceUrl: invoice.hosted_invoice_url ?? null,
    nextAttemptAt: invoice.next_payment_attempt
      ? new Date(invoice.next_payment_attempt * 1000).toISOString()
      : null,
  })

  logger.warn('Invoice payment failed', { userId, invoiceId: invoice.id })
}

export async function handleSubscriptionUpdated(sub: Stripe.Subscription): Promise<void> {
  const userId = sub.metadata?.['userId']
  if (!userId) return

  const priceId = sub.items.data[0]?.price.id
  const { planName, billingCycle } = resolvePlanFromPriceId(priceId ?? '')
  const plan = await findPlanByName(planName)
  if (!plan) return

  const currentSub = await findSubscriptionByUserId(userId)
  if (!currentSub) return

  await updateSubscriptionStatus(userId, {
    planId: plan.id,
    stripeSubscriptionId: sub.id,
    status: mapStripeStatus(sub.status),
    billingCycle,
    currentPeriodStart: new Date(sub.current_period_start * 1000),
    currentPeriodEnd: new Date(sub.current_period_end * 1000),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
  })

  if (plan.name !== currentSub.plan.name) {
    await updateTokenLimit(userId, BigInt(plan.tokenLimitMonthly))
    await publishSubscriptionUpgraded({
      userId,
      oldPlan: currentSub.plan.name ?? 'free',
      newPlan: plan.name,
      tokenLimit: plan.tokenLimitMonthly,
    })
  }

  const redis = getRedis()
  await redis.del(`billing:subscription:${userId}`)
}

export async function handleSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
  const userId = sub.metadata?.['userId']
  if (!userId) return

  const freePlan = await findPlanByName('free')
  if (!freePlan) return

  const previous = await findSubscriptionByUserId(userId)

  await updateSubscriptionStatus(userId, {
    planId: freePlan.id,
    stripeSubscriptionId: null,
    status: 'cancelled',
    billingCycle: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
  })

  await updateTokenLimit(userId, BigInt(freePlan.tokenLimitMonthly))

  const redis = getRedis()
  await redis.del(`billing:subscription:${userId}`)

  await publishSubscriptionCancelled({
    userId,
    plan: previous?.plan?.name ?? 'pro',
    cancelledAt: new Date().toISOString(),
    accessUntil: new Date().toISOString(),
  })

  logger.info('Subscription cancelled, downgraded to free', { userId })
}

export async function handleTrialWillEnd(sub: Stripe.Subscription): Promise<void> {
  const userId = sub.metadata?.['userId']
  if (!userId || !sub.trial_end) return

  await publishTrialWillEnd({
    userId,
    trialEnd: new Date(sub.trial_end * 1000).toISOString(),
    plan: resolvePlanFromPriceId(sub.items.data[0]?.price.id ?? '').planName,
  })
}
