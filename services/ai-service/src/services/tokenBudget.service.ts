import { env } from '../config/env.js'
import { publishEvent, publishTokenBudgetWarning } from '../events/publisher.js'
import { getRedis } from '../lib/redis.js'

export interface BudgetCheckResult {
  allowed: boolean
  remaining: number
  limit: number
  creditState?: string
  effectiveRemaining?: number
  effectiveLimit?: number
  planTier?: string
  isOneTimeCredits?: boolean
}

export async function checkTokenBudget(
  userId: string,
  estimatedTokens: number,
  opts?: { userEmail?: string; userName?: string },
): Promise<BudgetCheckResult> {
  try {
    const url = `${env.BILLING_SERVICE_URL.replace(/\/$/, '')}/internal/token-budget?userId=${encodeURIComponent(userId)}&estimatedTokens=${encodeURIComponent(String(estimatedTokens))}`
    const res = await fetch(url, {
      headers: {
        'X-User-ID': userId,
        'X-Internal-Service': 'ai-service',
      },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) throw new Error(`billing ${res.status}`)
    const json = (await res.json()) as {
      success?: boolean
      data?: {
        allowed?: boolean
        remaining?: number
        limit?: number
        creditState?: string
        effectiveRemaining?: number
        effectiveLimit?: number
        isOneTimeCredits?: boolean
        planTier?: string
      }
    }
    const d = json.data
    if (!d) throw new Error('missing data')
    const allowed = Boolean(d.allowed)
    const creditState = d.creditState ?? 'active'

    if (creditState === 'exhausted' && allowed === false) {
      const redis = getRedis()
      const key = `credits_exhausted_notified:${userId}`
      const notified = await redis.exists(key)
      if (!notified) {
        await redis.setex(key, 30 * 24 * 60 * 60, '1')
        await publishEvent('credits.exhausted', {
          userId,
          planTier: d.planTier ?? 'free',
          ...(opts?.userEmail
            ? { userEmail: opts.userEmail, userName: opts.userName ?? 'Founder' }
            : {}),
        })
      }
    }

    return {
      allowed,
      remaining: d.remaining ?? 0,
      limit: d.limit ?? 50_000,
      creditState,
      effectiveRemaining: d.effectiveRemaining,
      effectiveLimit: d.effectiveLimit,
      planTier: d.planTier,
      isOneTimeCredits: d.isOneTimeCredits,
    }
  } catch (e) {
    console.warn('[ai-service] checkTokenBudget: billing-service unavailable, fail-open', e)
    return {
      allowed: true,
      remaining: 999_999,
      limit: 999_999,
      creditState: 'active',
    }
  }
}

export async function recordTokenUsage(
  userId: string,
  tokensUsed: number,
  costUsd: string,
): Promise<void> {
  try {
    await fetch(`${env.BILLING_SERVICE_URL.replace(/\/$/, '')}/internal/token-usage/increment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, tokensUsed, costUsd }),
    })
  } catch (e) {
    console.error('[ai-service] recordTokenUsage failed', e)
  }
}

export async function checkAndEmitBudgetWarnings(userId: string): Promise<void> {
  const b = await checkTokenBudget(userId, 0)
  const limit = b.effectiveLimit ?? b.limit
  if (limit <= 0 || limit > 900_000) return
  const remaining = b.effectiveRemaining ?? b.remaining
  const used = limit - remaining
  const pct = (used / limit) * 100
  if (pct >= env.TOKEN_WARNING_THRESHOLD_2) {
    await publishTokenBudgetWarning(userId, 95, used, limit)
  } else if (pct >= env.TOKEN_WARNING_THRESHOLD_1) {
    await publishTokenBudgetWarning(userId, 80, used, limit)
  }
}
