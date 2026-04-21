import { describe, expect, it } from 'vitest'

import {
  getMaxOutputTokens,
  getRAGEligibleAgents,
  OPUS_AGENTS,
  selectModel,
  selectModelForContextGeneration,
} from '../../src/services/modelRouter.service.js'

describe('modelRouter', () => {
  it('maps prd_generator to opus', () => {
    expect(selectModel('prd_generator')).toBe('claude-opus-4-5')
  })

  it('maps idea_analyzer to sonnet', () => {
    expect(selectModel('idea_analyzer')).toBe('claude-sonnet-4-5')
  })

  it('uses opus for all OPUS_AGENTS', () => {
    for (const t of OPUS_AGENTS) {
      expect(selectModel(t)).toBe('claude-opus-4-5')
    }
  })

  it('selectModelForContextGeneration returns haiku', () => {
    expect(selectModelForContextGeneration()).toBe('claude-haiku-4-5')
  })

  it('getRAGEligibleAgents returns exactly four agents', () => {
    const agents = getRAGEligibleAgents()
    expect(agents).toHaveLength(4)
    expect(new Set(agents).size).toBe(4)
  })

  it('phase 4 agents are not RAG eligible', () => {
    const rag = new Set(getRAGEligibleAgents())
    expect(rag.has('backend')).toBe(false)
    expect(rag.has('frontend')).toBe(false)
  })

  it('getMaxOutputTokens for backend and frontend', () => {
    expect(getMaxOutputTokens('backend')).toBe(16_384)
    expect(getMaxOutputTokens('frontend')).toBe(16_384)
    expect(getMaxOutputTokens('prd_generator')).toBe(8192)
    expect(getMaxOutputTokens('uiux')).toBe(8192)
    expect(getMaxOutputTokens('testing')).toBe(8192)
    expect(getMaxOutputTokens('growth_strategy')).toBe(8192)
    expect(getMaxOutputTokens('idea_analyzer')).toBe(4096)
  })
})
