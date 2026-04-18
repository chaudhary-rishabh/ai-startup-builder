import {
  bigint,
  boolean,
  date,
  decimal,
  index,
  integer,
  pgEnum,
  pgSchema,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const billingSchema = pgSchema('billing')

export const subStatusEnum = pgEnum('sub_status_enum', [
  'active',
  'past_due',
  'cancelled',
  'trialing',
  'paused',
])
export const txStatusEnum = pgEnum('tx_status_enum', ['succeeded', 'failed', 'refunded', 'pending'])

export const plans = billingSchema.table(
  'plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 50 }).notNull(),
    displayName: varchar('display_name', { length: 100 }).notNull(),
    priceMonthlyCents: integer('price_monthly_cents').notNull().default(0),
    priceYearlyCents: integer('price_yearly_cents').notNull().default(0),
    stripePriceMonthlyId: varchar('stripe_price_monthly_id', { length: 100 }),
    stripePriceYearlyId: varchar('stripe_price_yearly_id', { length: 100 }),
    stripeProductId: varchar('stripe_product_id', { length: 100 }),
    tokenLimitMonthly: bigint('token_limit_monthly', { mode: 'number' }).notNull(),
    projectLimit: integer('project_limit').notNull().default(3),
    apiKeyLimit: integer('api_key_limit').notNull().default(2),
    features: text('features').array().notNull().default([]),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: smallint('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    nameIdx: uniqueIndex('billing_plans_name_idx').on(t.name),
    activeIdx: index('billing_plans_active_idx').on(t.isActive),
  }),
)

export const subscriptions = billingSchema.table(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    planId: uuid('plan_id').notNull(),
    stripeCustomerId: varchar('stripe_customer_id', { length: 100 }).notNull(),
    stripeSubscriptionId: varchar('stripe_subscription_id', { length: 100 }),
    status: subStatusEnum('status').notNull(),
    billingCycle: varchar('billing_cycle', { length: 10 }),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    trialEnd: timestamp('trial_end', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userUnique: uniqueIndex('billing_subscriptions_user_id_uniq').on(t.userId),
    customerUnique: uniqueIndex('billing_subscriptions_customer_id_uniq').on(t.stripeCustomerId),
    stripeSubUnique: uniqueIndex('billing_subscriptions_stripe_sub_id_uniq').on(t.stripeSubscriptionId),
    expiryIdx: index('billing_subscriptions_status_period_idx').on(t.status, t.currentPeriodEnd),
  }),
)

export const transactions = billingSchema.table(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    subscriptionId: uuid('subscription_id'),
    stripeInvoiceId: varchar('stripe_invoice_id', { length: 100 }),
    stripeChargeId: varchar('stripe_charge_id', { length: 100 }),
    stripeEventId: varchar('stripe_event_id', { length: 100 }),
    amountCents: integer('amount_cents').notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('usd'),
    status: txStatusEnum('status').notNull(),
    description: text('description'),
    refundedAmountCents: integer('refunded_amount_cents').notNull().default(0),
    refundedAt: timestamp('refunded_at', { withTimezone: true }),
    invoicePdfUrl: text('invoice_pdf_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    invoiceUnique: uniqueIndex('billing_transactions_invoice_id_uniq').on(t.stripeInvoiceId),
    eventIdx: index('billing_transactions_event_id_idx').on(t.stripeEventId),
    userCreatedIdx: index('billing_transactions_user_created_idx').on(t.userId, t.createdAt),
  }),
)

export const coupons = billingSchema.table(
  'coupons',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 50 }).notNull(),
    discountType: varchar('discount_type', { length: 10 }).notNull(),
    discountValue: decimal('discount_value', { precision: 10, scale: 2 }).notNull(),
    maxUses: integer('max_uses'),
    usedCount: integer('used_count').notNull().default(0),
    validForPlans: text('valid_for_plans').array().notNull().default([]),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    stripeCouponId: varchar('stripe_coupon_id', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    codeUnique: uniqueIndex('billing_coupons_code_uniq').on(t.code),
  }),
)

export const tokenUsage = billingSchema.table(
  'token_usage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    month: date('month').notNull(),
    tokensUsed: bigint('tokens_used', { mode: 'bigint' }).notNull().default(sql`0`),
    tokensLimit: bigint('tokens_limit', { mode: 'bigint' }).notNull(),
    costUsd: decimal('cost_usd', { precision: 10, scale: 4 }).notNull().default('0.0000'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex('billing_token_usage_user_month_uniq').on(t.userId, t.month),
    userMonthIdx: index('billing_token_usage_user_month_idx').on(t.userId, t.month),
  }),
)

export type Plan = typeof plans.$inferSelect
export type NewPlan = typeof plans.$inferInsert
export type Subscription = typeof subscriptions.$inferSelect
export type NewSubscription = typeof subscriptions.$inferInsert
export type Transaction = typeof transactions.$inferSelect
export type NewTransaction = typeof transactions.$inferInsert
export type Coupon = typeof coupons.$inferSelect
export type NewCoupon = typeof coupons.$inferInsert
export type TokenUsage = typeof tokenUsage.$inferSelect
export type NewTokenUsage = typeof tokenUsage.$inferInsert
