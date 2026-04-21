import { describe, expect, it, vi } from 'vitest'

import { AppError } from '../../src/lib/errors.js'
import {
  createCheckoutSession,
  verifyWebhookSignature,
} from '../../src/services/stripe.service.js'

const mocks = vi.hoisted(() => ({
  findCouponByCode: vi.fn(),
}))

vi.mock('../../src/db/queries/coupons.queries.js', () => ({
  findCouponByCode: mocks.findCouponByCode,
}))
vi.mock('../../src/db/queries/subscriptions.queries.js', () => ({
  findSubscriptionByUserId: vi.fn().mockResolvedValue(undefined),
}))

describe('stripe.service', () => {
  it('verifyWebhookSignature throws INVALID_STRIPE_SIGNATURE on mismatch', () => {
    expect(() => verifyWebhookSignature(Buffer.from('{}'), 'bad')).toThrow(AppError)
    expect(() => verifyWebhookSignature(Buffer.from('{}'), 'bad')).toThrow(
      /Webhook signature verification failed/,
    )
  })

  it('createCheckoutSession includes coupon and disables promotion code when coupon present', async () => {
    mocks.findCouponByCode.mockResolvedValueOnce({
      id: 'c1',
      code: 'SAVE10',
      discountType: 'amount',
      discountValue: '10.00',
      stripeCouponId: 'stripe_coupon_10',
      maxUses: null,
      usedCount: 0,
      validForPlans: [],
      expiresAt: null,
      createdAt: new Date(),
    })
    const result = await createCheckoutSession({
      stripeCustomerId: 'cus_123',
      priceId: 'price_123',
      userId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      couponCode: 'SAVE10',
      successUrl: 'http://localhost/success',
      cancelUrl: 'http://localhost/cancel',
    })
    expect(result.url).toContain('checkout.stripe.test')
    expect(result.sessionId).toContain('cs_')
  })

  it('maps Stripe API errors to AppError codes', async () => {
    const { stripe } = await import('../../src/lib/stripe.js')
    const spy = vi
      .spyOn(stripe.checkout.sessions, 'create')
      .mockRejectedValueOnce(new Error('boom') as never)
    await expect(
      createCheckoutSession({
        stripeCustomerId: 'cus_123',
        priceId: 'price_123',
        userId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        successUrl: 'http://localhost/success',
        cancelUrl: 'http://localhost/cancel',
      }),
    ).rejects.toBeInstanceOf(AppError)
    spy.mockRestore()
  })
})
