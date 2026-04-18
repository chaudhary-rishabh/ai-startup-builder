import { findSubscriptionByUserId } from '../db/queries/subscriptions.queries.js'
import {
  atomicIncrementUsage,
  currentMonthDateString,
  getCurrentMonthUsage,
  getOrCreateMonthlyUsage,
  updateTokenLimit as updateTokenLimitInDb,
} from '../db/queries/tokenUsage.queries.js'
import { env } from '../config/env.js'
import { publishTokenBudgetWarning } from '../events/publisher.js'
import { logger } from '../lib/logger.js'
import { getRedis } from '../lib/redis.js'

import type { TokenUsage } from '../db/schema.js'

function nextMonthResetIso(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0))
  return d.toISOString()
}

function secondsUntilEndOfMonth(now = new Date()): number {
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0))
  return Math.max(1, Math.floor((nextMonth.getTime() - now.getTime()) / 1000))
}

export async function checkAndEmitBudgetWarnings(userId: string, usage: TokenUsage): Promise<void> {
  if (usage.tokensLimit === BigInt(-1)) return

  const limit = Number(usage.tokensLimit)
  const used = Number(usage.tokensUsed)
  if (limit <= 0) return
  const pct = (used / limit) * 100
  const month = currentMonthDateString()
  const redis = getRedis()

  for (const threshold of [env.TOKEN_WARNING_THRESHOLD_1, env.TOKEN_WARNING_THRESHOLD_2]) {
    const warningKey = `billing:warn:${threshold}:${userId}:${month}`
    const alreadySent = await redis.exists(warningKey)
    if (!alreadySent && pct >= threshold) {
      await publishTokenBudgetWarning({
        userId,
        percentUsed: threshold as 80 | 95,
        tokensUsed: used,
        tokenLimit: limit,
      })
      await redis.setex(warningKey, secondsUntilEndOfMonth(), '1')
    }
  }
}

export async function incrementUsage(
  userId: string,
  data: { tokensUsed: number; costUsd: string },
): Promise<TokenUsage> {
  const month = currentMonthDateString()
  await getOrCreateMonthlyUsage(userId, month)
  const updated = await atomicIncrementUsage(userId, month, {
    tokensToAdd: BigInt(data.tokensUsed),
    costToAdd: parseFloat(data.costUsd),
  })
  void checkAndEmitBudgetWarnings(userId, updated).catch((error) =>
    logger.error('Budget warning emission failed', { userId, error }),
  )
  const redis = getRedis()
  await redis.del(`billing:budget:${userId}`)
  await redis.del(`billing:usage:${userId}`)
  return updated
}

export interface TokenBudgetView {
  tokensUsed: number
  tokensLimit: number
  tokensRemaining: number
  percentUsed: number
  planTier: string
  currentMonth: string
  resetAt: string
  warningThresholds: Array<{ percent: number; triggered: boolean }>
  isUnlimited: boolean
}

export async function getTokenBudget(userId: string): Promise<TokenBudgetView> {
  const redis = getRedis()
  const cacheKey = `billing:budget:${userId}`
  const cached = await redis.get(cacheKey)
  if (cached) {
    try {
      return JSON.parse(cached) as TokenBudgetView
    } catch {
      // continue
    }
  }

  const month = currentMonthDateString()
  const usage = (await getCurrentMonthUsage(userId)) ?? (await getOrCreateMonthlyUsage(userId, month))
  const sub = await findSubscriptionByUserId(userId)
  const planTier = sub?.plan?.name ?? 'free'
  const planLimit = sub?.plan?.tokenLimitMonthly ?? Number(usage.tokensLimit)

  let view: TokenBudgetView
  if (planLimit === -1) {
    view = {
      tokensUsed: Number(usage.tokensUsed),
      tokensLimit: -1,
      tokensRemaining: -1,
      percentUsed: 0,
      planTier,
      currentMonth: month.slice(0, 7),
      resetAt: nextMonthResetIso(),
      warningThresholds: [
        { percent: env.TOKEN_WARNING_THRESHOLD_1, triggered: false },
        { percent: env.TOKEN_WARNING_THRESHOLD_2, triggered: false },
      ],
      isUnlimited: true,
    }
  } else {
    const used = Number(usage.tokensUsed)
    const limit = Number(usage.tokensLimit)
    const percentUsed = limit > 0 ? Math.min(100, Math.round((used / limit) * 10000) / 100) : 0
    const remaining = Math.max(0, limit - used)
    view = {
      tokensUsed: used,
      tokensLimit: limit,
      tokensRemaining: remaining,
      percentUsed,
      planTier,
      currentMonth: month.slice(0, 7),
      resetAt: nextMonthResetIso(),
      warningThresholds: [
        { percent: env.TOKEN_WARNING_THRESHOLD_1, triggered: percentUsed >= env.TOKEN_WARNING_THRESHOLD_1 },
        { percent: env.TOKEN_WARNING_THRESHOLD_2, triggered: percentUsed >= env.TOKEN_WARNING_THRESHOLD_2 },
      ],
      isUnlimited: false,
    }
  }

  await redis.setex(cacheKey, env.TOKEN_BUDGET_CACHE_TTL, JSON.stringify(view))
  return view
}

export async function updateTokenLimit(userId: string, tokensLimit: bigint): Promise<void> {
  await updateTokenLimitInDb(userId, tokensLimit)
  const redis = getRedis()
  await redis.del(`billing:budget:${userId}`)
  await redis.del(`billing:subscription:${userId}`)
}
