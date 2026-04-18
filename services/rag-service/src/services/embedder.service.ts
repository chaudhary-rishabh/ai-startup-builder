import OpenAI from 'openai'

import { env } from '../config/env.js'
import { AppError } from '../lib/errors.js'

export interface EmbeddingResult {
  embeddings: number[][]
  model: string
  totalTokens: number
}

export const EMBEDDING_MODEL = 'text-embedding-3-large'
export const EMBEDDING_DIMENSIONS = 3072
export const BATCH_SIZE = 100

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY })

function classifyOpenAiError(err: unknown): AppError {
  const e = err as { status?: number; message?: string }
  if (e.status === 429) {
    return new AppError(
      'EMBEDDING_RATE_LIMIT',
      'OpenAI embeddings rate limit hit. Retry after backoff.',
      429,
    )
  }
  if (typeof e.status === 'number' && e.status >= 500) {
    return new AppError('EMBEDDING_SERVICE_UNAVAILABLE', 'OpenAI embeddings API unavailable.', 503)
  }
  return new AppError('EMBEDDING_FAILED', e.message ?? 'Embedding failed', 502)
}

export async function embedTexts(texts: string[]): Promise<EmbeddingResult> {
  if (texts.length === 0) {
    return { embeddings: [], model: EMBEDDING_MODEL, totalTokens: 0 }
  }

  const batches: string[][] = []
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    batches.push(texts.slice(i, i + BATCH_SIZE))
  }

  const allEmbeddings: number[][] = []
  let totalTokens = 0

  for (const batch of batches) {
    try {
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batch,
        encoding_format: 'float',
      })
      response.data.sort((a, b) => a.index - b.index)
      allEmbeddings.push(...response.data.map((d) => d.embedding))
      totalTokens += response.usage.total_tokens
    } catch (err) {
      throw classifyOpenAiError(err)
    }
  }

  return { embeddings: allEmbeddings, model: EMBEDDING_MODEL, totalTokens }
}

export async function embedSingleText(text: string): Promise<number[]> {
  const result = await embedTexts([text])
  const first = result.embeddings[0]
  if (!first) throw new AppError('EMBEDDING_FAILED', 'No embedding returned', 502)
  return first
}
