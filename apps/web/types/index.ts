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
  phase2Output?: Phase2Output
  copilotPreferences?: CopilotPreferences
}

export type BuildMode = 'autopilot' | 'copilot' | 'manual'

export interface CopilotPreferences {
  scale?: string
  platform?: string
  primaryColor?: string
  architecture?: string
  brandFeel?: string
}

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

export interface DesignTokens {
  primaryColor: string
  backgroundColor: string
  fontFamily: string
  borderRadius: string
  spacing: string
  accentColor?: string
}

export interface MoSCoWFeature {
  id: string
  name: string
  priority: 'Must' | 'Should' | 'Could' | 'Wont'
  description: string
  userStories?: UserStory[]
  acceptanceCriteria?: string[]
}

export interface UserStory {
  id: string
  role: string
  want: string
  soThat: string
  featureId?: string
}

export interface FlowStep {
  id: string
  type: 'action' | 'decision' | 'result' | 'start' | 'end'
  label: string
  nextSteps?: string[]
  isDropOffRisk?: boolean
}

export interface TechStackCard {
  category: 'frontend' | 'backend' | 'database' | 'auth' | 'infra'
  name: string
  reasoning: string
  docsUrl?: string
}

export interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  route: string
  description: string
}

export interface WireframeScreen {
  id: string
  name: string
  blocks: WireframeBlock[]
}

export interface WireframeBlock {
  type: 'nav' | 'hero' | 'content' | 'footer' | 'sidebar' | 'card' | 'form'
  label: string
  height?: number
  color?: string
}

export interface Phase2Output {
  prd?: {
    features: MoSCoWFeature[]
    userStories: UserStory[]
  }
  userFlow?: {
    flowSteps: FlowStep[]
    dropOffPoints: string[]
  }
  systemDesign?: {
    techStack: TechStackCard[]
    apiEndpoints: ApiEndpoint[]
    archDiagramText?: string
  }
  uiux?: {
    wireframes: WireframeScreen[]
    designSystem: DesignTokens
    componentList: string[]
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

export interface ProjectFile {
  id: string
  projectId: string
  path: string
  content: string
  language: string
  agentType: string
  isModified: boolean
  createdAt: string
  updatedAt: string
}

export interface FileTreeNode {
  type: 'file' | 'folder'
  name: string
  path: string
  language?: string
  agentType?: string
  isModified?: boolean
  isStreaming?: boolean
  children?: FileTreeNode[]
}

export interface GenerationPlan {
  totalFiles: number
  totalBatches: number
  estimatedMs: number
  fileList: string[]
  agentBreakdown: {
    agentType: string
    fileCount: number
  }[]
}

export interface TerminalLine {
  id: string
  type: 'info' | 'success' | 'error' | 'system' | 'output'
  content: string
  timestamp: Date
}

export interface EditorTab {
  path: string
  language: string
  isModified: boolean
  isDirty: boolean
}
