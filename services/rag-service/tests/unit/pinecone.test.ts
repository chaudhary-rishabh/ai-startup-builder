import { describe, expect, it, vi } from 'vitest'

import { PineconeService, scaleVector, chunkArray } from '../../src/services/pinecone.service.js'

describe('pinecone helpers', () => {
  it('scaleVector', () => {
    expect(scaleVector([1, 2, 3], 0.5)).toEqual([0.5, 1, 1.5])
  })

  it('chunkArray', () => {
    expect(chunkArray([1, 2, 3, 4], 2)).toEqual([
      [1, 2],
      [3, 4],
    ])
  })
})

describe('PineconeService', () => {
  it('queryHybrid returns empty on mocked index', async () => {
    const svc = new PineconeService()
    const r = await svc.queryHybrid({
      namespace: 'user_test',
      vector: new Array(3072).fill(0.01),
      topK: 5,
    })
    expect(Array.isArray(r)).toBe(true)
  })
})
