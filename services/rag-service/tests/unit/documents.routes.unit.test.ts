import { randomUUID } from 'node:crypto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createApp } from '../../src/app.js'
import { signTestAccessToken } from '../jwt.js'

const rag = vi.hoisted(() => ({
  countDocumentsByUser: vi.fn().mockResolvedValue(0),
  findDocumentByHash: vi.fn().mockResolvedValue(undefined),
  findDocumentById: vi.fn(),
  findDocumentFullText: vi.fn(),
  findDocumentsByUser: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  createRagDocument: vi.fn(async (data: Record<string, unknown>) => ({
    ...data,
    id: data['id'],
    filename: data['filename'],
    name: data['name'],
    fileType: data['fileType'],
    status: data['status'] ?? 'pending',
  })),
  deleteDocument: vi.fn().mockResolvedValue(true),
}))

const ns = vi.hoisted(() => ({
  findOrCreateNamespace: vi.fn().mockResolvedValue({}),
  pineconeNamespaceForUser: vi.fn((uid: string) => `user_${String(uid).replace(/-/g, '')}`),
  updateNamespaceStats: vi.fn().mockResolvedValue(undefined),
  deleteNamespace: vi.fn().mockResolvedValue(undefined),
  getNamespaceStats: vi.fn().mockResolvedValue({
    userId: 'u',
    pineconeNamespace: 'user_u',
    docCount: 0,
    totalChunks: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
}))

const pine = vi.hoisted(() => ({
  deleteVectorsByDocId: vi.fn().mockResolvedValue(undefined),
  getNamespaceStats: vi.fn().mockResolvedValue({ vectorCount: 2, dimension: 3072 }),
  queryHybrid: vi.fn().mockResolvedValue([]),
}))

const queue = vi.hoisted(() => ({
  enqueueIngestJob: vi.fn().mockResolvedValue({ id: 'job-1' }),
}))

const reindex = vi.hoisted(() => ({
  forceReindex: vi.fn().mockResolvedValue({ documentsQueued: 2 }),
}))

const dbm = vi.hoisted(() => ({
  execute: vi.fn().mockResolvedValue({ rows: [{ id: 'x' }] }),
  stats: vi.fn().mockResolvedValue([
    {
      totalDocuments: 0,
      indexedDocuments: 0,
      failedDocuments: 0,
      processingDocuments: 0,
      totalUsers: 0,
    },
  ]),
}))

vi.mock('../../src/db/queries/ragDocuments.queries.js', () => rag)
vi.mock('../../src/db/queries/ragNamespaces.queries.js', () => ns)
vi.mock('../../src/services/pinecone.service.js', () => ({
  pineconeService: pine,
}))
vi.mock('../../src/queues/embed.queue.js', () => queue)
vi.mock('../../src/services/reindex.service.js', () => reindex)
vi.mock('../../src/lib/db.js', () => ({
  getDb: vi.fn(() => ({
    execute: dbm.execute,
    select: vi.fn(() => ({
      from: dbm.stats,
    })),
  })),
}))

function mkIndexedDoc(over: Record<string, unknown> = {}) {
  const id = String(over['id'] ?? randomUUID())
  const userId = String(over['userId'] ?? '')
  return {
    id,
    userId,
    name: 'f.pdf',
    filename: 'f.pdf',
    fileType: 'pdf',
    fileSizeBytes: 100,
    sourceType: 'upload',
    sourceUrl: null,
    s3Key: 'rag/k/raw',
    contentHash: 'abc',
    chunkCount: 2,
    status: 'indexed' as const,
    pineconeNamespace: `user_${userId.replace(/-/g, '')}`,
    customInstructions: null,
    errorMessage: null,
    indexedAt: new Date(),
    createdAt: new Date(),
    ...over,
  }
}

describe('documents routes (unit, mocked db)', () => {
  let app: ReturnType<typeof createApp>
  let userId: string
  let token: string

  beforeEach(async () => {
    vi.clearAllMocks()
    rag.countDocumentsByUser.mockResolvedValue(0)
    rag.findDocumentByHash.mockResolvedValue(undefined)
    rag.findDocumentsByUser.mockResolvedValue({ data: [], total: 0 })
    rag.findDocumentById.mockImplementation(() => Promise.resolve(undefined))
    rag.findDocumentFullText.mockResolvedValue({ filename: 'x.txt', fullText: 'one two three' })
    rag.deleteDocument.mockResolvedValue(true)
    rag.createRagDocument.mockImplementation(async (data: Record<string, unknown>) => ({
      ...data,
      id: data['id'],
      filename: data['filename'],
      name: data['name'],
      fileType: data['fileType'],
      status: data['status'] ?? 'pending',
    }))
    app = createApp()
    userId = randomUUID()
    token = await signTestAccessToken({ userId, plan: 'pro' })
  })

  it('POST /rag/documents returns 400 without file', async () => {
    const form = new FormData()
    const res = await app.request('http://localhost/rag/documents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
    expect(res.status).toBe(400)
  })

  it('POST /rag/documents returns 413 when file too large', async () => {
    const big = new Uint8Array(21 * 1024 * 1024).fill(97)
    const form = new FormData()
    form.append('file', new Blob([big], { type: 'application/pdf' }), 'huge.pdf')
    const res = await app.request('http://localhost/rag/documents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
    expect(res.status).toBe(413)
  })

  it('POST /rag/documents returns 415 for unsupported type', async () => {
    const form = new FormData()
    form.append('file', new Blob([Buffer.from('x')], { type: 'image/png' }), 'x.png')
    const res = await app.request('http://localhost/rag/documents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
    expect(res.status).toBe(415)
  })

  it('POST /rag/documents returns 422 when plan limit reached', async () => {
    rag.countDocumentsByUser.mockResolvedValueOnce(10_000)
    const form = new FormData()
    form.append('file', new Blob([Buffer.from('hello')], { type: 'text/plain' }), 'a.txt')
    const res = await app.request('http://localhost/rag/documents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
    expect(res.status).toBe(422)
    const j = (await res.json()) as { error: { code: string } }
    expect(j.error.code).toBe('RAG_DOCUMENT_LIMIT_EXCEEDED')
  })

  it('POST /rag/documents returns 200 when duplicate already indexed', async () => {
    rag.findDocumentByHash.mockResolvedValueOnce(
      mkIndexedDoc({ id: 'dup-1', userId, status: 'indexed' }),
    )
    const form = new FormData()
    form.append('file', new Blob([Buffer.from('same')], { type: 'text/plain' }), 'a.txt')
    const res = await app.request('http://localhost/rag/documents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
    expect(res.status).toBe(200)
  })

  it('POST /rag/documents returns 202 when duplicate pending', async () => {
    rag.findDocumentByHash.mockResolvedValueOnce(
      mkIndexedDoc({ id: 'dup-2', userId, status: 'pending' }),
    )
    const form = new FormData()
    form.append('file', new Blob([Buffer.from('same2')], { type: 'text/plain' }), 'b.txt')
    const res = await app.request('http://localhost/rag/documents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
    expect(res.status).toBe(202)
  })

  it('POST /rag/documents returns 202 for valid upload', async () => {
    const form = new FormData()
    form.append('file', new Blob([Buffer.from('hello world pdf text')], { type: 'application/pdf' }), 'a.pdf')
    const res = await app.request('http://localhost/rag/documents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
    expect(res.status).toBe(202)
    expect(queue.enqueueIngestJob).toHaveBeenCalled()
  })

  it('GET /rag/documents lists documents', async () => {
    rag.findDocumentsByUser.mockResolvedValueOnce({
      data: [mkIndexedDoc({ id: 'd1', userId })],
      total: 1,
    })
    const res = await app.request('http://localhost/rag/documents?page=1&limit=10', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const j = (await res.json()) as { data: { documents: unknown[]; total: number } }
    expect(j.data.total).toBe(1)
  })

  it('GET /rag/documents/:docId returns 404 for unknown doc', async () => {
    const res = await app.request(`http://localhost/rag/documents/${randomUUID()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(404)
  })

  it('GET /rag/documents/:docId returns document when found', async () => {
    const docId = randomUUID()
    rag.findDocumentById.mockResolvedValueOnce(mkIndexedDoc({ id: docId, userId }))
    const res = await app.request(`http://localhost/rag/documents/${docId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
  })

  it('GET /rag/documents/:docId/text returns 422 when not indexed', async () => {
    const docId = randomUUID()
    rag.findDocumentById.mockResolvedValueOnce(
      mkIndexedDoc({ id: docId, userId, status: 'processing' }),
    )
    const res = await app.request(`http://localhost/rag/documents/${docId}/text`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(422)
  })

  it('GET /rag/documents/:docId/text returns full text when indexed', async () => {
    const docId = randomUUID()
    rag.findDocumentById.mockResolvedValueOnce(mkIndexedDoc({ id: docId, userId }))
    const res = await app.request(`http://localhost/rag/documents/${docId}/text`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const j = (await res.json()) as { data: { fullText: string } }
    expect(j.data.fullText).toContain('three')
  })

  it('DELETE /rag/documents/:docId deletes and updates stats', async () => {
    const docId = randomUUID()
    rag.findDocumentById.mockResolvedValueOnce(mkIndexedDoc({ id: docId, userId }))
    const res = await app.request(`http://localhost/rag/documents/${docId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    expect(pine.deleteVectorsByDocId).toHaveBeenCalled()
    expect(rag.deleteDocument).toHaveBeenCalledWith(docId, userId)
    expect(ns.updateNamespaceStats).toHaveBeenCalled()
  })

  it('rejects unauthenticated requests', async () => {
    const res = await app.request('http://localhost/rag/documents')
    expect(res.status).toBe(401)
  })
})

describe('query and namespace routes (unit)', () => {
  let app: ReturnType<typeof createApp>
  let userId: string
  let token: string

  beforeEach(async () => {
    app = createApp()
    userId = randomUUID()
    token = await signTestAccessToken({ userId, plan: 'pro' })
    ns.getNamespaceStats.mockResolvedValue({
      userId,
      pineconeNamespace: `user_${userId.replace(/-/g, '')}`,
      docCount: 2,
      totalChunks: 4,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    dbm.execute.mockResolvedValue({ rows: [{ id: userId }] })
    dbm.stats.mockResolvedValue([
      {
        totalDocuments: 0,
        indexedDocuments: 0,
        failedDocuments: 0,
        processingDocuments: 0,
        totalUsers: 0,
      },
    ])
  })

  it('POST /rag/query returns matches', async () => {
    const res = await app.request('http://localhost/rag/query', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: 'hello world' }),
    })
    expect(res.status).toBe(200)
    expect(pine.queryHybrid).toHaveBeenCalled()
  })

  it('POST /rag/query returns 422 on invalid body', async () => {
    const res = await app.request('http://localhost/rag/query', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(422)
  })

  it('GET /rag/namespace/stats returns db and pinecone', async () => {
    const res = await app.request('http://localhost/rag/namespace/stats', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
  })

  it('GET /rag/namespace returns usage payload', async () => {
    const res = await app.request('http://localhost/rag/namespace', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const j = (await res.json()) as { data: { namespace: string; docLimit: number } }
    expect(j.data.namespace).toContain('user_')
    expect(j.data.docLimit).toBeGreaterThan(0)
  })
})

describe('admin routes (unit)', () => {
  let app: ReturnType<typeof createApp>
  let token: string
  let userId: string

  beforeEach(async () => {
    vi.clearAllMocks()
    app = createApp()
    userId = randomUUID()
    token = await signTestAccessToken({
      userId,
      role: 'super_admin',
      plan: 'enterprise',
    })
    ns.getNamespaceStats.mockResolvedValue({
      userId,
      pineconeNamespace: `user_${userId.replace(/-/g, '')}`,
      docCount: 1,
      totalChunks: 10,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  })

  it('GET /rag/admin/stats returns platform stats payload', async () => {
    const res = await app.request('http://localhost/rag/admin/stats', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { data: { pineconeStatus: string } }
    expect(typeof json.data.pineconeStatus).toBe('string')
  })

  it('POST /rag/admin/reindex/:userId returns 202 for super_admin', async () => {
    const res = await app.request(`http://localhost/rag/admin/reindex/${userId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(202)
    expect(reindex.forceReindex).toHaveBeenCalledWith(userId)
  })

  it('POST /rag/admin/reindex/:userId blocks non-super-admin', async () => {
    const adminOnlyToken = await signTestAccessToken({
      userId: randomUUID(),
      role: 'admin',
      plan: 'enterprise',
    })
    const res = await app.request(`http://localhost/rag/admin/reindex/${userId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminOnlyToken}` },
    })
    expect(res.status).toBe(403)
  })
})
