import { findPlanById, findPlanByName } from '../db/queries/plans.queries.js'
import {
  findSubscriptionByUserId,
  updateSubscriptionStatus,
  upsertSubscription,
} from '../db/queries/subscriptions.queries.js'
import { currentMonthDateString, getCurrentMonthUsage, getOrCreateMonthlyUsage, updateTokenLimit } from '../db/queries/tokenUsage.queries.js'
import { env } from '../config/env.js'
import { publishSubscriptionUpgraded } from '../events/publisher.js'
import { AppError } from '../lib/errors.js'
import { getRedis } from '../lib/redis.js'
import { getPriceId } from '../lib/stripe.js'
import { validateCoupon } from './coupon.service.js'
import {
  cancelSubscriptionAtPeriodEnd,
  createCheckoutSession,
  createOrRetrieveCustomer,
  reactivateSubscription,
} from './stripe.service.js'

export interface UserSubscriptionView {
  id: string | null
  plan: 'free' | 'pro' | 'team' | 'enterprise'
  planDisplayName: string
  status: string
  billingCycle: string | null
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
  cancelledAt: Date | null
  accessUntil: Date | null
  trialEnd: Date | null
  stripeCustomerId: string | null
  features: string[]
  limits: { tokensMonthly: number; projects: number; apiKeys: number }
  tokenUsage: { used: number; limit: number; resetAt: string; percentUsed: number }
  createdAt: Date
}

function nextMonthResetIso(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0)).toISOString()
}

function freeDefaults(): UserSubscriptionView {
  return {
    id: null,
    plan: 'free',
    planDisplayName: 'Free',
    status: 'active',
    billingCycle: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    cancelledAt: null,
    accessUntil: null,
    trialEnd: null,
    stripeCustomerId: null,
    features: ['Phase 1 & 2 only', '3 projects', '50K tokens/month', '2 API keys'],
    limits: { tokensMonthly: 50000, projects: 3, apiKeys: 2 },
    tokenUsage: {
      used: 0,
      limit: 50000,
      resetAt: nextMonthResetIso(),
      percentUsed: 0,
    },
    createdAt: new Date(),
  }
}

function invalidateSubscriptionCache(userId: string): Promise<number> {
  return getRedis().del(`billing:subscription:${userId}`, `billing:budget:${userId}`, `billing:usage:${userId}`)
}

export async function createFreeSubscription(data: {
  userId: string
  email: string
  name: string
}): Promise<void> {
  const freePlan = await findPlanByName('free')
  if (!freePlan) throw new AppError('PLAN_NOT_FOUND', 'Free plan is missing', 500)
  const stripeCustomerId = await createOrRetrieveCustomer(data)
  await upsertSubscription({
    userId: data.userId,
    planId: freePlan.id,
    stripeCustomerId,
    stripeSubscriptionId: null,
    status: 'active',
    billingCycle: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
  })
  await getOrCreateMonthlyUsage(data.userId, currentMonthDateString())
}

export async function getUserSubscription(userId: string): Promise<UserSubscriptionView> {
  const redis = getRedis()
  const cacheKey = `billing:subscription:${userId}`
  const cached = await redis.get(cacheKey)
  if (cached) {
    try {
      return JSON.parse(cached) as UserSubscriptionView
    } catch {
      // continue
    }
  }

  const sub = await findSubscriptionByUserId(userId)
  if (!sub) {
    const defaults = freeDefaults()
    await redis.setex(cacheKey, env.SUBSCRIPTION_CACHE_TTL, JSON.stringify(defaults))
    return defaults
  }

  const usage =
    (await getCurrentMonthUsage(userId)) ?? (await getOrCreateMonthlyUsage(userId, currentMonthDateString()))
  const used = Number(usage.tokensUsed)
  const limit = Number(usage.tokensLimit)
  const percentUsed = limit > 0 && limit !== -1 ? Math.min(100, (used / limit) * 100) : 0

  const view: UserSubscriptionView = {
    id: sub.id,
    plan: sub.plan.name as UserSubscriptionView['plan'],
    planDisplayName: sub.plan.displayName,
    status: sub.status,
    billingCycle: sub.billingCycle ?? null,
    currentPeriodStart: sub.currentPeriodStart ?? null,
    currentPeriodEnd: sub.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    cancelledAt: sub.cancelledAt ?? null,
    accessUntil: sub.cancelAtPeriodEnd ? sub.currentPeriodEnd ?? null : null,
    trialEnd: sub.trialEnd ?? null,
    stripeCustomerId: sub.stripeCustomerId ?? null,
    features: sub.plan.features,
    limits: {
      tokensMonthly: sub.plan.tokenLimitMonthly,
      projects: sub.plan.projectLimit,
      apiKeys: sub.plan.apiKeyLimit,
    },
    tokenUsage: {
      used,
      limit,
      resetAt: nextMonthResetIso(),
      percentUsed: Math.round(percentUsed * 100) / 100,
    },
    createdAt: sub.createdAt,
  }
  await redis.setex(cacheKey, env.SUBSCRIPTION_CACHE_TTL, JSON.stringify(view))
  return view
}

export async function initiateCheckout(data: {
  userId: string
  email: string
  name: string
  planName: string
  billingCycle: 'monthly' | 'yearly'
  couponCode?: string
  successUrl: string
  cancelUrl: string
}): Promise<{ checkoutUrl: string; sessionId: string }> {
  const planName = data.planName.toLowerCase()
  const plan = await findPlanByName(planName)
  if (!plan) throw new AppError('PLAN_NOT_FOUND', 'Requested plan does not exist', 422)
  if (planName === 'free') throw new AppError('ALREADY_SUBSCRIBED', 'Free plan does not require checkout', 422)
  if (planName === 'enterprise') {
    throw new AppError('ENTERPRISE_CONTACT_REQUIRED', 'Enterprise requires sales contact', 422)
  }

  const current = await getUserSubscription(data.userId)
  if (current.plan === planName) {
    throw new AppError('ALREADY_SUBSCRIBED', 'You are already on this plan.', 422)
  }

  if (data.couponCode) {
    const couponResult = await validateCoupon(data.couponCode, planName)
    if (!couponResult.valid) {
      throw new AppError(couponResult.error ?? 'COUPON_INVALID', 'Coupon is invalid for this checkout.', 422)
    }
  }

  const priceId = getPriceId(planName, data.billingCycle)
  const stripeCustomerId = await createOrRetrieveCustomer({
    userId: data.userId,
    email: data.email,
    name: data.name,
  })

  const result = await createCheckoutSession({
    stripeCustomerId,
    priceId,
    userId: data.userId,
    ...(data.couponCode !== undefined ? { couponCode: data.couponCode } : {}),
    successUrl: data.successUrl,
    cancelUrl: data.cancelUrl,
  })
  return { checkoutUrl: result.url, sessionId: result.sessionId }
}

export async function cancelSubscription(userId: string): Promise<UserSubscriptionView> {
  const sub = await findSubscriptionByUserId(userId)
  if (!sub || !sub.stripeSubscriptionId || sub.plan.name === 'free') {
    throw new AppError('NO_ACTIVE_PAID_SUBSCRIPTION', 'No active paid subscription found.', 422)
  }
  if (sub.cancelAtPeriodEnd) {
    throw new AppError('ALREADY_CANCELLING', 'Subscription already set to cancel at period end.', 422)
  }
  await cancelSubscriptionAtPeriodEnd(sub.stripeSubscriptionId)
  await updateSubscriptionStatus(userId, {
    cancelAtPeriodEnd: true,
    cancelledAt: new Date(),
  })
  await invalidateSubscriptionCache(userId)
  return getUserSubscription(userId)
}

export async function reactivateUserSubscription(userId: string): Promise<UserSubscriptionView> {
  const sub = await findSubscriptionByUserId(userId)
  if (!sub || !sub.stripeSubscriptionId || !sub.cancelAtPeriodEnd) {
    throw new AppError(
      'NOT_SCHEDULED_FOR_CANCELLATION',
      'Subscription is not scheduled for cancellation.',
      422,
    )
  }
  await reactivateSubscription(sub.stripeSubscriptionId)
  await updateSubscriptionStatus(userId, {
    cancelAtPeriodEnd: false,
    cancelledAt: null,
  })
  await invalidateSubscriptionCache(userId)
  return getUserSubscription(userId)
}

export async function handleUpgradeOrDowngrade(
  userId: string,
  data: {
    newPlanId: string
    newPlanName: string
    stripeSubscriptionId: string | null
    billingCycle: string | null
    currentPeriodStart: Date | null
    currentPeriodEnd: Date | null
    trialEnd: Date | null
  },
): Promise<void> {
  const oldSub = await findSubscriptionByUserId(userId)
  await updateSubscriptionStatus(userId, {
    planId: data.newPlanId,
    stripeSubscriptionId: data.stripeSubscriptionId,
    status: 'active',
    billingCycle: data.billingCycle,
    currentPeriodStart: data.currentPeriodStart,
    currentPeriodEnd: data.currentPeriodEnd,
    cancelAtPeriodEnd: false,
    trialEnd: data.trialEnd,
  })
  const newPlan = await findPlanById(data.newPlanId)
  if (!newPlan) throw new AppError('PLAN_NOT_FOUND', 'New plan not found after update', 500)
  await updateTokenLimit(userId, BigInt(newPlan.tokenLimitMonthly))
  await invalidateSubscriptionCache(userId)
  await publishSubscriptionUpgraded({
    userId,
    oldPlan: oldSub?.plan.name ?? 'free',
    newPlan: data.newPlanName,
    tokenLimit: newPlan.tokenLimitMonthly,
  })
}
