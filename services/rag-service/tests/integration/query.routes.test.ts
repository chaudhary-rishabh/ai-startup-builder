import { randomUUID } from 'node:crypto'

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createApp } from '../../src/app.js'
import { signTestAccessToken } from '../jwt.js'

const runQueryPipeline = vi.hoisted(() => vi.fn())
const getNamespaceStats = vi.hoisted(() => vi.fn())
const updateNamespaceStats = vi.hoisted(() => vi.fn())
const queryHybrid = vi.hoisted(() => vi.fn())
const deleteNamespacePinecone = vi.hoisted(() => vi.fn())
const getPineconeNsStats = vi.hoisted(() => vi.fn())
const listDocumentsByUserForDeletion = vi.hoisted(() => vi.fn())
const deleteDocument = vi.hoisted(() => vi.fn())
const encodeQuery = vi.hoisted(() => vi.fn())

vi.mock('../../src/services/queryPipeline.service.js', () => ({
  runQueryPipeline,
}))

vi.mock('../../src/db/queries/ragNamespaces.queries.js', () => ({
  getNamespaceStats,
  pineconeNamespaceForUser: (id: string) => `user_${String(id).replace(/-/g, '')}`,
  updateNamespaceStats,
  findOrCreateNamespace: vi.fn(),
  deleteNamespace: vi.fn(),
}))

vi.mock('../../src/db/queries/ragDocuments.queries.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../src/db/queries/ragDocuments.queries.js')>()
  return {
    ...actual,
    listDocumentsByUserForDeletion,
    deleteDocument,
  }
})

vi.mock('../../src/services/pinecone.service.js', () => ({
  pineconeService: {
    queryHybrid,
    getNamespaceStats: getPineconeNsStats,
    deleteNamespace: deleteNamespacePinecone,
    deleteVectorsByDocId: vi.fn(),
    upsertVectors: vi.fn(),
  },
}))

vi.mock('../../src/services/bm25Encoder.service.js', () => ({
  bm25EncoderService: { encodeQuery },
  createBm25EncoderForDocument: vi.fn(),
}))

describe('query routes (integration-style, mocked backends)', () => {
  let token: string
  let userId: string

  beforeAll(async () => {
    userId = randomUUID()
    token = await signTestAccessToken({ userId, plan: 'pro' })
  })

  beforeEach(() => {
    vi.clearAllMocks()
    getNamespaceStats.mockResolvedValue({
      userId,
      pineconeNamespace: `user_${userId.replace(/-/g, '')}`,
      docCount: 2,
      totalChunks: 4,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    getPineconeNsStats.mockResolvedValue({ vectorCount: 10, dimension: 3072 })
    encodeQuery.mockResolvedValue({ indices: [1], values: [0.5] })
    queryHybrid.mockResolvedValue([])
    listDocumentsByUserForDeletion.mockResolvedValue([])
    deleteDocument.mockResolvedValue(true)
    deleteNamespacePinecone.mockResolvedValue(undefined)
    updateNamespaceStats.mockResolvedValue(undefined)
  })

  it('POST /rag/query returns 401 without auth', async () => {
    const app = createApp()
    const res = await app.request('http://localhost/rag/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'hello world' }),
    })
    expect(res.status).toBe(401)
  })

  it('POST /rag/query returns 400 when query too short', async () => {
    const app = createApp()
    const res = await app.request('http://localhost/rag/query', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: 'ab' }),
    })
    expect(res.status).toBe(400)
  })

  it('POST /rag/query returns 200 with chunks array', async () => {
    runQueryPipeline.mockResolvedValueOnce({
      chunks: [
        {
          chunkId: 'c1',
          text: 'enriched',
          contextualPrefix: 'ctx',
          originalText: 'orig',
          score: 0.9,
          docId: 'd1',
          docName: 'f.txt',
          fileType: 'txt',
          chunkIndex: 0,
        },
      ],
      query: 'hello world there',
      queriesUsed: ['hello world there'],
      denseResultCount: 2,
      bm25ResultCount: 1,
      fusedResultCount: 2,
      finalResultCount: 1,
      cacheHit: false,
      processingMs: 12,
      rerankerUsed: true,
    })
    const app = createApp()
    const res = await app.request('http://localhost/rag/query', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: 'hello world there', topK: 3 }),
    })
    expect(res.status).toBe(200)
    const j = (await res.json()) as {
      data: { chunks: unknown[]; debug: { rerankerUsed: boolean } }
    }
    expect(j.data.chunks.length).toBe(1)
    expect(j.data.debug.rerankerUsed).toBe(true)
  })

  it('POST /rag/query empty namespace returns empty chunks', async () => {
    runQueryPipeline.mockResolvedValueOnce({
      chunks: [],
      query: 'q',
      queriesUsed: [],
      denseResultCount: 0,
      bm25ResultCount: 0,
      fusedResultCount: 0,
      finalResultCount: 0,
      cacheHit: false,
      processingMs: 1,
      rerankerUsed: false,
    })
    const app = createApp()
    const res = await app.request('http://localhost/rag/query', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: 'empty namespace query' }),
    })
    expect(res.status).toBe(200)
    const j = (await res.json()) as { data: { totalFound: number } }
    expect(j.data.totalFound).toBe(0)
  })

  it('POST /rag/query second identical query reports cacheHit', async () => {
    runQueryPipeline
      .mockResolvedValueOnce({
        chunks: [
          {
            chunkId: '1',
            text: 't',
            contextualPrefix: '',
            originalText: 't',
            score: 1,
            docId: 'd',
            docName: 'n',
            fileType: 'txt',
            chunkIndex: 0,
          },
        ],
        query: 'same cache query text',
        queriesUsed: ['same cache query text'],
        denseResultCount: 1,
        bm25ResultCount: 0,
        fusedResultCount: 1,
        finalResultCount: 1,
        cacheHit: false,
        processingMs: 5,
        rerankerUsed: false,
      })
      .mockResolvedValueOnce({
        chunks: [
          {
            chunkId: '1',
            text: 't',
            contextualPrefix: '',
            originalText: 't',
            score: 1,
            docId: 'd',
            docName: 'n',
            fileType: 'txt',
            chunkIndex: 0,
          },
        ],
        query: 'same cache query text',
        queriesUsed: ['same cache query text'],
        denseResultCount: 1,
        bm25ResultCount: 0,
        fusedResultCount: 1,
        finalResultCount: 1,
        cacheHit: true,
        processingMs: 1,
        rerankerUsed: false,
      })
    const app = createApp()
    const body = JSON.stringify({ query: 'same cache query text' })
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    await app.request('http://localhost/rag/query', { method: 'POST', headers, body })
    const r2 = await app.request('http://localhost/rag/query', { method: 'POST', headers, body })
    const j2 = (await r2.json()) as { data: { cacheHit: boolean } }
    expect(j2.data.cacheHit).toBe(true)
  })

  it('POST /rag/bm25-query stopword-only query returns empty', async () => {
    encodeQuery.mockResolvedValueOnce({ indices: [], values: [] })
    const app = createApp()
    const res = await app.request('http://localhost/rag/bm25-query', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: 'the and or', topK: 5 }),
    })
    expect(res.status).toBe(200)
    const j = (await res.json()) as { data: { totalFound: number } }
    expect(j.data.totalFound).toBe(0)
    expect(queryHybrid).not.toHaveBeenCalled()
  })

  it('POST /rag/bm25-query returns keyword-matched chunks', async () => {
    encodeQuery.mockResolvedValueOnce({ indices: [11], values: [0.9] })
    queryHybrid.mockResolvedValueOnce([
      {
        id: 'id1',
        score: 0.8,
        metadata: {
          docId: 'd',
          userId,
          filename: 'f',
          chunkIndex: 0,
          contextualPrefix: '',
          originalText: 'o',
          enrichedText: 'e',
          tokenCount: 1,
          fileType: 'txt',
        },
      },
    ])
    const app = createApp()
    const res = await app.request('http://localhost/rag/bm25-query', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: 'keyword search phrase here', topK: 5 }),
    })
    expect(res.status).toBe(200)
    const j = (await res.json()) as { data: { totalFound: number } }
    expect(j.data.totalFound).toBe(1)
  })

  it('GET /rag/namespace returns docCount and vectorCount', async () => {
    const app = createApp()
    const res = await app.request('http://localhost/rag/namespace', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const j = (await res.json()) as { data: { docCount: number; vectorCount: number } }
    expect(j.data.docCount).toBe(2)
    expect(j.data.vectorCount).toBe(10)
  })

  it('DELETE /rag/namespace without confirm returns 400', async () => {
    const app = createApp()
    const res = await app.request('http://localhost/rag/namespace', {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it('DELETE /rag/namespace with confirm returns 200 and clears namespace', async () => {
    const freshUserId = randomUUID()
    const freshToken = await signTestAccessToken({ userId: freshUserId, plan: 'pro' })
    getNamespaceStats.mockResolvedValueOnce({
      userId: freshUserId,
      pineconeNamespace: `user_${freshUserId.replace(/-/g, '')}`,
      docCount: 1,
      totalChunks: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    listDocumentsByUserForDeletion.mockResolvedValueOnce([
      {
        id: 'd1',
        userId: freshUserId,
        chunkCount: 2,
        pineconeNamespace: `user_${freshUserId.replace(/-/g, '')}`,
      },
    ])
    const app = createApp()
    const res = await app.request('http://localhost/rag/namespace', {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${freshToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ confirm: 'DELETE_ALL' }),
    })
    expect(res.status).toBe(200)
    expect(deleteNamespacePinecone).toHaveBeenCalled()
    expect(deleteDocument).toHaveBeenCalledWith('d1', freshUserId)
  })
})
