import api from '@/lib/axios'

export interface TokenBudget {
  tokensUsed: number
  tokensLimit: number
  tokensRemaining: number
  percentUsed: number
  planTier: string
  currentMonth: string
  resetAt: string
  isUnlimited: boolean
  warningThresholds: Array<{ percent: number; triggered: boolean }>
}

export interface Subscription {
  planTier: 'free' | 'pro' | 'team' | 'enterprise'
  status: 'active' | 'cancelled' | 'past_due' | 'trialing'
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  stripeCustomerId: string | null
}

export interface Invoice {
  id: string
  amount: number
  currency: string
  status: 'paid' | 'open' | 'void'
  periodStart: string
  periodEnd: string
  invoiceUrl: string
  createdAt: string
}

export interface Plan {
  tier: string
  name: string
  price: { monthly: number; yearly: number }
  tokenLimit: number
  projectLimit: number
  features: string[]
}

export async function getTokenBudget(): Promise<TokenBudget> {
  const res = await api.get<{ data: TokenBudget }>('/billing/token-usage')
  return res.data.data
}

export async function getSubscription(): Promise<Subscription> {
  const res = await api.get<{ data: Subscription }>('/billing/subscription')
  return res.data.data
}

export async function getInvoices(): Promise<Invoice[]> {
  const res = await api.get<{ data: Invoice[] }>('/billing/invoices')
  return res.data.data
}

export async function getPlans(): Promise<Plan[]> {
  const res = await api.get<{ data: Plan[] }>('/billing/plans')
  return res.data.data
}

export async function createCheckoutSession(payload: {
  planTier: string
  billingCycle: 'monthly' | 'yearly'
}): Promise<{ checkoutUrl: string }> {
  const res = await api.post<{ data: { checkoutUrl: string } }>('/billing/checkout', payload)
  return res.data.data
}

export async function createPortalSession(): Promise<{ portalUrl: string }> {
  const res = await api.post<{ data: { portalUrl: string } }>('/billing/portal', {})
  return res.data.data
}

export async function cancelSubscription(): Promise<void> {
  await api.delete('/billing/subscription')
}
