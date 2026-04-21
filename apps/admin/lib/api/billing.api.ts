import api from '@/lib/axios'
import type { AdminCoupon, AdminPlan, AdminRevenueSummary, AdminTransaction } from '@/types'
import { unwrap } from '@/lib/api/envelope'

export async function getRevenueSummary(
  from: string,
  to: string,
): Promise<AdminRevenueSummary> {
  const body: unknown = await api.get('/admin/billing/summary', {
    params: { from, to },
  })
  return unwrap<AdminRevenueSummary>(body)
}

export async function getAdminPlans(): Promise<AdminPlan[]> {
  const body: unknown = await api.get('/admin/billing/plans')
  return unwrap<AdminPlan[]>(body)
}

export async function updatePlan(
  planId: string,
  payload: {
    name?: string
    priceMonthly?: number
    priceYearly?: number
    tokenLimit?: number
    projectLimit?: number
    features?: string[]
  },
): Promise<AdminPlan> {
  const body: unknown = await api.patch(`/admin/billing/plans/${planId}`, payload)
  return unwrap<AdminPlan>(body)
}

export interface PaginatedTransactions {
  transactions: AdminTransaction[]
  total: number
  page: number
  totalPages: number
}

export async function listTransactions(params: {
  status?: string
  userId?: string
  page?: number
  limit?: number
}): Promise<PaginatedTransactions> {
  const body: unknown = await api.get('/admin/billing/transactions', {
    params,
  })
  return unwrap<PaginatedTransactions>(body)
}

export async function issueRefund(
  transactionId: string,
  amountCents: number,
  reason: string,
): Promise<void> {
  const body: unknown = await api.post(
    `/admin/billing/transactions/${transactionId}/refund`,
    { amountCents, reason },
  )
  unwrap<Record<string, never>>(body)
}

export async function exportTransactions(): Promise<void> {
  const res = (await api.get('/admin/billing/transactions/export', {
    responseType: 'blob',
  })) as Blob | string
  const blob =
    typeof res === 'string'
      ? new Blob([res], { type: 'text/csv;charset=utf-8' })
      : res
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export async function listCoupons(): Promise<AdminCoupon[]> {
  const body: unknown = await api.get('/admin/billing/coupons')
  return unwrap<AdminCoupon[]>(body)
}

export async function createCoupon(payload: {
  code: string
  discountType: 'percent' | 'amount'
  discountValue: number
  maxUses: number | null
  expiresAt: string | null
}): Promise<AdminCoupon> {
  const body: unknown = await api.post('/admin/billing/coupons', payload)
  return unwrap<AdminCoupon>(body)
}

export async function deleteCoupon(couponId: string): Promise<void> {
  await api.delete(`/admin/billing/coupons/${couponId}`)
}
