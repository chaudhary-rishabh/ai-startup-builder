import { describe, expect, it, vi, beforeEach } from 'vitest'

import { AppError } from '../../src/lib/errors.js'

const m = vi.hoisted(() => ({
  updateDocumentStatus: vi.fn(),
  publishIndexed: vi.fn(),
  publishFailed: vi.fn(),
  downloadFromS3: vi.fn(),
  uploadToS3: vi.fn(),
  extractText: vi.fn(),
  splitIntoChunks: vi.fn(),
  enrichChunks: vi.fn(),
  embedTexts: vi.fn(),
  fitAndEncode: vi.fn(),
  pineconeNamespaceForUser: vi.fn(),
  updateNamespaceStats: vi.fn(),
  upsertVectors: vi.fn(),
}))

vi.mock('../../src/db/queries/ragDocuments.queries.js', () => ({
  updateDocumentStatus: m.updateDocumentStatus,
}))

vi.mock('../../src/db/queries/ragNamespaces.queries.js', () => ({
  pineconeNamespaceForUser: m.pineconeNamespaceForUser,
  updateNamespaceStats: m.updateNamespaceStats,
}))

vi.mock('../../src/events/publisher.js', () => ({
  publishDocumentIndexed: m.publishIndexed,
  publishDocumentIndexingFailed: m.publishFailed,
}))

vi.mock('../../src/lib/s3.js', () => ({
  downloadFromS3: m.downloadFromS3,
  uploadToS3: m.uploadToS3,
}))

vi.mock('../../src/services/extractor.service.js', () => ({
  extractText: m.extractText,
}))

vi.mock('../../src/services/chunker.service.js', () => ({
  splitIntoChunks: m.splitIntoChunks,
}))

vi.mock('../../src/services/contextEnrichment.service.js', () => ({
  enrichChunks: m.enrichChunks,
}))

vi.mock('../../src/services/embedder.service.js', () => ({
  embedTexts: m.embedTexts,
}))

vi.mock('../../src/services/bm25Encoder.service.js', () => ({
  createBm25EncoderForDocument: () => ({ fitAndEncode: m.fitAndEncode }),
}))

vi.mock('../../src/services/pinecone.service.js', () => ({
  pineconeService: { upsertVectors: m.upsertVectors },
}))

describe('classifyIngestError', () => {
  it('maps known AppError codes to friendly messages', async () => {
    const { classifyIngestError } = await import('../../src/services/ingest.service.js')
    const cases: [string, string][] = [
      ['EXTRACTION_EMPTY', 'Document appears to be empty or image-only.'],
      ['EXTRACTION_FAILED', 'Failed to read document contents.'],
      ['UNSUPPORTED_FILE_TYPE', 'File type not supported.'],
      ['EMBEDDING_RATE_LIMIT', 'Embedding service rate limited. Will retry.'],
      ['EMBEDDING_SERVICE_UNAVAILABLE', 'Embedding service unavailable. Will retry.'],
      ['PINECONE_UNAVAILABLE', 'Vector storage unavailable. Will retry.'],
      ['CHUNKING_FAILED', 'Document could not be split into chunks.'],
    ]
    for (const [code, msg] of cases) {
      expect(classifyIngestError(new AppError(code, 'x', 400))).toBe(msg)
    }
    expect(classifyIngestError(new AppError('OTHER', 'raw', 400))).toBe('raw')
    expect(classifyIngestError(new Error('oops'))).toBe(
      'An unexpected error occurred during document processing.',
    )
  })
})

describe('runIngestionPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.updateDocumentStatus.mockResolvedValue(undefined)
    m.publishIndexed.mockResolvedValue(undefined)
    m.publishFailed.mockResolvedValue(undefined)
    m.downloadFromS3.mockResolvedValue(Buffer.from('x'))
    m.uploadToS3.mockResolvedValue(undefined)
    m.extractText.mockResolvedValue({
      text: 'word '.repeat(400),
      wordCount: 400,
      extractedAt: new Date(),
    })
    m.splitIntoChunks.mockReturnValue({
      chunks: [{ text: 'a', chunkIndex: 0, tokenCount: 1, charStart: 0, charEnd: 1 }],
      totalTokens: 1,
      chunkCount: 1,
    })
    m.enrichChunks.mockResolvedValue({
      enrichedChunks: [
        {
          originalText: 'a',
          contextualPrefix: '',
          enrichedText: 'a',
          chunkIndex: 0,
          tokenCount: 1,
        },
      ],
      totalContextTokens: 0,
      cacheHits: 0,
      cacheMisses: 0,
      costUsd: '0',
    })
    m.embedTexts.mockResolvedValue({
      embeddings: [new Array(3072).fill(0.01)],
      model: 'text-embedding-3-large',
      totalTokens: 1,
    })
    m.fitAndEncode.mockResolvedValue([{ indices: [1], values: [0.5] }])
    m.pineconeNamespaceForUser.mockReturnValue('user_uid')
    m.updateNamespaceStats.mockResolvedValue(undefined)
    m.upsertVectors.mockResolvedValue(undefined)
  })

  it('runs full pipeline on success', async () => {
    const { runIngestionPipeline } = await import('../../src/services/ingest.service.js')
    await runIngestionPipeline({
      docId: 'd1',
      userId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      s3Key: 'k',
      filename: 'f.pdf',
      fileType: 'pdf',
      contentHash: 'h',
    })
    expect(m.updateDocumentStatus).toHaveBeenCalledWith('d1', { status: 'processing' })
    expect(m.uploadToS3).toHaveBeenCalled()
    expect(m.upsertVectors).toHaveBeenCalled()
    expect(m.updateDocumentStatus).toHaveBeenCalledWith(
      'd1',
      expect.objectContaining({ status: 'indexed', chunkCount: 1 }),
    )
    expect(m.publishIndexed).toHaveBeenCalled()
  })

  it('marks failed and publishes on error', async () => {
    m.extractText.mockRejectedValueOnce(new AppError('EXTRACTION_EMPTY', 'empty', 422))
    const { runIngestionPipeline } = await import('../../src/services/ingest.service.js')
    await expect(
      runIngestionPipeline({
        docId: 'd2',
        userId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        s3Key: 'k',
        filename: 'f.pdf',
        fileType: 'pdf',
        contentHash: 'h',
      }),
    ).rejects.toMatchObject({ code: 'EXTRACTION_EMPTY' })
    expect(m.updateDocumentStatus).toHaveBeenCalledWith(
      'd2',
      expect.objectContaining({ status: 'failed' }),
    )
    expect(m.publishFailed).toHaveBeenCalled()
  })

  it('fails when chunking produces zero chunks', async () => {
    m.splitIntoChunks.mockReturnValueOnce({ chunks: [], totalTokens: 0, chunkCount: 0 })
    const { runIngestionPipeline } = await import('../../src/services/ingest.service.js')
    await expect(
      runIngestionPipeline({
        docId: 'd3',
        userId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        s3Key: 'k',
        filename: 'f.txt',
        fileType: 'txt',
        contentHash: 'h',
      }),
    ).rejects.toMatchObject({ code: 'CHUNKING_FAILED' })
  })
})
