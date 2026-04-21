import api from '@/lib/axios'
import type { TokenBudget } from '@/types'

export type { TokenBudget }

export interface Subscription {
  planTier: 'free' | 'starter' | 'pro' | 'team' | 'enterprise'
  status: 'active' | 'cancelled' | 'past_due' | 'trialing'
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  razorpayCustomerId: string | null
}

export interface Invoice {
  id: string
  amountPaid: number
  currency: string
  status: string
  pdfUrl: string | null
  hostedInvoiceUrl: string | null
  createdAt: string
}

export interface Plan {
  tier: string
  name: string
  priceMonthlyPaise: number
  priceYearlyPaise: number
  tokenLimit: number
  projectLimit: number
  features: string[]
}

export interface RazorpayCheckoutData {
  subscriptionId: string
  razorpayKeyId: string
  name: string
  description: string
  prefill: { email: string; name: string }
}

interface SubscriptionRaw {
  plan: string
  status: string
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  razorpayCustomerId: string | null
}

export async function getTokenBudget(): Promise<TokenBudget> {
  const res = await api.get<{ data: TokenBudget }>('/billing/token-budget')
  return res.data.data
}

export async function getSubscription(): Promise<Subscription> {
  const res = await api.get<{ data: SubscriptionRaw }>('/billing/subscription')
  const raw = res.data.data
  return {
    planTier: raw.plan as Subscription['planTier'],
    status: raw.status as Subscription['status'],
    currentPeriodEnd: raw.currentPeriodEnd ?? new Date().toISOString(),
    cancelAtPeriodEnd: raw.cancelAtPeriodEnd,
    razorpayCustomerId: raw.razorpayCustomerId,
  }
}

export async function getInvoices(): Promise<Invoice[]> {
  const res = await api.get<{ data: { invoices: Invoice[] } }>('/billing/invoices')
  return res.data.data.invoices
}

export async function getPlans(): Promise<Plan[]> {
  const res = await api.get<{ data: { plans: PlanRow[] } }>('/billing/plans')
  const rows = res.data.data.plans
  return rows.map((p) => ({
    tier: p.name,
    name: p.displayName,
    priceMonthlyPaise: p.priceMonthlyPaise,
    priceYearlyPaise: p.priceYearlyPaise,
    tokenLimit: p.tokenLimitMonthly,
    projectLimit: p.projectLimit,
    features: p.features,
  }))
}

interface PlanRow {
  name: string
  displayName: string
  priceMonthlyPaise: number
  priceYearlyPaise: number
  tokenLimitMonthly: number
  projectLimit: number
  features: string[]
}

export async function createCheckoutSession(payload: {
  plan: 'starter' | 'pro' | 'team'
  billingCycle: 'monthly' | 'yearly'
  couponCode?: string
}): Promise<{ checkoutData: RazorpayCheckoutData }> {
  const res = await api.post<{ data: { checkoutData: RazorpayCheckoutData } }>('/billing/checkout', payload)
  return res.data.data
}

export async function createTopUpOrder(packName: string): Promise<{
  orderId: string
  amountPaise: number
  tokenGrant: number
  razorpayKeyId: string
}> {
  const res = await api.post<{
    data: { orderId: string; amountPaise: number; tokenGrant: number; razorpayKeyId: string }
  }>('/billing/topup/order', { packName })
  return res.data.data
}

export async function verifyTopUp(payload: {
  razorpayOrderId: string
  razorpayPaymentId: string
  razorpaySignature: string
}): Promise<{ success: boolean; tokensGranted: number; newBonusTotal: number }> {
  const res = await api.post<{ data: { success: boolean; tokensGranted: number; newBonusTotal: number } }>(
    '/billing/topup/verify',
    payload,
  )
  return res.data.data
}

export async function cancelSubscription(): Promise<void> {
  await api.post('/billing/cancel')
}
