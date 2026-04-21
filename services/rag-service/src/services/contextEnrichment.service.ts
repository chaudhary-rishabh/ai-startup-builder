import Anthropic from '@anthropic-ai/sdk'

import { env } from '../config/env.js'
import { logger } from '../lib/logger.js'

import type { Chunk } from './chunker.service.js'

export interface EnrichedChunk {
  originalText: string
  contextualPrefix: string
  enrichedText: string
  chunkIndex: number
  tokenCount: number
}

export interface EnrichmentResult {
  enrichedChunks: EnrichedChunk[]
  totalContextTokens: number
  cacheHits: number
  cacheMisses: number
  costUsd: string
}

function calculateEnrichmentCost(
  docTokens: number,
  cacheHits: number,
  cacheMisses: number,
  outputTokens: number,
): string {
  const missTokenCost = (docTokens / 1000) * 0.00025 * cacheMisses
  const hitTokenCost = (docTokens / 1000) * 0.000025 * cacheHits
  const outputCost = (outputTokens / 1000) * 0.00125
  const total = missTokenCost + hitTokenCost + outputCost
  return total.toFixed(6)
}

const SYSTEM_TEMPLATE = (fullDocumentText: string) =>
  `<document>
${fullDocumentText}
</document>`

const USER_TEMPLATE = (chunkText: string) =>
  `Here is the chunk we want to situate within the whole document:

<chunk>
${chunkText}
</chunk>

Please give a short succinct context to situate this chunk within the overall document for the purposes of improving search retrieval of the chunk. Answer only with the succinct context and nothing else.`

export async function enrichChunks(
  fullDocumentText: string,
  chunks: Chunk[],
  docMetadata: { filename: string; fileType: string; userId: string },
): Promise<EnrichmentResult> {
  if (!env.CONTEXT_ENRICHMENT_ENABLED) {
    return {
      enrichedChunks: chunks.map((c) => ({
        originalText: c.text,
        contextualPrefix: '',
        enrichedText: c.text,
        chunkIndex: c.chunkIndex,
        tokenCount: c.tokenCount,
      })),
      totalContextTokens: 0,
      cacheHits: 0,
      cacheMisses: 0,
      costUsd: '0.000000',
    }
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
  const enrichedChunks: EnrichedChunk[] = []
  let cacheHits = 0
  let cacheMisses = 0
  let totalContextTokens = 0

  void docMetadata

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!
    try {
      const systemBlock = {
        type: 'text' as const,
        text: SYSTEM_TEMPLATE(fullDocumentText),
        cache_control: { type: 'ephemeral' as const },
      }

      const response = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 200,
        system: [systemBlock as never],
        messages: [
          {
            role: 'user',
            content: USER_TEMPLATE(chunk.text),
          },
        ],
      })

      const first = response.content[0]
      const contextualPrefix =
        first && first.type === 'text' ? first.text.trim() : ''

      const usage = response.usage as {
        cache_read_input_tokens?: number
        output_tokens?: number
      }
      if ((usage?.cache_read_input_tokens ?? 0) > 0) {
        cacheHits++
      } else {
        cacheMisses++
      }
      totalContextTokens += usage?.output_tokens ?? 0

      enrichedChunks.push({
        originalText: chunk.text,
        contextualPrefix,
        enrichedText: contextualPrefix ? `${contextualPrefix}\n\n${chunk.text}` : chunk.text,
        chunkIndex: chunk.chunkIndex,
        tokenCount: chunk.tokenCount,
      })
    } catch (err) {
      logger.warn('Context enrichment failed for chunk, using original', {
        chunkIndex: chunk.chunkIndex,
        error: err,
      })
      enrichedChunks.push({
        originalText: chunk.text,
        contextualPrefix: '',
        enrichedText: chunk.text,
        chunkIndex: chunk.chunkIndex,
        tokenCount: chunk.tokenCount,
      })
    }

    if (i < chunks.length - 1) {
      await new Promise((r) => setTimeout(r, 100))
    }
  }

  const docTokens = Math.max(1, Math.ceil(fullDocumentText.length / 4))
  const costUsd = calculateEnrichmentCost(docTokens, cacheHits, cacheMisses, totalContextTokens)

  return { enrichedChunks, totalContextTokens, cacheHits, cacheMisses, costUsd }
}
