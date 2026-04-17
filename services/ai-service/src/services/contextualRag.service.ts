import Anthropic from '@anthropic-ai/sdk'
import { CohereClient } from 'cohere-ai'

import { env } from '../config/env.js'
import { selectModelForContextGeneration } from './modelRouter.service.js'

import type { ProjectContext } from '@repo/types'

export interface EnrichedChunk {
  /** Full enriched text for retrieval / rerank (prefix + body when available). */
  text: string
  contextualPrefix: string
  /** Original chunk text without the contextual prefix (falls back to `text`). */
  originalChunkText: string
  score: number
  docId: string
  docName: string
  chunkIndex: number
  chunkId?: string
}

export interface ContextualRagResult {
  chunks: EnrichedChunk[]
  queriesUsed: string[]
  chunksRetrieved: number
  chunksInjected: number
  promptText: string
}

const RRF_K = 60

export async function generateChunkContext(wholeDocument: string, chunkText: string): Promise<string> {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
  const model = selectModelForContextGeneration()
  const msg = await client.messages.create({
    model,
    max_tokens: 512,
    system: [
      {
        type: 'text',
        text: `<document>\n${wholeDocument}\n</document>`,
        cache_control: { type: 'ephemeral' },
      } as never,
    ],
    messages: [
      {
        role: 'user',
        content: `Here is the chunk to situate within the whole document:
<chunk>
${chunkText}
</chunk>
Give a short succinct context (50-100 tokens) to situate this chunk within the document for search retrieval.
Answer ONLY with the succinct context and nothing else.`,
      },
    ],
  })
  return msg.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
}

function chunkKey(c: EnrichedChunk): string {
  return c.chunkId ?? `${c.docId}:${c.chunkIndex}`
}

export function fuseRanks(
  denseResults: EnrichedChunk[],
  bm25Results: EnrichedChunk[],
): EnrichedChunk[] {
  const scores = new Map<string, { chunk: EnrichedChunk; score: number }>()

  const addList = (list: EnrichedChunk[]) => {
    list.forEach((chunk, idx) => {
      const key = chunkKey(chunk)
      const rrf = 1 / (RRF_K + idx + 1)
      const cur = scores.get(key)
      if (cur) cur.score += rrf
      else scores.set(key, { chunk: { ...chunk, score: rrf }, score: rrf })
    })
  }

  addList(denseResults)
  addList(bm25Results)

  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, env.RAG_TOP_K_RETRIEVE)
    .map((e) => ({ ...e.chunk, score: e.score }))
}

export async function rerankWithCohere(
  query: string,
  chunks: EnrichedChunk[],
  topN: number,
): Promise<EnrichedChunk[]> {
  if (chunks.length === 0) return []
  try {
    const cohere = new CohereClient({ token: env.COHERE_API_KEY })
    const res = await cohere.rerank({
      model: 'rerank-3',
      query,
      documents: chunks.map((c) => c.text),
      topN: Math.min(Math.max(topN, 5), chunks.length),
    })
    const ranked = (res.results ?? [])
      .map((r) => {
        const ch = chunks[r.index]
        if (!ch) return null
        return { ch, score: r.relevanceScore ?? 0 }
      })
      .filter((x): x is { ch: EnrichedChunk; score: number } => x !== null)

    const above = ranked
      .filter((x) => x.score > env.RAG_RERANK_MIN_SCORE)
      .map((x) => ({ ...x.ch, score: x.score }))
    if (above.length > 0) return above.slice(0, topN)
    if (ranked[0]) return [{ ...ranked[0].ch, score: ranked[0].score }]
    return chunks.slice(0, Math.min(5, chunks.length))
  } catch {
    return chunks.slice(0, Math.min(5, chunks.length))
  }
}

function normalizeChunk(raw: Partial<EnrichedChunk>): EnrichedChunk {
  const docId = typeof raw.docId === 'string' ? raw.docId : 'unknown'
  const docName = typeof raw.docName === 'string' ? raw.docName : 'document'
  const chunkIndex = typeof raw.chunkIndex === 'number' ? raw.chunkIndex : 0
  const contextualPrefix = typeof raw.contextualPrefix === 'string' ? raw.contextualPrefix : ''
  const body =
    typeof raw.originalChunkText === 'string'
      ? raw.originalChunkText
      : typeof raw.text === 'string'
        ? raw.text
        : ''
  const text =
    typeof raw.text === 'string' && raw.text.length > 0
      ? raw.text
      : contextualPrefix
        ? `${contextualPrefix}\n${body}`
        : body
  const originalChunkText = body || text
  const base: EnrichedChunk = {
    text,
    contextualPrefix,
    originalChunkText,
    score: typeof raw.score === 'number' ? raw.score : 0,
    docId,
    docName,
    chunkIndex,
  }
  if (typeof raw.chunkId === 'string') {
    return { ...base, chunkId: raw.chunkId }
  }
  return base
}

export function formatForPrompt(chunks: EnrichedChunk[]): string {
  const body = chunks
    .map(
      (c, i) =>
        `[Doc ${i + 1}: ${c.docName} | relevance: ${(Math.min(c.score, 1) * 100).toFixed(1)}%]\n${c.contextualPrefix}\n${c.originalChunkText}\n---`,
    )
    .join('\n')
  return `<contextual_rag_results>\n${body}\n</contextual_rag_results>`
}

async function semanticSearch(query: string): Promise<EnrichedChunk[]> {
  const base = env.RAG_SERVICE_URL.replace(/\/$/, '')
  try {
    const res = await fetch(`${base}/rag/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        topK: env.RAG_TOP_K_RETRIEVE,
        hybridAlpha: 0.8,
        useContextualChunks: true,
      }),
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return []
    const json = (await res.json()) as { chunks?: Partial<EnrichedChunk>[] }
    return (json.chunks ?? []).map(normalizeChunk)
  } catch {
    return []
  }
}

async function bm25Search(query: string): Promise<EnrichedChunk[]> {
  const base = env.RAG_SERVICE_URL.replace(/\/$/, '')
  try {
    const res = await fetch(`${base}/rag/bm25-query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        topK: env.RAG_TOP_K_RETRIEVE,
        useContextualChunks: true,
      }),
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return []
    const json = (await res.json()) as { chunks?: Partial<EnrichedChunk>[] }
    return (json.chunks ?? []).map(normalizeChunk)
  } catch {
    return []
  }
}

async function buildQueries(agentTask: string): Promise<string[]> {
  try {
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
    const model = selectModelForContextGeneration()
    const msg = await client.messages.create({
      model,
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: `Produce 2-3 short search queries (one per line, no numbering) for retrieving document passages for:\n${agentTask}`,
        },
      ],
    })
    const text = msg.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    return lines.length ? lines : [agentTask]
  } catch {
    return [agentTask]
  }
}

export async function retrieveForAgent(
  _userId: string,
  agentTask: string,
  _projectContext: ProjectContext,
): Promise<ContextualRagResult> {
  const queriesUsed = await buildQueries(agentTask)
  const denseLists = await Promise.all(queriesUsed.map((q) => semanticSearch(q)))
  const bm25Lists = await Promise.all(queriesUsed.map((q) => bm25Search(q)))
  const denseMerged = denseLists.flat()
  const bm25Merged = bm25Lists.flat()
  const fused = fuseRanks(denseMerged, bm25Merged)
  const reranked = await rerankWithCohere(agentTask, fused, env.RAG_TOP_K_INJECT)
  const promptText = reranked.length ? formatForPrompt(reranked) : ''
  return {
    chunks: reranked,
    queriesUsed,
    chunksRetrieved: fused.length,
    chunksInjected: reranked.length,
    promptText,
  }
}
