import { describe, expect, it } from 'vitest'

import {
  build,
  buildContextBlock,
  buildPriorFilesBlock,
  PromptTooLargeError,
  validatePrompt,
} from '../../src/services/promptBuilder.service.js'

describe('promptBuilder.service', () => {
  it('buildContextBlock includes user_documents content when provided', () => {
    const block = buildContextBlock(
      { projectId: 'p', projectName: 'N', currentPhase: 1 },
      '<user_documents>x</user_documents>',
      { q: 1 },
      'copilot',
    )
    expect(block).toContain('<user_documents>')
  })

  it('buildPriorFilesBlock truncates previews', () => {
    const s = buildPriorFilesBlock([
      { path: 'a.ts', contentPreview: 'x'.repeat(600), dependencies: ['b'] },
    ])
    expect(s.length).toBeLessThan(700)
    expect(s).toContain('a.ts')
  })

  it('build returns system with CONSTRAINTS', async () => {
    const { system } = await build({
      agentType: 'backend',
      callType: 'generate',
      context: { projectId: 'p', projectName: 'N', currentPhase: 4 },
      documentContent: '',
      docMode: 'none',
      userPreferences: {},
      buildMode: 'autopilot',
    })
    expect(system).toContain('[CONSTRAINTS]')
  })

  it('validatePrompt throws when prompt too large', () => {
    const huge = 'x'.repeat(500_000)
    expect(() => validatePrompt(huge, huge, 'claude-sonnet-4-5')).toThrow(PromptTooLargeError)
  })
})
