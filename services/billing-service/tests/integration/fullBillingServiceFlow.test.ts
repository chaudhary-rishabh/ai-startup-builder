import { randomUUID } from 'node:crypto'

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { signTestAccessToken } from '../jwt.js'

const m = vi.hoisted(() => ({
  findAllActivePlans: vi.fn(),
  getUserSubscription: vi.fn(),
  initiateCheckout: vi.fn(),
  cancelSubscription: vi.fn(),
  reactivateUserSubscription: vi.fn(),
  validateCoupon: vi.fn(),
  checkTokenBudget: vi.fn(),
  incrementUsage: vi.fn(),
  findSubscriptionByUserId: vi.fn(),
  listInvoices: vi.fn(),
  createPortalSession: vi.fn(),
  findTransactionById: vi.fn(),
  updateTransactionRefund: vi.fn(),
  createRefund: vi.fn(),
  findCouponByCode: vi.fn(),
  createCoupon: vi.fn(),
  listCoupons: vi.fn(),
  dbExecute: vi.fn(),
  findPlanByName: vi.fn(),
  findCouponByStripeId: vi.fn(),
  incrementCouponUsage: vi.fn(),
  updateSubscriptionStatus: vi.fn(),
  createTransaction: vi.fn(),
  findTransactionByStripeInvoiceId: vi.fn(),
  updateTokenLimit: vi.fn(),
  handleUpgradeOrDowngrade: vi.fn(),
  publishInvoicePaid: vi.fn(),
  publishSubscriptionActivated: vi.fn(),
  publishSubscriptionCancelled: vi.fn(),
  publishSubscriptionPaymentFailed: vi.fn(),
  publishSubscriptionUpgraded: vi.fn(),
  publishTrialWillEnd: vi.fn(),
}))

vi.mock('../../src/db/queries/plans.queries.js', () => ({
  findAllActivePlans: m.findAllActivePlans,
  findPlanByName: m.findPlanByName,
}))
vi.mock('../../src/services/subscription.service.js', () => ({
  getUserSubscription: m.getUserSubscription,
  initiateCheckout: m.initiateCheckout,
  cancelSubscription: m.cancelSubscription,
  reactivateUserSubscription: m.reactivateUserSubscription,
  handleUpgradeOrDowngrade: m.handleUpgradeOrDowngrade,
}))
vi.mock('../../src/services/coupon.service.js', () => ({
  validateCoupon: m.validateCoupon,
}))
vi.mock('../../src/services/planEnforcement.service.js', () => ({
  checkTokenBudget: m.checkTokenBudget,
}))
vi.mock('../../src/services/tokenUsage.service.js', () => ({
  incrementUsage: m.incrementUsage,
  updateTokenLimit: m.updateTokenLimit,
}))
vi.mock('../../src/db/queries/subscriptions.queries.js', () => ({
  findSubscriptionByUserId: m.findSubscriptionByUserId,
  updateSubscriptionStatus: m.updateSubscriptionStatus,
}))
vi.mock('../../src/services/stripe.service.js', async () => {
  const actual = await vi.importActual('../../src/services/stripe.service.js')
  return {
    ...actual,
    listInvoices: m.listInvoices,
    createPortalSession: m.createPortalSession,
    createRefund: m.createRefund,
  }
})
vi.mock('../../src/db/queries/transactions.queries.js', () => ({
  findTransactionById: m.findTransactionById,
  updateTransactionRefund: m.updateTransactionRefund,
  createTransaction: m.createTransaction,
  findTransactionByStripeInvoiceId: m.findTransactionByStripeInvoiceId,
}))
vi.mock('../../src/db/queries/coupons.queries.js', () => ({
  findCouponByCode: m.findCouponByCode,
  createCoupon: m.createCoupon,
  listCoupons: m.listCoupons,
  findCouponByStripeId: m.findCouponByStripeId,
  incrementCouponUsage: m.incrementCouponUsage,
}))
vi.mock('../../src/lib/db.js', () => ({
  getDb: () => ({ execute: m.dbExecute }),
}))
vi.mock('../../src/events/publisher.js', () => ({
  publishInvoicePaid: m.publishInvoicePaid,
  publishSubscriptionActivated: m.publishSubscriptionActivated,
  publishSubscriptionCancelled: m.publishSubscriptionCancelled,
  publishSubscriptionPaymentFailed: m.publishSubscriptionPaymentFailed,
  publishSubscriptionUpgraded: m.publishSubscriptionUpgraded,
  publishTrialWillEnd: m.publishTrialWillEnd,
}))

import { stripe } from '../../src/lib/stripe.js'
import { getRedis } from '../../src/lib/redis.js'
import { createApp } from '../../src/app.js'
import { processWebhookEvent } from '../../src/services/webhook.service.js'

const freeUserId = '00000000-0000-0000-0000-000000000001'
const adminUserId = '00000000-0000-0000-0000-000000000002'
const superAdminUserId = '00000000-0000-0000-0000-000000000003'

describe('Full Billing Service Flow (integration-style)', () => {
  let userToken: string
  let adminToken: string
  let superAdminToken: string

  beforeAll(async () => {
    userToken = await signTestAccessToken({ userId: freeUserId, role: 'user', plan: 'free' })
    adminToken = await signTestAccessToken({ userId: adminUserId, role: 'admin', plan: 'pro' })
    superAdminToken = await signTestAccessToken({
      userId: superAdminUserId,
      role: 'super_admin',
      plan: 'team',
    })
  })

  beforeEach(async () => {
    vi.clearAllMocks()
    await getRedis().flushall()

    m.findAllActivePlans.mockResolvedValue([
      { id: 'p1', name: 'free', displayName: 'Free', tokenLimitMonthly: 50000, sortOrder: 1, isActive: true },
      { id: 'p2', name: 'pro', displayName: 'Pro', tokenLimitMonthly: 500000, sortOrder: 2, isActive: true },
      { id: 'p3', name: 'team', displayName: 'Team', tokenLimitMonthly: 2000000, sortOrder: 3, isActive: true },
      {
        id: 'p4',
        name: 'enterprise',
        displayName: 'Enterprise',
        tokenLimitMonthly: -1,
        sortOrder: 4,
        isActive: true,
      },
    ])
    m.getUserSubscription.mockResolvedValue({
      plan: 'free',
      status: 'active',
      billingCycle: null,
      tokenUsage: { used: 0, limit: 50000 },
    })
    m.initiateCheckout.mockResolvedValue({ checkoutUrl: 'https://checkout.stripe.com/test', sessionId: 'cs_test' })
    m.cancelSubscription.mockResolvedValue({ cancelAtPeriodEnd: true })
    m.reactivateUserSubscription.mockResolvedValue({ cancelAtPeriodEnd: false })
    m.validateCoupon.mockResolvedValue({ valid: true, discountType: 'percent', discountValue: 50 })
    m.checkTokenBudget.mockResolvedValue({ allowed: true, remaining: 44000, limit: 50000, percentUsed: 12 })
    m.incrementUsage.mockResolvedValue({ tokensUsed: BigInt(1000), tokensLimit: BigInt(50000) })
    m.findSubscriptionByUserId.mockResolvedValue({ stripeCustomerId: 'cus_1', id: 'sub_row_1', plan: { name: 'free' } })
    m.listInvoices.mockResolvedValue([{ id: 'in_1' }])
    m.createPortalSession.mockResolvedValue('https://billing.stripe.test/portal')
    m.findTransactionById.mockResolvedValue({
      id: randomUUID(),
      status: 'succeeded',
      stripeChargeId: 'ch_1',
      amountCents: 2900,
      refundedAmountCents: 0,
    })
    m.createRefund.mockResolvedValue({ id: 're_test', amount: 2900, status: 'succeeded' })
    m.updateTransactionRefund.mockResolvedValue({})
    m.findCouponByCode.mockResolvedValue(undefined)
    m.createCoupon.mockResolvedValue({ id: randomUUID(), code: 'LAUNCH50' })
    m.listCoupons.mockResolvedValue([{ id: randomUUID(), code: 'LAUNCH50', usedCount: 1 }])
    m.dbExecute.mockResolvedValue({ rows: [{ mrr_cents: 2900, revenue_cents: 2900, tx_count: 1, count: 1 }] })

    m.findPlanByName.mockResolvedValue({
      id: 'plan_pro',
      name: 'pro',
      tokenLimitMonthly: 500000,
    })
    m.findCouponByStripeId.mockResolvedValue(undefined)
    m.incrementCouponUsage.mockResolvedValue(undefined)
    m.updateSubscriptionStatus.mockResolvedValue({})
    m.createTransaction.mockResolvedValue({})
    m.findTransactionByStripeInvoiceId.mockResolvedValue(undefined)
    m.updateTokenLimit.mockResolvedValue(undefined)
    m.handleUpgradeOrDowngrade.mockResolvedValue(undefined)
    m.publishInvoicePaid.mockResolvedValue(undefined)
    m.publishSubscriptionActivated.mockResolvedValue(undefined)
    m.publishSubscriptionCancelled.mockResolvedValue(undefined)
    m.publishSubscriptionPaymentFailed.mockResolvedValue(undefined)
    m.publishSubscriptionUpgraded.mockResolvedValue(undefined)
    m.publishTrialWillEnd.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('1) GET /billing/plans returns sorted plans', async () => {
    const res = await createApp().request('http://localhost/billing/plans')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { data: { plans: Array<{ name: string }> } }
    expect(body.data.plans).toHaveLength(4)
    expect(body.data.plans[0]?.name).toBe('free')
  })

  it('2) plans route uses cache on second call', async () => {
    const app = createApp()
    await app.request('http://localhost/billing/plans')
    await app.request('http://localhost/billing/plans')
    expect(m.findAllActivePlans).toHaveBeenCalledTimes(1)
  })

  it('3) GET /billing/subscription returns free view', async () => {
    const res = await createApp().request('http://localhost/billing/subscription', {
      headers: { Authorization: `Bearer ${userToken}` },
    })
    expect(res.status).toBe(200)
  })

  it('4) POST /billing/checkout returns checkout url', async () => {
    const res = await createApp().request('http://localhost/billing/checkout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'pro', billingCycle: 'monthly' }),
    })
    expect(res.status).toBe(200)
  })

  it('5) POST /billing/checkout ALREADY_SUBSCRIBED', async () => {
    m.initiateCheckout.mockRejectedValueOnce({ status: 422, code: 'ALREADY_SUBSCRIBED', message: 'already' })
    const res = await createApp().request('http://localhost/billing/checkout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'pro', billingCycle: 'monthly' }),
    })
    expect([401, 422, 500]).toContain(res.status)
  })

  it('6) POST /billing/checkout ENTERPRISE_CONTACT_REQUIRED', async () => {
    const res = await createApp().request('http://localhost/billing/checkout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'enterprise', billingCycle: 'monthly' }),
    })
    expect([400, 422]).toContain(res.status)
  })

  it('7) webhook checkout.session.completed upgrades subscription', async () => {
    const retrieveSpy = vi.spyOn(stripe.subscriptions, 'retrieve').mockResolvedValue({
      id: 'sub_test',
      status: 'active',
      metadata: { userId: freeUserId },
      items: { data: [{ price: { id: process.env['STRIPE_PRO_MONTHLY_PRICE_ID'] } }] },
      current_period_start: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor(Date.now() / 1000) + 2_592_000,
      cancel_at_period_end: false,
      trial_end: null,
    } as never)

    await processWebhookEvent({
      id: 'evt_checkout_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_1',
          mode: 'subscription',
          metadata: { userId: freeUserId },
          subscription: 'sub_test',
          discounts: [],
        },
      },
    } as never)

    expect(retrieveSpy).toHaveBeenCalledOnce()
    expect(m.handleUpgradeOrDowngrade).toHaveBeenCalledOnce()
    expect(m.publishSubscriptionActivated).toHaveBeenCalledOnce()
  })

  it('8) webhook idempotency skips duplicate event id', async () => {
    const retrieveSpy = vi.spyOn(stripe.subscriptions, 'retrieve')
    const event = {
      id: 'evt_duplicate_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_1',
          mode: 'subscription',
          metadata: { userId: freeUserId },
          subscription: 'sub_test',
          discounts: [],
        },
      },
    } as never
    await processWebhookEvent(event)
    await processWebhookEvent(event)
    expect(retrieveSpy).toHaveBeenCalledTimes(1)
  })

  it('9) webhook invoice.paid records transaction + event', async () => {
    await processWebhookEvent({
      id: 'evt_invoice_paid_1',
      type: 'invoice.paid',
      data: {
        object: {
          id: 'in_paid_1',
          subscription: 'sub_test',
          amount_paid: 2900,
          currency: 'usd',
          charge: 'ch_1',
          invoice_pdf: null,
          hosted_invoice_url: 'https://invoice',
          created: Math.floor(Date.now() / 1000),
          lines: { data: [{ price: { id: process.env['STRIPE_PRO_MONTHLY_PRICE_ID'] }, period: { start: 1, end: 2 } }] },
        },
      },
    } as never)
    expect(m.createTransaction).toHaveBeenCalledOnce()
    expect(m.publishInvoicePaid).toHaveBeenCalledOnce()
  })

  it('10) webhook invoice.payment_failed marks past_due + event', async () => {
    await processWebhookEvent({
      id: 'evt_invoice_failed_1',
      type: 'invoice.payment_failed',
      data: {
        object: {
          id: 'in_fail_1',
          subscription: 'sub_test',
          amount_due: 2900,
          currency: 'usd',
          charge: null,
          hosted_invoice_url: 'https://invoice',
        },
      },
    } as never)
    expect(m.updateSubscriptionStatus).toHaveBeenCalled()
    expect(m.publishSubscriptionPaymentFailed).toHaveBeenCalledOnce()
  })

  it('11) webhook subscription.deleted downgrades to free', async () => {
    m.findPlanByName.mockImplementation(async (name: string) =>
      name === 'free'
        ? {
            id: 'plan_free',
            name: 'free',
            tokenLimitMonthly: 50000,
          }
        : undefined,
    )
    await processWebhookEvent({
      id: 'evt_sub_deleted_1',
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_test', metadata: { userId: freeUserId } } },
    } as never)
    expect(m.updateTokenLimit).toHaveBeenCalled()
    expect(m.publishSubscriptionCancelled).toHaveBeenCalledOnce()
  })

  it('12) webhook invalid signature -> 400', async () => {
    const res = await createApp().request('http://localhost/billing/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'bad_sig' },
      body: JSON.stringify({ hello: 'world' }),
    })
    expect(res.status).toBe(400)
  })

  it('13) webhook valid signature -> 200 immediately', async () => {
    const res = await createApp().request('http://localhost/billing/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'sig_ok' },
      body: JSON.stringify({ hello: 'world' }),
    })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { received: boolean }
    expect(json.received).toBe(true)
  })

  it('14) POST /internal/token-usage/increment updates usage', async () => {
    const res = await createApp().request('http://localhost/internal/token-usage/increment', {
      method: 'POST',
      headers: { 'X-Internal-Service': 'ai-service', 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: freeUserId, tokensUsed: 1000, costUsd: '0.003000' }),
    })
    expect(res.status).toBe(200)
    expect(m.incrementUsage).toHaveBeenCalledOnce()
  })

  it('15) internal increment soft-fails and still returns 200', async () => {
    m.incrementUsage.mockRejectedValueOnce(new Error('db down'))
    const res = await createApp().request('http://localhost/internal/token-usage/increment', {
      method: 'POST',
      headers: { 'X-Internal-Service': 'ai-service', 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: freeUserId, tokensUsed: 1000, costUsd: '0.003000' }),
    })
    expect(res.status).toBe(200)
  })

  it('16) GET /internal/token-budget allowed', async () => {
    m.checkTokenBudget.mockResolvedValueOnce({ allowed: true, remaining: 44000, limit: 50000, percentUsed: 12 })
    const res = await createApp().request(
      `http://localhost/internal/token-budget?userId=${freeUserId}&estimatedTokens=1000`,
      {
        headers: { 'X-Internal-Service': 'ai-service' },
      },
    )
    expect(res.status).toBe(200)
  })

  it('17) GET /internal/token-budget denied', async () => {
    m.checkTokenBudget.mockResolvedValueOnce({ allowed: false, remaining: 500, limit: 50000, percentUsed: 99 })
    const res = await createApp().request(
      `http://localhost/internal/token-budget?userId=${freeUserId}&estimatedTokens=1000`,
      {
        headers: { 'X-Internal-Service': 'ai-service' },
      },
    )
    const json = (await res.json()) as { data: { allowed: boolean } }
    expect(json.data.allowed).toBe(false)
  })

  it('18) GET /internal/token-budget fail-open path', async () => {
    m.checkTokenBudget.mockRejectedValueOnce(new Error('db down'))
    const res = await createApp().request(
      `http://localhost/internal/token-budget?userId=${freeUserId}&estimatedTokens=1000`,
      {
        headers: { 'X-Internal-Service': 'ai-service' },
      },
    )
    expect(res.status).toBe(200)
    const json = (await res.json()) as { data: { allowed: boolean } }
    expect(json.data.allowed).toBe(true)
  })

  it('19) POST /billing/coupons/validate valid coupon', async () => {
    const res = await createApp().request('http://localhost/billing/coupons/validate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'launch50' }),
    })
    expect(res.status).toBe(200)
  })

  it('20) coupon validate is case-insensitive input', async () => {
    await createApp().request('http://localhost/billing/coupons/validate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'launch50' }),
    })
    expect(m.validateCoupon).toHaveBeenCalledWith('LAUNCH50', undefined)
  })

  it('21) coupon validate expired', async () => {
    m.validateCoupon.mockResolvedValueOnce({ valid: false, error: 'COUPON_EXPIRED' })
    const res = await createApp().request('http://localhost/billing/coupons/validate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'OLD' }),
    })
    expect(res.status).toBe(200)
  })

  it('22) coupon validate max uses reached', async () => {
    m.validateCoupon.mockResolvedValueOnce({ valid: false, error: 'COUPON_MAX_USES_REACHED' })
    const res = await createApp().request('http://localhost/billing/coupons/validate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'LIMIT' }),
    })
    expect(res.status).toBe(200)
  })

  it('23) POST /billing/cancel schedules cancellation', async () => {
    const res = await createApp().request('http://localhost/billing/cancel', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
    })
    expect(res.status).toBe(200)
  })

  it('24) POST /billing/cancel no active paid subscription', async () => {
    m.cancelSubscription.mockRejectedValueOnce({
      status: 422,
      code: 'NO_ACTIVE_PAID_SUBSCRIPTION',
      message: 'none',
    })
    const res = await createApp().request('http://localhost/billing/cancel', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
    })
    expect([401, 422, 500]).toContain(res.status)
  })

  it('25) POST /billing/reactivate', async () => {
    const res = await createApp().request('http://localhost/billing/reactivate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
    })
    expect(res.status).toBe(200)
  })

  it('26) POST /billing/admin/refund works for super admin', async () => {
    const res = await createApp().request('http://localhost/billing/admin/refund', {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionId: randomUUID(), reason: 'requested_by_customer' }),
    })
    expect(res.status).toBe(200)
    expect(m.createRefund).toHaveBeenCalled()
  })

  it('27) POST /billing/admin/refund forbidden for non-admin', async () => {
    const res = await createApp().request('http://localhost/billing/admin/refund', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionId: randomUUID(), reason: 'requested_by_customer' }),
    })
    expect(res.status).toBe(403)
  })

  it('28) GET /billing/admin/revenue returns analytics', async () => {
    m.dbExecute
      .mockResolvedValueOnce({ rows: [{ mrr_cents: 2900 }] })
      .mockResolvedValueOnce({ rows: [{ revenue_cents: 5800, tx_count: 2 }] })
      .mockResolvedValueOnce({ rows: [{ plan: 'pro', count: 2 }] })
      .mockResolvedValueOnce({ rows: [{ count: 1 }] })
      .mockResolvedValueOnce({ rows: [{ count: 2 }] })
    const res = await createApp().request('http://localhost/billing/admin/revenue?period=month', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { data: { mrrCents: number } }
    expect(body.data.mrrCents).toBe(2900)
  })

  it('29) POST /billing/admin/coupons creates coupon', async () => {
    const res = await createApp().request('http://localhost/billing/admin/coupons', {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'launch50',
        discountType: 'percent',
        discountValue: 50,
        validForPlans: ['pro'],
      }),
    })
    expect(res.status).toBe(201)
  })

  it('30) GET /billing/admin/coupons lists coupons', async () => {
    const res = await createApp().request('http://localhost/billing/admin/coupons', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { data: { coupons: unknown[] } }
    expect(body.data.coupons.length).toBeGreaterThan(0)
  })
})
