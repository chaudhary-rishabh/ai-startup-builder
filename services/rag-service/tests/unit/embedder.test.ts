import { describe, expect, it, vi } from 'vitest'

describe('embedTexts', () => {
  it('returns empty for empty input', async () => {
    const { embedTexts } = await import('../../src/services/embedder.service.js')
    const r = await embedTexts([])
    expect(r.embeddings).toEqual([])
    expect(r.totalTokens).toBe(0)
  })

  it('returns single embedding', async () => {
    const { embedSingleText } = await import('../../src/services/embedder.service.js')
    const v = await embedSingleText('hello')
    expect(v.length).toBe(3072)
  })
})
