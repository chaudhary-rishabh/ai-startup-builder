import { logger } from '../lib/logger.js'
import { getTokenBudget } from './tokenUsage.service.js'

export async function checkTokenBudget(
  userId: string,
  estimatedTokens: number,
): Promise<{
  allowed: boolean
  remaining: number
  limit: number
  percentUsed: number
}> {
  try {
    const budget = await getTokenBudget(userId)
    if (budget.isUnlimited) {
      return { allowed: true, remaining: -1, limit: -1, percentUsed: 0 }
    }
    return {
      allowed: budget.tokensRemaining >= estimatedTokens,
      remaining: budget.tokensRemaining,
      limit: budget.tokensLimit,
      percentUsed: budget.percentUsed,
    }
  } catch (error) {
    logger.warn('Token budget check failed — failing open', { userId, error })
    return { allowed: true, remaining: 999999, limit: 999999, percentUsed: 0 }
  }
}
