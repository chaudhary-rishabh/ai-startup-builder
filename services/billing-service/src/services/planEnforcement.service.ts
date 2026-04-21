import { logger } from '../lib/logger.js'
import { getTokenBudget, type CreditState } from './tokenUsage.service.js'

export interface TokenBudgetCheckResult {
  allowed: boolean
  remaining: number
  limit: number
  bonusTokens: number
  effectiveLimit: number
  effectiveRemaining: number
  percentUsed: number
  creditState: CreditState
  isOneTimeCredits: boolean
  resetAt: string | null
  planTier: string
  tokensUsed: number
}

export async function checkTokenBudget(
  userId: string,
  estimatedTokens: number,
): Promise<TokenBudgetCheckResult> {
  try {
    const budget = await getTokenBudget(userId)
    if (budget.isUnlimited) {
      return {
        allowed: true,
        remaining: -1,
        limit: -1,
        bonusTokens: budget.bonusTokens,
        effectiveLimit: -1,
        effectiveRemaining: -1,
        percentUsed: 0,
        creditState: 'active',
        isOneTimeCredits: false,
        resetAt: budget.resetAt,
        planTier: budget.planTier,
        tokensUsed: budget.tokensUsed,
      }
    }
    const allowed = budget.effectiveRemaining >= estimatedTokens
    return {
      allowed,
      remaining: budget.effectiveRemaining,
      limit: budget.tokensLimit,
      bonusTokens: budget.bonusTokens,
      effectiveLimit: budget.effectiveLimit,
      effectiveRemaining: budget.effectiveRemaining,
      percentUsed: budget.percentUsed,
      creditState: budget.creditState,
      isOneTimeCredits: budget.isOneTimeCredits,
      resetAt: budget.resetAt,
      planTier: budget.planTier,
      tokensUsed: budget.tokensUsed,
    }
  } catch (error) {
    logger.warn('Token budget check failed — failing open', { userId, error })
    return {
      allowed: true,
      remaining: 999999,
      limit: 999999,
      bonusTokens: 0,
      effectiveLimit: 999999,
      effectiveRemaining: 999999,
      percentUsed: 0,
      creditState: 'active',
      isOneTimeCredits: false,
      resetAt: null,
      planTier: 'free',
      tokensUsed: 0,
    }
  }
}
