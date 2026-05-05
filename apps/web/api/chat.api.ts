import api from '@/lib/axios'

export interface ChatResponse {
  content: string
  model: string
  inputTokens: number
  outputTokens: number
  tokensUsed: number
}

export async function sendChatMessage(content: string, model?: string): Promise<ChatResponse> {
  const res = await api.post<{ data: ChatResponse }>('/ai/chat', { content, model })
  return res.data.data
}
