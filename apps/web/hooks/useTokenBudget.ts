'use client'

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'

import { getTokenBudget } from '@/api/billing.api'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'

export function useTokenBudget(): void {
  const setTokenWarning = useUIStore((state) => state.setTokenWarning)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  const { data } = useQuery({
    queryKey: ['token-budget'],
    queryFn: getTokenBudget,
    enabled: isAuthenticated,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!data) {
      return
    }
    if (data.isUnlimited) {
      setTokenWarning(null)
      return
    }
    const triggered = data.warningThresholds.find(
      (threshold) => threshold.triggered && (threshold.percent === 80 || threshold.percent === 95),
    )
    if (!triggered) {
      setTokenWarning(null)
      return
    }
    setTokenWarning({
      percentUsed: triggered.percent as 80 | 95,
      tokensRemaining: data.tokensRemaining,
      resetDate: new Date(data.resetAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
      }),
    })
  }, [data, setTokenWarning])
}
