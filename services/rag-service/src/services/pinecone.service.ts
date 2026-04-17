import { Pinecone } from '@pinecone-database/pinecone'

import { env } from '../config/env.js'
import { AppError } from '../lib/errors.js'
import { logger } from '../lib/logger.js'

import type { SparseVector } from './bm25Encoder.service.js'

export interface UpsertParams {
  namespace: string
  vectors: Array<{
    id: string
    values: number[]
    sparseValues: SparseVector
    metadata: Record<string, unknown>
  }>
}

export interface QueryParams {
  namespace: string
  vector: number[]
  sparseVector?: SparseVector
  topK: number
  alpha?: number
  filter?: Record<string, unknown>
  includeMetadata?: boolean
}

export interface QueryResult {
  id: string
  score: number
  metadata: {
    docId: string
    userId: string
    filename: string
    chunkIndex: number
    contextualPrefix: string
    originalText: string
    enrichedText: string
    tokenCount: number
    fileType: string
  }
}

export function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size))
  }
  return out
}

export function scaleVector(v: number[], scalar: number): number[] {
  return v.map((x) => x * scalar)
}

function httpStatusFromError(err: unknown): number | undefined {
  const e = err as { status?: number; response?: { status?: number } }
  return e.status ?? e.response?.status
}

export class PineconeService {
  private readonly client: Pinecone
  private readonly indexName: string

  constructor() {
    this.client = new Pinecone({ apiKey: env.PINECONE_API_KEY })
    this.indexName = env.PINECONE_INDEX_NAME
    void env.PINECONE_ENVIRONMENT
  }

  private get index() {
    return this.client.index(this.indexName)
  }

  async upsertVectors(params: UpsertParams): Promise<void> {
    const ns = this.index.namespace(params.namespace)
    const batches = chunkArray(params.vectors, 100)
    for (const batch of batches) {
      try {
        const records = batch.map((v) => {
          const rec: {
            id: string
            values: number[]
            metadata: Record<string, unknown>
            sparseValues?: { indices: number[]; values: number[] }
          } = {
            id: v.id,
            values: v.values,
            metadata: v.metadata,
          }
          if (v.sparseValues.indices.length > 0) {
            rec.sparseValues = {
              indices: v.sparseValues.indices,
              values: v.sparseValues.values,
            }
          }
          return rec
        })
        await ns.upsert(records as never)
      } catch (err) {
        const st = httpStatusFromError(err)
        if (st === 429) {
          throw new AppError('PINECONE_RATE_LIMIT', 'Pinecone rate limit exceeded', 429)
        }
        if (typeof st === 'number' && st >= 500) {
          throw new AppError('PINECONE_UNAVAILABLE', 'Pinecone temporarily unavailable', 503)
        }
        const msg = err instanceof Error ? err.message : String(err)
        throw new AppError('PINECONE_UPSERT_FAILED', msg, 502)
      }
    }
  }

  async queryHybrid(params: QueryParams): Promise<QueryResult[]> {
    const alpha = params.alpha ?? env.HYBRID_ALPHA
    const ns = this.index.namespace(params.namespace)

    const dense =
      params.sparseVector && params.sparseVector.indices.length > 0
        ? scaleVector(params.vector, alpha)
        : params.vector

    const sparseVector =
      params.sparseVector && params.sparseVector.indices.length > 0
        ? {
            indices: params.sparseVector.indices,
            values: params.sparseVector.values.map((v) => v * (1 - alpha)),
          }
        : undefined

    try {
      const q: {
        vector: number[]
        topK: number
        includeMetadata: boolean
        sparseVector?: { indices: number[]; values: number[] }
        filter?: Record<string, unknown>
      } = {
        vector: dense,
        topK: params.topK,
        includeMetadata: params.includeMetadata ?? true,
      }
      if (sparseVector) q.sparseVector = sparseVector
      if (params.filter) q.filter = params.filter

      const response = await ns.query(q as never)

      return (response.matches ?? [])
        .filter((m) => m.metadata != null)
        .map((m) => ({
          id: m.id ?? '',
          score: m.score ?? 0,
          metadata: m.metadata as QueryResult['metadata'],
        }))
    } catch (err) {
      const st = httpStatusFromError(err)
      if (st === 404) {
        return []
      }
      if (st === 429) {
        throw new AppError('PINECONE_RATE_LIMIT', 'Pinecone rate limit exceeded', 429)
      }
      if (typeof st === 'number' && st >= 500) {
        throw new AppError('PINECONE_UNAVAILABLE', 'Pinecone temporarily unavailable', 503)
      }
      logger.warn('Pinecone queryHybrid error', { err })
      return []
    }
  }

  async deleteVectorsByDocId(namespace: string, docId: string): Promise<void> {
    const ns = this.index.namespace(namespace)
    try {
      await ns.deleteMany({ filter: { docId: { $eq: docId } } })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new AppError(
        'PINECONE_DELETE_FAILED',
        `Vector deletion from Pinecone failed. Document record preserved. Please retry. ${msg}`,
        502,
      )
    }
  }

  async deleteNamespace(namespace: string): Promise<void> {
    const ns = this.index.namespace(namespace)
    await ns.deleteAll()
  }

  async getNamespaceStats(
    namespace: string,
  ): Promise<{ vectorCount: number; dimension: number } | null> {
    try {
      const stats = await this.index.describeIndexStats()
      const nsStats = stats.namespaces?.[namespace]
      if (!nsStats) return null
      return {
        vectorCount: nsStats.recordCount ?? 0,
        dimension: stats.dimension ?? 3072,
      }
    } catch {
      return null
    }
  }
}

export const pineconeService = new PineconeService()
