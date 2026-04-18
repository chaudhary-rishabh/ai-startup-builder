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
