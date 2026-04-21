import api from '@/lib/axios'
import type {
  AIAgentBreakdown,
  AIModelBreakdown,
  AITokenDataPoint,
  AITopUser,
  AIUsageOverview,
  TokenLimitConfig,
} from '@/types'
import { unwrap } from '@/lib/api/envelope'

export async function getAIUsageOverview(
  from: string,
  to: string,
): Promise<AIUsageOverview> {
  const body: unknown = await api.get('/admin/ai-usage/overview', {
    params: { from, to },
  })
  return unwrap<AIUsageOverview>(body)
}

export async function getTokenTimeSeries(
  from: string,
  to: string,
): Promise<AITokenDataPoint[]> {
  const body: unknown = await api.get('/admin/ai-usage/tokens', {
    params: { from, to },
  })
  return unwrap<AITokenDataPoint[]>(body)
}

export async function getModelBreakdown(
  from: string,
  to: string,
): Promise<AIModelBreakdown[]> {
  const body: unknown = await api.get('/admin/ai-usage/models', {
    params: { from, to },
  })
  return unwrap<AIModelBreakdown[]>(body)
}

export async function getTopUsers(
  from: string,
  to: string,
  limit = 20,
): Promise<AITopUser[]> {
  const body: unknown = await api.get('/admin/ai-usage/top-users', {
    params: { from, to, limit },
  })
  return unwrap<AITopUser[]>(body)
}

export async function getAgentBreakdown(
  from: string,
  to: string,
): Promise<AIAgentBreakdown[]> {
  const body: unknown = await api.get('/admin/ai-usage/agents', {
    params: { from, to },
  })
  return unwrap<AIAgentBreakdown[]>(body)
}

export async function getTokenLimits(): Promise<TokenLimitConfig[]> {
  const body: unknown = await api.get('/admin/ai-usage/limits')
  return unwrap<TokenLimitConfig[]>(body)
}

export async function updateTokenLimit(
  plan: string,
  tokenLimit: number,
  isUnlimited: boolean,
): Promise<TokenLimitConfig> {
  const body: unknown = await api.patch(`/admin/ai-usage/limits/${plan}`, {
    tokenLimit,
    isUnlimited,
  })
  return unwrap<TokenLimitConfig>(body)
}

export async function throttleUser(
  userId: string,
  requestsPerMinute: number,
): Promise<void> {
  const body: unknown = await api.post('/admin/ai-usage/throttle', {
    userId,
    requestsPerMinute,
  })
  unwrap<Record<string, never>>(body)
}
