import { env } from '../config/env.js'
import { publishTokenBudgetWarning } from '../events/publisher.js'

export async function checkTokenBudget(
  userId: string,
  estimatedTokens: number,
): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  try {
    const url = `${env.BILLING_SERVICE_URL.replace(/\/$/, '')}/internal/token-budget?userId=${encodeURIComponent(userId)}`
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
      data?: { tokensUsed?: number; tokensLimit?: number }
      tokensUsed?: number
      tokensLimit?: number
    }
    const used = json.data?.tokensUsed ?? json.tokensUsed ?? 0
    const limit = json.data?.tokensLimit ?? json.tokensLimit ?? 50_000
    const remaining = Math.max(0, limit - used)
    return { allowed: remaining >= estimatedTokens, remaining, limit }
  } catch (e) {
    console.warn('[ai-service] checkTokenBudget: billing-service unavailable, fail-open', e)
    return { allowed: true, remaining: 999_999, limit: 999_999 }
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
  const { remaining, limit } = await checkTokenBudget(userId, 0)
  if (limit <= 0 || limit > 900_000) return
  const used = limit - remaining
  const pct = (used / limit) * 100
  if (pct >= env.TOKEN_WARNING_THRESHOLD_2) {
    await publishTokenBudgetWarning(userId, 95, used, limit)
  } else if (pct >= env.TOKEN_WARNING_THRESHOLD_1) {
    await publishTokenBudgetWarning(userId, 80, used, limit)
  }
}
