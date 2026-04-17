'use client'

import { useQuery } from '@tanstack/react-query'

import { getNamespaceStats } from '@/api/rag.api'
import { useAuthStore } from '@/store/authStore'

export type RagDotStatus = 'active' | 'pending' | 'empty'

export function useRagStatus(): RagDotStatus {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  const { data } = useQuery({
    queryKey: ['rag-namespace'],
    queryFn: getNamespaceStats,
    enabled: isAuthenticated,
    refetchInterval: 30_000,
    staleTime: 25_000,
    retry: false,
  })

  if (!data) return 'empty'
  if (data.status === 'active') return 'active'
  if (data.status === 'at_limit') return 'pending'
  return 'empty'
}
