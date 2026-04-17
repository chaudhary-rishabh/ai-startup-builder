export interface User {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  role: 'user' | 'admin' | 'super_admin'
  plan: 'free' | 'pro' | 'team' | 'enterprise'
  onboardingDone: boolean
}

export interface Project {
  id: string
  userId: string
  name: string
  description: string | null
  emoji: string
  currentPhase: number
  status: 'active' | 'archived' | 'launched'
  isStarred: boolean
  mode: 'design' | 'dev'
  buildMode: 'autopilot' | 'copilot' | 'manual'
  phaseProgress: Record<string, 'complete' | 'active' | 'locked'>
  lastActiveAt: string
  createdAt: string
}

export type BuildMode = 'autopilot' | 'copilot' | 'manual'

export interface Competitor {
  name: string
  keyFeatures: string
  price: string
  gap: string
}

export interface Phase1Output {
  ideaAnalysis?: {
    problemStatement: string
    solution: string
    icp: string
  }
  marketResearch?: {
    competitors: Competitor[]
    marketGap: string
    pricingSuggestion: string
  }
  validation?: {
    demandScore: number
    riskLevel: 'Low' | 'Medium' | 'High'
    verdict: 'Yes' | 'No' | 'Pivot'
    reasoning: string
  }
}

interface SSEEventBase {
  type: string
  runId: string
}

export interface SSETokenEvent extends SSEEventBase {
  type: 'token'
  token: string
}

export interface SSEDocModeEvent extends SSEEventBase {
  type: 'doc_mode'
  mode: 'direct' | 'compressed' | 'contextual_rag' | 'none'
  docCount: number
  tokenCount: number
}

export interface SSECrossCheckEvent extends SSEEventBase {
  type: 'cross_check'
  check: string
  passed: boolean
  issues: string[]
}

export interface SSEFileStartEvent extends SSEEventBase {
  type: 'file_start'
  path: string
  language: string
}

export interface SSEFileCompleteEvent extends SSEEventBase {
  type: 'file_complete'
  path: string
  size: number
}

export interface SSEBatchStartEvent extends SSEEventBase {
  type: 'batch_start'
  batchNumber: number
  totalBatches: number
  agentType: string
  fileCount: number
}

export interface SSEBatchCompleteEvent extends SSEEventBase {
  type: 'batch_complete'
  batchNumber: number
  filesGenerated: number
}

export interface SSERunStartEvent extends SSEEventBase {
  type: 'run_start'
  agentType: string
  phase: number
}

export interface SSERunCompleteEvent extends SSEEventBase {
  type: 'run_complete'
  tokensUsed: number
  durationMs: number
  output: Record<string, unknown>
}

export interface SSEErrorEvent extends SSEEventBase {
  type: 'error'
  code: string
  message: string
}

export interface SSETokenBudgetWarningEvent extends SSEEventBase {
  type: 'token.budget.warning'
  percentUsed: 80 | 95
  tokensUsed: number
  tokenLimit: number
}

export type SSEEvent =
  | SSETokenEvent
  | SSEDocModeEvent
  | SSECrossCheckEvent
  | SSEFileStartEvent
  | SSEFileCompleteEvent
  | SSEBatchStartEvent
  | SSEBatchCompleteEvent
  | SSERunStartEvent
  | SSERunCompleteEvent
  | SSEErrorEvent
  | SSETokenBudgetWarningEvent
