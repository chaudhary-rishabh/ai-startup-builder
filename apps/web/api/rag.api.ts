import api from '@/lib/axios'

export interface RagNamespaceStats {
  namespace: string
  docCount: number
  docLimit: number
  status: 'active' | 'empty' | 'at_limit'
  lastIndexedAt: string | null
}

export async function getNamespaceStats(): Promise<RagNamespaceStats> {
  const res = await api.get<{ data: RagNamespaceStats }>('/rag/namespace')
  return res.data.data
}
