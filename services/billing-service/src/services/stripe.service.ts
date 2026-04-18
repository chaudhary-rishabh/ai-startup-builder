import Stripe from 'stripe'

import { findCouponByCode } from '../db/queries/coupons.queries.js'
import { findSubscriptionByUserId } from '../db/queries/subscriptions.queries.js'
import { env } from '../config/env.js'
import { AppError } from '../lib/errors.js'
import { stripe } from '../lib/stripe.js'

export interface CreateCustomerInput {
  userId: string
  email: string
  name: string
}

export interface CreateCheckoutInput {
  stripeCustomerId: string
  priceId: string
  userId: string
  couponCode?: string
  successUrl: string
  cancelUrl: string
}

function mapStripeError(error: unknown): AppError {
  const e = error as { message?: string; type?: string; statusCode?: number; raw?: { statusCode?: number } }
  const message = e.message ?? (error instanceof Error ? error.message : 'Stripe error')
  const statusCode = e.statusCode ?? e.raw?.statusCode
  if (e.type === 'StripeCardError') return new AppError('PAYMENT_FAILED', message, 402, { statusCode })
  if (e.type === 'StripeInvalidRequestError') return new AppError('STRIPE_INVALID_REQUEST', message, 400, { statusCode })
  if (e.type === 'StripeAPIError') return new AppError('STRIPE_API_UNAVAILABLE', message, 502, { statusCode })
  if (e.type === 'StripeConnectionError') return new AppError('STRIPE_CONNECTION_ERROR', message, 503, { statusCode })
  if (e.type === 'StripeRateLimitError') return new AppError('STRIPE_RATE_LIMIT', message, 429, { statusCode })
  return new AppError('STRIPE_ERROR', message, 502, { statusCode })
}

export async function createOrRetrieveCustomer(input: CreateCustomerInput): Promise<string> {
  try {
    const existingSub = await findSubscriptionByUserId(input.userId)
    const existingId = existingSub?.stripeCustomerId
    if (existingId) {
      try {
        const customer = await stripe.customers.retrieve(existingId)
        if (!('deleted' in customer && customer.deleted)) return existingId
      } catch {
        // create new below
      }
    }

    const customer = await stripe.customers.create({
      email: input.email,
      name: input.name,
      metadata: {
        userId: input.userId,
        environment: env.NODE_ENV,
      },
    })
    return customer.id
  } catch (error) {
    throw mapStripeError(error)
  }
}

export async function createCheckoutSession(
  input: CreateCheckoutInput,
): Promise<{ url: string; sessionId: string }> {
  try {
    let discounts: Stripe.Checkout.SessionCreateParams.Discount[] = []

    if (input.couponCode) {
      const coupon = await findCouponByCode(input.couponCode)
      if (coupon?.stripeCouponId) {
        discounts = [{ coupon: coupon.stripeCouponId }]
      } else if (coupon) {
        const stripeCoupon = await stripe.coupons.create({
          id: `coupon_${coupon.id}`,
          ...(coupon.discountType === 'percent'
            ? { percent_off: Number(coupon.discountValue) }
            : { amount_off: Math.round(Number(coupon.discountValue) * 100), currency: 'usd' }),
          duration: 'once',
          name: coupon.code,
        })
        discounts = [{ coupon: stripeCoupon.id }]
      }
    }

    const session = await stripe.checkout.sessions.create({
      customer: input.stripeCustomerId,
      mode: 'subscription',
      line_items: [{ price: input.priceId, quantity: 1 }],
      discounts,
      success_url: `${input.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: input.cancelUrl,
      allow_promotion_codes: !input.couponCode,
      billing_address_collection: 'auto',
      customer_update: { address: 'auto', name: 'auto' },
      subscription_data: {
        metadata: { userId: input.userId },
        trial_settings: { end_behavior: { missing_payment_method: 'pause' } },
      },
      metadata: { userId: input.userId },
    })
    return { url: session.url ?? '', sessionId: session.id }
  } catch (error) {
    throw mapStripeError(error)
  }
}

export async function createPortalSession(
  stripeCustomerId: string,
  returnUrl: string,
): Promise<string> {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    })
    return session.url
  } catch (error) {
    throw mapStripeError(error)
  }
}

export async function cancelSubscriptionAtPeriodEnd(
  stripeSubscriptionId: string,
): Promise<Stripe.Subscription> {
  try {
    return await stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: true,
    })
  } catch (error) {
    throw mapStripeError(error)
  }
}

export async function reactivateSubscription(
  stripeSubscriptionId: string,
): Promise<Stripe.Subscription> {
  try {
    return await stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: false,
    })
  } catch (error) {
    throw mapStripeError(error)
  }
}

export async function listInvoices(
  stripeCustomerId: string,
  limit = 10,
): Promise<Stripe.Invoice[]> {
  try {
    const invoices = await stripe.invoices.list({
      customer: stripeCustomerId,
      limit,
      expand: ['data.charge'],
    })
    return invoices.data
  } catch (error) {
    throw mapStripeError(error)
  }
}

export async function createRefund(data: {
  stripeChargeId: string
  amountCents?: number
  reason: Stripe.RefundCreateParams.Reason
}): Promise<Stripe.Refund> {
  try {
    const payload: Stripe.RefundCreateParams = {
      charge: data.stripeChargeId,
      reason: data.reason,
    }
    if (data.amountCents !== undefined) payload.amount = data.amountCents
    return await stripe.refunds.create(payload)
  } catch (error) {
    throw mapStripeError(error)
  }
}

export function verifyWebhookSignature(payload: Buffer, signature: string): Stripe.Event {
  try {
    return stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET)
  } catch {
    throw new AppError(
      'INVALID_STRIPE_SIGNATURE',
      'Webhook signature verification failed.',
      400,
    )
  }
}
