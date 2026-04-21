export type AdminRole = 'admin' | 'super_admin'

export interface AdminUser {
  id: string
  email: string
  name: string
  role: AdminRole
  avatarUrl: string | null
  lastLoginAt: string | null
}

export type DateRangePreset = '7d' | '30d' | '90d' | '1y' | 'custom'

export interface DateRange {
  preset: DateRangePreset
  from: string
  to: string
}

export interface PlatformKPIs {
  totalUsers: number
  activeToday: number
  newThisWeek: number
  totalProjects: number
  totalRevenueCents: number
  avgSessionMinutes: number
  changes: {
    totalUsers: number
    activeToday: number
    newThisWeek: number
    totalProjects: number
    totalRevenue: number
    avgSession: number
  }
}

export interface RevenueDataPoint {
  month: string
  mrr: number
  newMrr: number
  churnedMrr: number
}

export interface UserGrowthDataPoint {
  week: string
  signups: number
  churned: number
}

export interface RecentSignup {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  plan: 'free' | 'pro' | 'team' | 'enterprise'
  signedUpAt: string
  status: 'active' | 'unverified' | 'suspended'
}

export interface ActivityEvent {
  id: string
  type:
    | 'user.signup'
    | 'user.upgrade'
    | 'user.suspend'
    | 'project.created'
    | 'project.launched'
    | 'payment.received'
    | 'payment.failed'
    | 'agent.run'
    | 'admin.action'
  actorName: string
  actorAvatarUrl: string | null
  description: string
  metadata: Record<string, unknown>
  occurredAt: string
}

export interface AdminAuthState {
  admin: AdminUser | null
  isAuthenticated: boolean
  isLoading: boolean

  setAdmin: (admin: AdminUser) => void
  clearAuth: () => void
  setLoading: (v: boolean) => void
}

export interface LoginStep {
  step: 'credentials' | 'totp' | 'locked'
  tempToken: string | null
  lockoutEndsAt: string | null
}

export interface AdminAPIResponse<T> {
  success: true
  data: T
  requestId: string
  timestamp: string
}

export interface AdminAPIError {
  success: false
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
    traceId: string
    service: string
  }
}

export type UserStatus = 'active' | 'suspended' | 'unverified'
export type UserPlan = 'free' | 'pro' | 'team' | 'enterprise'

export interface AdminUserRow {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  plan: UserPlan
  projectCount: number
  tokensUsedThisMonth: number
  joinedAt: string
  status: UserStatus
  lastActiveAt: string | null
}

export interface AdminUserDetail extends AdminUserRow {
  role: 'user' | 'admin'
  bio: string | null
  company: string | null
  website: string | null
  timezone: string
  onboardingDone: boolean
  totalTokensUsed: number
  agentRunsTotal: number
  agentRunsThisMonth: number
  createdAt: string
  updatedAt: string
  adminNotes?: string | null
  /** Per-user agent usage (when provided by API). */
  topAgentBreakdown?: AIAgentBreakdown[]
}

export interface AdminUserProject {
  id: string
  name: string
  emoji: string
  currentPhase: number
  status: 'active' | 'archived' | 'launched'
  buildMode: 'autopilot' | 'copilot' | 'manual'
  lastActiveAt: string
  createdAt: string
}

export interface AdminUserLoginEvent {
  id: string
  ip: string
  userAgent: string
  location: string | null
  success: boolean
  failureReason: string | null
  occurredAt: string
}

export interface AdminUserInvoice {
  id: string
  amountCents: number
  currency: string
  status: 'paid' | 'open' | 'void' | 'refunded'
  plan: UserPlan
  periodStart: string
  periodEnd: string
  invoiceUrl: string
  createdAt: string
}

export interface UserFilterParams {
  search: string
  plan: UserPlan | 'all'
  status: UserStatus | 'all'
  dateFrom: string
  dateTo: string
  page: number
  limit: number
  sortBy: 'name' | 'email' | 'joinedAt' | 'tokensUsed' | 'projectCount'
  sortOrder: 'asc' | 'desc'
}

export interface AdminRevenueSummary {
  mrrCents: number
  arrCents: number
  churnRate: number
  ltv: number
  changes: {
    mrr: number
    arr: number
    churnRate: number
    ltv: number
  }
}

export interface AdminPlan {
  id: string
  tier: string
  name: string
  priceMonthly: number
  priceYearly: number
  tokenLimit: number
  projectLimit: number
  features: string[]
  userCount: number
  monthlyRevenueCents: number
  stripePriceId: string | null
}

export interface AdminTransaction {
  id: string
  userId: string
  userName: string
  userEmail: string
  amountCents: number
  currency: string
  status: 'succeeded' | 'failed' | 'refunded' | 'pending'
  plan: string
  description: string | null
  refundedAmountCents: number
  invoicePdfUrl: string | null
  createdAt: string
}

export interface AdminCoupon {
  id: string
  code: string
  discountType: 'percent' | 'amount'
  discountValue: number
  maxUses: number | null
  usedCount: number
  expiresAt: string | null
  stripeCouponId: string | null
  createdAt: string
}

export interface AIUsageOverview {
  tokensToday: number
  tokensThisMonth: number
  projectedCostUsd: number
  costThisMonthUsd: number
  exhaustedUsersCount: number
}

export interface AITokenDataPoint {
  date: string
  tokens: number
  costUsd: number
}

export interface AIModelBreakdown {
  model: string
  requests: number
  tokens: number
  avgLatencyMs: number
  costUsd: number
  sharePercent: number
}

export interface AITopUser {
  userId: string
  userName: string
  userEmail: string
  plan: UserPlan
  tokensThisMonth: number
  tokenLimit: number
  percentOfLimit: number
  projectedOverage: number
}

export interface AIAgentBreakdown {
  agentType: string
  tokens: number
  requests: number
  avgTokensPerRun: number
  costUsd: number
}

export interface TokenLimitConfig {
  plan: UserPlan
  tokenLimit: number
  isUnlimited: boolean
}

export interface AdminProject {
  id: string
  name: string
  emoji: string
  userId: string
  userName: string
  userEmail: string
  currentPhase: number
  status: 'active' | 'archived' | 'launched' | 'deleted'
  buildMode: 'autopilot' | 'copilot' | 'manual'
  agentRunCount: number
  tokensUsed: number
  lastActiveAt: string
  createdAt: string
  /** Phase outputs for admin read-only view (optional). */
  phaseOutputs?: Record<string, unknown>
}

export interface AdminProjectFilterParams {
  search: string
  phase: number | 'all'
  status: AdminProject['status'] | 'all'
  buildMode: AdminProject['buildMode'] | 'all'
  page: number
  limit: number
  sortBy: 'lastActiveAt' | 'createdAt' | 'name' | 'tokensUsed'
  sortOrder: 'asc' | 'desc'
}

export type ServiceStatus = 'up' | 'degraded' | 'down'

export interface ServiceHealthCard {
  name: string
  status: ServiceStatus
  uptimePercent: number
  lastIncidentAt: string | null
  responseTimeMs: number
  endpoint: string
}

export interface ErrorLogEntry {
  id: string
  severity: 'error' | 'warning' | 'critical'
  type: string
  endpoint: string
  userId: string | null
  userEmail: string | null
  /** Full email for super-admin expanded view (optional). */
  userEmailUnmasked?: string | null
  message: string
  stack: string | null
  occurredAt: string
}

export interface LatencyDataPoint {
  time: string
  p50: number
  p95: number
  p99: number
}

export interface AuditLogEntry {
  id: string
  adminId: string
  adminEmail: string
  adminName: string
  action: string
  targetType: 'user' | 'project' | 'plan' | 'feature_flag' | 'prompt_template'
  targetId: string
  targetLabel: string
  beforeState: Record<string, unknown> | null
  afterState: Record<string, unknown> | null
  ipAddress: string
  userAgent: string
  createdAt: string
}

export interface AuditLogFilter {
  adminId: string | 'all'
  action: string | 'all'
  from: string
  to: string
  page: number
  limit: number
}

// ── Platform Settings ────────────────────────────────────────────────────────
export interface GeneralSettings {
  platformName: string
  supportEmail: string
  timezone: string
  maintenanceMode: boolean
  maintenanceMessage: string
  logoUrl: string | null
}

export interface EmailSettings {
  provider: 'resend' | 'sendgrid' | 'smtp'
  apiKey: string
  fromEmail: string
  fromName: string
  smtpHost?: string
  smtpPort?: number
  smtpUsername?: string
  smtpPassword?: string
}

export type EmailTemplateKey =
  | 'welcome'
  | 'reset_password'
  | 'billing_receipt'
  | 'phase_complete'
  | 'agent_done'
  | 'system_alert'

export interface EmailTemplatePreview {
  key: EmailTemplateKey
  subject: string
  previewText: string
}

export interface IntegrationKey {
  service: 'anthropic' | 'openai' | 'stripe' | 'github' | 'resend' | 'pinecone'
  label: string
  apiKey: string
  isSet: boolean
  lastValidatedAt: string | null
  validationStatus: 'valid' | 'invalid' | 'unchecked'
}

export interface FeatureFlag {
  id: string
  key: string
  description: string
  enabled: boolean
  rolloutPercent: number
  planRestriction: string[]
  updatedAt: string
}

export interface SecuritySettings {
  force2FAForAdmins: boolean
  sessionTimeoutMinutes: number
  ipAllowlist: string[]
  apiRateLimitPerMinute: number
  maxLoginAttempts: number
  lockoutDurationMinutes: number
}

export type SettingsTab =
  | 'general'
  | 'email'
  | 'integrations'
  | 'feature-flags'
  | 'security'
