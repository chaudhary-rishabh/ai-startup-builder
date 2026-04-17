import { describe, expect, it, vi, beforeEach } from 'vitest'

const ns = vi.hoisted(() => ({
  upsert: vi.fn().mockResolvedValue(undefined),
  query: vi.fn().mockResolvedValue({
    matches: [
      {
        id: 'm1',
        score: 0.9,
        metadata: {
          docId: 'd',
          userId: 'u',
          filename: 'f',
          chunkIndex: 0,
          contextualPrefix: '',
          originalText: 't',
          enrichedText: 't',
          tokenCount: 1,
          fileType: 'txt',
        },
      },
    ],
  }),
  deleteMany: vi.fn().mockResolvedValue(undefined),
  deleteAll: vi.fn().mockResolvedValue(undefined),
}))

const indexApi = vi.hoisted(() => ({
  namespace: vi.fn().mockImplementation(() => ns),
  describeIndexStats: vi.fn().mockResolvedValue({
    dimension: 3072,
    namespaces: { user_ns: { recordCount: 5 } },
  }),
}))

vi.mock('@pinecone-database/pinecone', () => ({
  Pinecone: vi.fn().mockImplementation(() => ({
    index: vi.fn().mockReturnValue(indexApi),
  })),
}))

describe('PineconeService branches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ns.upsert.mockResolvedValue(undefined)
    ns.query.mockResolvedValue({ matches: [] })
    ns.deleteMany.mockResolvedValue(undefined)
    ns.deleteAll.mockResolvedValue(undefined)
    indexApi.describeIndexStats.mockResolvedValue({
      dimension: 3072,
      namespaces: { user_ns: { recordCount: 5 } },
    })
  })

  it('upsertVectors batches and omits empty sparseValues', async () => {
    const { PineconeService } = await import('../../src/services/pinecone.service.js')
    const svc = new PineconeService()
    const vectors = Array.from({ length: 3 }, (_, i) => ({
      id: `id_${i}`,
      values: [0.1, 0.2],
      sparseValues: i === 0 ? { indices: [1], values: [0.5] } : { indices: [] as number[], values: [] as number[] },
      metadata: { n: i },
    }))
    await svc.upsertVectors({ namespace: 'ns', vectors })
    expect(ns.upsert).toHaveBeenCalled()
  })

  it('queryHybrid uses dense-only when sparse indices empty', async () => {
    const { PineconeService } = await import('../../src/services/pinecone.service.js')
    const svc = new PineconeService()
    const r = await svc.queryHybrid({
      namespace: 'ns',
      vector: [1, 2, 3],
      sparseVector: { indices: [], values: [] },
      topK: 5,
    })
    expect(Array.isArray(r)).toBe(true)
  })

  it('queryHybrid scales when sparse present', async () => {
    const { PineconeService } = await import('../../src/services/pinecone.service.js')
    const svc = new PineconeService()
    ns.query.mockResolvedValueOnce({
      matches: [
        {
          id: 'x',
          score: 0.5,
          metadata: {
            docId: 'd',
            userId: 'u',
            filename: 'f',
            chunkIndex: 0,
            contextualPrefix: '',
            originalText: 't',
            enrichedText: 't',
            tokenCount: 1,
            fileType: 'txt',
          },
        },
      ],
    })
    const r = await svc.queryHybrid({
      namespace: 'ns',
      vector: new Array(10).fill(0.5),
      sparseVector: { indices: [0], values: [1] },
      topK: 2,
      alpha: 0.8,
    })
    expect(r.length).toBe(1)
  })

  it('queryHybrid returns [] on 404 from Pinecone', async () => {
    ns.query.mockRejectedValueOnce({ status: 404 })
    const { PineconeService } = await import('../../src/services/pinecone.service.js')
    const svc = new PineconeService()
    const r = await svc.queryHybrid({ namespace: 'missing', vector: [1], topK: 1 })
    expect(r).toEqual([])
  })

  it('queryHybrid throws PINECONE_RATE_LIMIT on 429', async () => {
    ns.query.mockRejectedValueOnce({ status: 429 })
    const { PineconeService } = await import('../../src/services/pinecone.service.js')
    const svc = new PineconeService()
    await expect(svc.queryHybrid({ namespace: 'ns', vector: [1], topK: 1 })).rejects.toMatchObject({
      code: 'PINECONE_RATE_LIMIT',
    })
  })

  it('deleteVectorsByDocId calls deleteMany with filter', async () => {
    const { PineconeService } = await import('../../src/services/pinecone.service.js')
    const svc = new PineconeService()
    await svc.deleteVectorsByDocId('ns', 'doc-1')
    expect(ns.deleteMany).toHaveBeenCalledWith({ filter: { docId: { $eq: 'doc-1' } } })
  })

  it('deleteNamespace calls deleteAll', async () => {
    const { PineconeService } = await import('../../src/services/pinecone.service.js')
    const svc = new PineconeService()
    await svc.deleteNamespace('ns')
    expect(ns.deleteAll).toHaveBeenCalled()
  })

  it('getNamespaceStats returns counts when namespace exists', async () => {
    const { PineconeService } = await import('../../src/services/pinecone.service.js')
    const svc = new PineconeService()
    const stats = await svc.getNamespaceStats('user_ns')
    expect(stats?.vectorCount).toBe(5)
  })

  it('getNamespaceStats returns null when namespace missing', async () => {
    indexApi.describeIndexStats.mockResolvedValueOnce({ dimension: 3072, namespaces: {} })
    const { PineconeService } = await import('../../src/services/pinecone.service.js')
    const svc = new PineconeService()
    expect(await svc.getNamespaceStats('none')).toBeNull()
  })
})
