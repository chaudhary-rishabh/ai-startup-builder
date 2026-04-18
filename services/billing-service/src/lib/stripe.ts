import Stripe from 'stripe'

import { env } from '../config/env.js'
import { AppError } from './errors.js'

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
  typescript: true,
  maxNetworkRetries: 3,
  timeout: 10000,
})

export function getPriceId(planName: string, cycle: 'monthly' | 'yearly'): string {
  const plan = planName.toLowerCase()
  if (plan === 'free') {
    throw new AppError('NO_PRICE_FOR_FREE_PLAN', 'Free plan has no Stripe price.', 422)
  }
  if (plan === 'enterprise') {
    throw new AppError(
      'ENTERPRISE_CONTACT_REQUIRED',
      'Enterprise plan requires sales contact.',
      422,
    )
  }
  if (plan === 'pro') {
    return cycle === 'monthly'
      ? env.STRIPE_PRO_MONTHLY_PRICE_ID
      : env.STRIPE_PRO_YEARLY_PRICE_ID
  }
  if (plan === 'team') {
    return cycle === 'monthly'
      ? env.STRIPE_TEAM_MONTHLY_PRICE_ID
      : env.STRIPE_TEAM_YEARLY_PRICE_ID
  }
  throw new AppError('PLAN_NOT_SUPPORTED', `Unsupported plan: ${planName}`, 422)
}
