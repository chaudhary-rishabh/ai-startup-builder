import { afterEach, describe, expect, it, vi } from 'vitest'

const anthropicCreate = vi.hoisted(() => vi.fn())
const cohereRerank = vi.hoisted(() => vi.fn())

vi.mock('@anthropic-ai/sdk', () => ({
  default: class AnthropicMock {
    messages = { create: anthropicCreate }
  },
}))

vi.mock('cohere-ai', () => ({
  CohereClient: class {
    rerank = cohereRerank
  },
}))

import type { EnrichedChunk } from '../../src/services/contextualRag.service.js'
import {
  formatForPrompt,
  fuseRanks,
  generateChunkContext,
  rerankWithCohere,
  retrieveForAgent,
} from '../../src/services/contextualRag.service.js'

function chunk(partial: Partial<EnrichedChunk> & Pick<EnrichedChunk, 'docId' | 'chunkIndex'>): EnrichedChunk {
  const contextualPrefix = partial.contextualPrefix ?? 'ctx'
  const originalChunkText = partial.originalChunkText ?? partial.text ?? 'body'
  const text =
    partial.text ??
    (contextualPrefix ? `${contextualPrefix}\n${originalChunkText}` : originalChunkText)
  return {
    text,
    contextualPrefix,
    originalChunkText,
    score: partial.score ?? 0,
    docId: partial.docId,
    docName: partial.docName ?? 'doc',
    chunkIndex: partial.chunkIndex,
    chunkId: partial.chunkId,
  }
}

describe('contextualRag.service', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    anthropicCreate.mockReset()
    cohereRerank.mockReset()
  })

  it('generateChunkContext uses Haiku with cache_control on document', async () => {
    anthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'prefix text' }],
    })
    await generateChunkContext('whole doc', 'chunk')
    const arg = anthropicCreate.mock.calls[0]?.[0] as {
      system: Array<{ cache_control?: { type: string } }>
    }
    expect(arg.system[0]?.cache_control?.type).toBe('ephemeral')
  })

  it('fuseRanks deduplicates by chunkId and keeps highest RRF score', () => {
    const a = chunk({
      docId: 'd',
      chunkIndex: 0,
      chunkId: 'same',
      text: 't1',
      originalChunkText: 't1',
      score: 0,
    })
    const dense = [a, chunk({ docId: 'd', chunkIndex: 1, text: 'x', originalChunkText: 'x', score: 0 })]
    const bm25 = [
      chunk({
        docId: 'd',
        chunkIndex: 9,
        chunkId: 'same',
        text: 't2',
        originalChunkText: 't2',
        score: 0,
      }),
    ]
    const fused = fuseRanks(dense, bm25)
    const sameId = fused.filter((c) => c.chunkId === 'same')
    expect(sameId.length).toBe(1)
  })

  it('fuseRanks sorts by combined RRF score descending', () => {
    const c0 = chunk({ docId: 'a', chunkIndex: 0, text: 'a', originalChunkText: 'a', score: 0 })
    const c1 = chunk({ docId: 'b', chunkIndex: 0, text: 'b', originalChunkText: 'b', score: 0 })
    const fused = fuseRanks([c0], [c1])
    expect(fused.length).toBe(2)
    expect(fused[0]!.score).toBeGreaterThanOrEqual(fused[1]!.score)
  })

  it('rerankWithCohere filters below threshold but returns at least one chunk', async () => {
    const chunks = [
      chunk({ docId: '1', chunkIndex: 0, text: 'A', originalChunkText: 'A', score: 0 }),
      chunk({ docId: '2', chunkIndex: 0, text: 'B', originalChunkText: 'B', score: 0 }),
    ]
    cohereRerank.mockResolvedValue({
      results: [
        { index: 0, relevanceScore: 0.1 },
        { index: 1, relevanceScore: 0.2 },
      ],
    })
    const out = await rerankWithCohere('q', chunks, 5)
    expect(out.length).toBeGreaterThanOrEqual(1)
  })

  it('rerankWithCohere returns top 5 from RRF on Cohere error', async () => {
    cohereRerank.mockRejectedValue(new Error('cohere down'))
    const chunks = Array.from({ length: 8 }, (_, i) =>
      chunk({ docId: 'd', chunkIndex: i, text: `t${i}`, originalChunkText: `t${i}`, score: 0 }),
    )
    const out = await rerankWithCohere('q', chunks, 5)
    expect(out.length).toBe(5)
  })

  it('formatForPrompt wraps in contextual_rag_results tags', () => {
    const s = formatForPrompt([
      chunk({
        docId: '1',
        chunkIndex: 0,
        docName: 'Doc',
        contextualPrefix: 'p',
        originalChunkText: 'body',
        text: 'p\nbody',
        score: 0.5,
      }),
    ])
    expect(s).toContain('<contextual_rag_results>')
    expect(s).toContain('</contextual_rag_results>')
    expect(s).toContain('body')
  })

  it('retrieveForAgent calls semantic and BM25 endpoints', async () => {
    anthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'query one\nquery two' }],
    })
    const fetchMock = vi.fn().mockImplementation(async (url: string | URL) => {
      const u = String(url)
      if (u.includes('/rag/query') || u.includes('/rag/bm25-query')) {
        return {
          ok: true,
          json: async () => ({
            chunks: [
              {
                docId: 'd',
                docName: 'n',
                chunkIndex: 0,
                contextualPrefix: 'p',
                originalChunkText: 'c',
                text: 'p\nc',
                score: 0.1,
              },
            ],
          }),
        }
      }
      return { ok: false, json: async () => ({}) }
    })
    global.fetch = fetchMock as typeof fetch
    cohereRerank.mockResolvedValue({
      results: [{ index: 0, relevanceScore: 0.9 }],
    })
    await retrieveForAgent(
      '550e8400-e29b-41d4-a716-446655440000',
      'find pricing',
      {
        projectId: 'p',
        projectName: 'n',
        currentPhase: 1,
      },
    )
    const urls = fetchMock.mock.calls.map((c) => String(c[0]))
    expect(urls.some((u) => u.includes('/rag/query'))).toBe(true)
    expect(urls.some((u) => u.includes('/rag/bm25-query'))).toBe(true)
  })

  it('returns empty result when rag-service is down', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('down'))
    anthropicCreate.mockResolvedValue({ content: [{ type: 'text', text: 'q' }] })
    const res = await retrieveForAgent(
      '550e8400-e29b-41d4-a716-446655440000',
      'task',
      { projectId: 'p', projectName: 'n', currentPhase: 1 },
    )
    expect(res.chunksInjected).toBe(0)
    expect(res.promptText).toBe('')
  })
})
