import { z } from 'zod'

import type { AgentType } from '@repo/types'

// Exhaustive list (18 agents) — must be kept in sync with AgentType union in @repo/types
const agentTypeValues: [AgentType, ...AgentType[]] = [
  'idea_analyzer',
  'market_research',
  'validation_scorer',
  'prd_generator',
  'user_flow',
  'system_design',
  'uiux',
  'generate_frame',
  'skeleton',
  'schema_generator',
  'api_generator',
  'backend',
  'frontend',
  'integration',
  'testing',
  'cicd',
  'analytics',
  'feedback_analyzer',
  'growth_strategy',
]

export const StartAgentRunSchema = z.object({
  projectId: z.string().uuid(),
  phase: z.number().int().min(1).max(6),
  agentType: z.enum(agentTypeValues),
  model: z.enum(['claude-sonnet-4-5', 'claude-opus-4-5']).optional(),
  context: z.record(z.unknown()).optional(),
})

export const ChatMessageSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1),
      }),
    )
    .min(1),
  model: z.enum(['claude-sonnet-4-5', 'claude-opus-4-5']).optional(),
  maxTokens: z.number().int().max(8192).optional(),
})

export const IngestEventSchema = z.object({
  eventType: z.string().max(100),
  properties: z.record(z.unknown()).optional(),
  sessionId: z.string().optional(),
  projectId: z.string().uuid().optional(),
})

export const IngestEventBatchSchema = z.object({
  events: z.array(IngestEventSchema).min(1).max(100),
})

export const AdminKPIQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  granularity: z.enum(['day', 'week', 'month']),
})

export type StartAgentRunInput = z.infer<typeof StartAgentRunSchema>
export type ChatMessageInput = z.infer<typeof ChatMessageSchema>
export type IngestEventInput = z.infer<typeof IngestEventSchema>
