import { describe, expect, it, vi, beforeEach } from 'vitest'

import { AppError } from '../../src/lib/errors.js'
import {
  cancelSubscription,
  createFreeSubscription,
  getUserSubscription,
  initiateCheckout,
} from '../../src/services/subscription.service.js'

const m = vi.hoisted(() => ({
  findPlanByName: vi.fn(),
  findPlanById: vi.fn(),
  findSubscriptionByUserId: vi.fn(),
  upsertSubscription: vi.fn(),
  updateSubscriptionStatus: vi.fn(),
  getCurrentMonthUsage: vi.fn(),
  getOrCreateMonthlyUsage: vi.fn(),
  updateTokenLimit: vi.fn(),
  createOrRetrieveCustomer: vi.fn(),
  createCheckoutSession: vi.fn(),
  cancelSubscriptionAtPeriodEnd: vi.fn(),
  reactivateSubscription: vi.fn(),
  validateCoupon: vi.fn(),
}))

vi.mock('../../src/db/queries/plans.queries.js', () => ({
  findPlanByName: m.findPlanByName,
  findPlanById: m.findPlanById,
}))
vi.mock('../../src/db/queries/subscriptions.queries.js', () => ({
  findSubscriptionByUserId: m.findSubscriptionByUserId,
  upsertSubscription: m.upsertSubscription,
  updateSubscriptionStatus: m.updateSubscriptionStatus,
}))
vi.mock('../../src/db/queries/tokenUsage.queries.js', () => ({
  currentMonthDateString: () => '2026-04-01',
  getCurrentMonthUsage: m.getCurrentMonthUsage,
  getOrCreateMonthlyUsage: m.getOrCreateMonthlyUsage,
  updateTokenLimit: m.updateTokenLimit,
}))
vi.mock('../../src/services/stripe.service.js', () => ({
  createOrRetrieveCustomer: m.createOrRetrieveCustomer,
  createCheckoutSession: m.createCheckoutSession,
  cancelSubscriptionAtPeriodEnd: m.cancelSubscriptionAtPeriodEnd,
  reactivateSubscription: m.reactivateSubscription,
}))
vi.mock('../../src/services/coupon.service.js', () => ({
  validateCoupon: m.validateCoupon,
}))

describe('subscription.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.findPlanByName.mockResolvedValue({
      id: 'p_free',
      name: 'free',
      displayName: 'Free',
      tokenLimitMonthly: 50000,
      projectLimit: 3,
      apiKeyLimit: 2,
      features: [],
    })
    m.getCurrentMonthUsage.mockResolvedValue({
      tokensUsed: BigInt(100),
      tokensLimit: BigInt(50000),
    })
    m.getOrCreateMonthlyUsage.mockResolvedValue({
      tokensUsed: BigInt(100),
      tokensLimit: BigInt(50000),
    })
    m.createOrRetrieveCustomer.mockResolvedValue('cus_123')
    m.createCheckoutSession.mockResolvedValue({ url: 'https://checkout', sessionId: 'cs_123' })
  })

  it('createFreeSubscription creates customer and upserts row', async () => {
    await createFreeSubscription({
      userId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      email: 'u@test.local',
      name: 'U',
    })
    expect(m.createOrRetrieveCustomer).toHaveBeenCalled()
    expect(m.upsertSubscription).toHaveBeenCalled()
  })

  it('getUserSubscription returns free defaults when missing', async () => {
    m.findSubscriptionByUserId.mockResolvedValueOnce(undefined)
    const view = await getUserSubscription('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
    expect(view.plan).toBe('free')
  })

  it('getUserSubscription merges usage when subscription exists', async () => {
    m.findSubscriptionByUserId.mockResolvedValueOnce({
      id: 's1',
      userId: 'u',
      plan: {
        name: 'pro',
        displayName: 'Pro',
        tokenLimitMonthly: 500000,
        projectLimit: 20,
        apiKeyLimit: 10,
        features: [],
      },
      status: 'active',
      billingCycle: 'monthly',
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      cancelledAt: null,
      trialEnd: null,
      stripeCustomerId: 'cus_1',
      createdAt: new Date(),
    })
    const view = await getUserSubscription('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
    expect(view.plan).toBe('pro')
    expect(view.tokenUsage.used).toBe(100)
  })

  it('cancelSubscription throws for free plan', async () => {
    m.findSubscriptionByUserId.mockResolvedValueOnce(undefined)
    await expect(cancelSubscription('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).rejects.toMatchObject({
      code: 'NO_ACTIVE_PAID_SUBSCRIPTION',
    } satisfies Partial<AppError>)
  })

  it('cancelSubscription throws ALREADY_CANCELLING', async () => {
    m.findSubscriptionByUserId.mockResolvedValue({
      id: 'sub_1',
      stripeSubscriptionId: 'sub_1',
      plan: { name: 'pro' },
      cancelAtPeriodEnd: true,
    })
    await expect(cancelSubscription('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).rejects.toMatchObject({
      code: 'ALREADY_CANCELLING',
    } satisfies Partial<AppError>)
  })

  it('initiateCheckout throws ENTERPRISE_CONTACT_REQUIRED', async () => {
    m.findPlanByName.mockResolvedValueOnce({ id: 'p_ent', name: 'enterprise' })
    await expect(
      initiateCheckout({
        userId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        email: 'u@test.local',
        name: 'User',
        planName: 'enterprise',
        billingCycle: 'monthly',
        successUrl: 'http://localhost/s',
        cancelUrl: 'http://localhost/c',
      }),
    ).rejects.toMatchObject({ code: 'ENTERPRISE_CONTACT_REQUIRED' } satisfies Partial<AppError>)
  })

  it('initiateCheckout throws ALREADY_SUBSCRIBED for same plan', async () => {
    m.findPlanByName.mockResolvedValueOnce({ id: 'p_pro', name: 'pro' })
    m.findSubscriptionByUserId.mockResolvedValue({
      id: 's1',
      userId: 'u',
      plan: {
        name: 'pro',
        displayName: 'Pro',
        tokenLimitMonthly: 500000,
        projectLimit: 20,
        apiKeyLimit: 10,
        features: [],
      },
      status: 'active',
      billingCycle: 'monthly',
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      cancelledAt: null,
      trialEnd: null,
      stripeCustomerId: 'cus_1',
      createdAt: new Date(),
    })
    await expect(
      initiateCheckout({
        userId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        email: 'u@test.local',
        name: 'User',
        planName: 'pro',
        billingCycle: 'monthly',
        successUrl: 'http://localhost/s',
        cancelUrl: 'http://localhost/c',
      }),
    ).rejects.toMatchObject({ code: 'ALREADY_SUBSCRIBED' } satisfies Partial<AppError>)
  })
})
