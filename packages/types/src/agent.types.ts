import type { CanvasElement, CanvasPage } from './project.types.js'

export type AgentModel = 'claude-sonnet-4-5' | 'claude-opus-4-5'

// All 18 agent types across 6 phases — must stay in sync with AgentType in validators
export type AgentType =
  // Phase 1 — Discovery & Validation
  | 'idea_analyzer'
  | 'market_research'
  | 'validation_scorer'
  // Phase 2 — Product & Design Planning
  | 'prd_generator'
  | 'user_flow'
  | 'system_design'
  | 'uiux'
  // Phase 3 — Design Mode
  | 'generate_frame'
  // Phase 4 — Build (Dev Mode)
  | 'skeleton'
  | 'schema_generator'
  | 'api_generator'
  | 'backend'
  | 'frontend'
  | 'integration'
  // Phase 5 — Testing & Deployment
  | 'testing'
  | 'cicd'
  // Phase 6 — Launch & Growth
  | 'analytics'
  | 'feedback_analyzer'
  | 'growth_strategy'

export type AgentStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface AgentRun {
  id: string
  projectId: string
  userId: string
  phase: number
  agentType: AgentType
  model: AgentModel
  status: AgentStatus
  promptTokens: number | null
  completionTokens: number | null
  totalTokens: number | null
  costUsd: string | null
  durationMs: number | null
  errorMessage: string | null
  ragContextUsed: boolean
  startedAt: string | null
  completedAt: string | null
  createdAt: string
}

export interface AgentInput {
  projectId: string
  userId: string
  phase: number
  agentType: AgentType
  userMessage?: string
  context: ProjectContext
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
}

export interface AgentOutput {
  output: Record<string, unknown>
  rawText: string
}

export interface ProjectContext {
  projectId: string
  projectName: string
  /** Current project phase (1–6) — included for agent routing. */
  currentPhase: number
  /** True when context was trimmed to stay under the token budget. */
  wasCompressed?: boolean
  phase1Output?: Phase1Output
  phase2Output?: Phase2Output
  phase3Output?: Phase3Output
  phase4Output?: Phase4Output
  phase5Output?: Phase5Output
  /** Phase 6 growth outputs (merged JSON from analytics, feedback, strategy agents). */
  phase6Output?: Record<string, unknown>
  ragContext?: string
}

// ─── Phase-specific structured outputs ───────────────────────────────────────

export interface Phase1Output {
  problem: string
  solution: string
  icp: string
  competitors: Array<{
    name: string
    features: string
    pricing: string
    weakness: string
  }>
  marketGap: string
  pricingSuggest: string
  demandScore: number
  risks: Array<{
    description: string
    severity: 'high' | 'medium' | 'low'
  }>
  verdict: 'yes' | 'no' | 'pivot'
}

export interface Phase2Output {
  features: Array<{
    name: string
    priority: 'must' | 'should' | 'could' | 'wont'
    description: string
  }>
  userStories: Array<{
    role: string
    want: string
    soThat: string
    acceptance: string[]
  }>
  flowSteps: Array<{
    id: string
    label: string
    type: 'action' | 'decision' | 'result'
  }>
  frontendStack: string
  backendStack: string
  dbChoice: string
  authPlan: string
  wireframes: Array<{ screenName: string; elements: CanvasElement[] }>
  designSystem: Record<string, unknown>
  componentList: string[]
}

export interface Phase3Output {
  canvasData: CanvasElement[]
  pages: CanvasPage[]
}

export interface Phase4Output {
  files: Array<{
    path: string
    content: string
    language: string
    agentType: AgentType
  }>
}

export interface Phase5Output {
  testFiles: Array<{ path: string; content: string }>
  cicdYaml: string
  deployConfig: Record<string, unknown>
}
