import type { AgentModel, AgentType } from '@repo/types'

export const OPUS_AGENTS: AgentType[] = [
  'prd_generator',
  'uiux',
  'schema_generator',
  'api_generator',
  'backend',
  'frontend',
  'growth_strategy',
]

const opusSet = new Set<string>(OPUS_AGENTS)

export function selectModel(agentType: AgentType): AgentModel {
  if (opusSet.has(agentType)) return 'claude-opus-4-5'
  return 'claude-sonnet-4-5'
}

export function selectModelForContextGeneration(): 'claude-haiku-4-5' {
  return 'claude-haiku-4-5'
}

export const TOKEN_COSTS_PER_1K: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-5': { input: 0.003, output: 0.015 },
  'claude-opus-4-5': { input: 0.015, output: 0.075 },
  'claude-haiku-4-5': { input: 0.00025, output: 0.00125 },
}

export function estimateCost(model: string, promptTokens: number, completionTokens: number): string {
  const rates = TOKEN_COSTS_PER_1K[model] ?? TOKEN_COSTS_PER_1K['claude-sonnet-4-5']!
  const usd =
    (promptTokens / 1000) * rates.input + (completionTokens / 1000) * rates.output
  return usd.toFixed(6)
}

export function getMaxOutputTokens(agentType: AgentType): number {
  if (agentType === 'backend' || agentType === 'frontend') return 16_384
  if (agentType === 'integration') return 4096
  if (agentType === 'schema_generator') return 8192
  if (agentType === 'api_generator') return 6144
  if (agentType === 'skeleton') return 4096
  if (
    agentType === 'prd_generator' ||
    agentType === 'uiux' ||
    agentType === 'testing' ||
    agentType === 'growth_strategy'
  ) {
    return 8192
  }
  return 4096
}

export function getRAGEligibleAgents(): AgentType[] {
  return ['market_research', 'prd_generator', 'feedback_analyzer', 'growth_strategy']
}
