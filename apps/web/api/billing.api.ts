import api from '@/lib/axios'

export interface TokenBudget {
  tokensUsed: number
  tokensLimit: number
  tokensRemaining: number
  percentUsed: number
  planTier: string
  currentMonth: string
  resetAt: string
  isUnlimited: boolean
  warningThresholds: Array<{ percent: number; triggered: boolean }>
}

export async function getTokenBudget(): Promise<TokenBudget> {
  const res = await api.get<{ data: TokenBudget }>('/billing/token-usage')
  return res.data.data
}
