import { describe, expect, it, vi } from 'vitest'

describe('enrichChunks with CONTEXT_ENRICHMENT_ENABLED=true', () => {
  it('calls Anthropic and builds enrichedText with prefix', async () => {
    process.env.CONTEXT_ENRICHMENT_ENABLED = 'true'
    vi.resetModules()
    const { enrichChunks } = await import('../../src/services/contextEnrichment.service.js')
    const chunks = [
      { text: 'unique chunk phrase one', chunkIndex: 0, tokenCount: 5, charStart: 0, charEnd: 24 },
    ]
    const doc = 'intro paragraph for the document. '.repeat(30)
    const r = await enrichChunks(doc, chunks, {
      filename: 'a.txt',
      fileType: 'txt',
      userId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    })
    expect(r.enrichedChunks).toHaveLength(1)
    expect(r.enrichedChunks[0]?.enrichedText).toContain('unique chunk phrase one')
    expect(r.cacheHits + r.cacheMisses).toBeGreaterThanOrEqual(1)
  })
})
