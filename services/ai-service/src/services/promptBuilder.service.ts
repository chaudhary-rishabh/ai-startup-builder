import type { AgentType, ProjectContext } from '@repo/types'

export type BuildMode = 'autopilot' | 'copilot' | 'manual'

export type UserPreferences = Record<string, unknown>

export interface GeneratedFile {
  path: string
  description?: string
  dependencies?: string[]
  contentPreview?: string
}

export interface PromptOptions {
  agentType: AgentType
  callType: 'skeleton' | 'generate' | 'patch' | 'single'
  context: ProjectContext
  currentFile?: { path: string; description?: string; dependencies?: string[] }
  priorFiles?: GeneratedFile[]
  documentContent: string
  docMode: string
  userPreferences: UserPreferences
  buildMode: BuildMode
}

export class PromptTooLargeError extends Error {
  constructor(message = 'Prompt exceeds model budget') {
    super(message)
    this.name = 'PromptTooLargeError'
  }
}

const GOLDEN_CONSTRAINT = `Return raw code only for the requested language.
No markdown code blocks. No \`\`\` wrapper. No backticks.
No explanation before the code. No explanation after the code.
Start with the FIRST import statement.
End with the LAST line of code.
NOTHING else.`

function buildModeInstruction(mode: BuildMode): string {
  if (mode === 'autopilot') return 'Generate production-ready complete output.'
  if (mode === 'copilot') return 'Generate output suitable for user review and refinement.'
  return 'Generate output — user will review each decision manually.'
}

export function buildContextBlock(
  context: ProjectContext,
  documentContent: string,
  userPreferences: UserPreferences,
  buildMode: BuildMode,
): string {
  const parts: string[] = []
  parts.push('[CONTEXT]')
  parts.push(`Project: ${context.projectName} (phase ${context.currentPhase})`)
  if (context.phase1Output) parts.push(`Phase 1 summary: ${JSON.stringify(context.phase1Output).slice(0, 4000)}`)
  if (context.phase2Output) parts.push(`Phase 2 summary: ${JSON.stringify(context.phase2Output).slice(0, 4000)}`)
  if (context.phase3Output) parts.push(`Phase 3 summary: ${JSON.stringify(context.phase3Output).slice(0, 2000)}`)
  if (Object.keys(userPreferences).length) {
    parts.push(`[USER_PREFERENCES]\n${JSON.stringify(userPreferences)}`)
  }
  if (documentContent.trim()) {
    parts.push(`[DOCUMENTS mode=${buildMode}]\n${documentContent}`)
  }
  parts.push(`[BUILD_MODE]\n${buildModeInstruction(buildMode)}`)
  return parts.join('\n\n')
}

export function buildPriorFilesBlock(priorFiles: GeneratedFile[]): string {
  if (!priorFiles.length) return ''
  return priorFiles
    .map((f) => {
      const dep = f.dependencies?.length ? ` deps: ${f.dependencies.join(', ')}` : ''
      const preview = (f.contentPreview ?? '').slice(0, 500)
      return `[FILE ${f.path}]${dep}\n${preview}`
    })
    .join('\n---\n')
}

export async function build(options: PromptOptions): Promise<{ system: string; user: string }> {
  const ctxBlock = buildContextBlock(
    options.context,
    options.documentContent,
    options.userPreferences,
    options.buildMode,
  )
  const prior = buildPriorFilesBlock(options.priorFiles ?? [])
  const system = `[ROLE]
You are the ${options.agentType} agent (${options.callType}).

[CONTEXT]
${ctxBlock}

[CONSTRAINTS]
${GOLDEN_CONSTRAINT}
`
  const userParts = [`[TASK]\nExecute ${options.callType} for agent ${options.agentType}.`]
  if (options.currentFile) {
    userParts.push(
      `[CURRENT_FILE]\npath=${options.currentFile.path}\n${options.currentFile.description ?? ''}`,
    )
  }
  if (prior) userParts.push(`[PRIOR_FILES]\n${prior}`)
  userParts.push(`[DOC_MODE]\n${options.docMode}`)
  return { system, user: userParts.join('\n\n') }
}

const MODEL_CONTEXT_LIMIT: Record<string, number> = {
  'claude-sonnet-4-5': 200_000,
  'claude-opus-4-5': 200_000,
  'claude-haiku-4-5': 200_000,
}

export function validatePrompt(system: string, user: string, model: string): void {
  const est = Math.ceil((system.length + user.length) / 4)
  const limit = MODEL_CONTEXT_LIMIT[model] ?? 200_000
  if (est > limit * 0.7) {
    throw new PromptTooLargeError()
  }
  if (!system.includes('[CONSTRAINTS]')) {
    console.warn('[promptBuilder] system prompt missing [CONSTRAINTS] marker')
  }
}
