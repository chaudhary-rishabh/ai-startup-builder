import { z } from 'zod'

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4006),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_PUBLIC_KEY_BASE64: z.string().min(1),

  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
  STRIPE_FREE_PRICE_ID: z.string().optional(),
  STRIPE_PRO_MONTHLY_PRICE_ID: z.string().min(1),
  STRIPE_PRO_YEARLY_PRICE_ID: z.string().min(1),
  STRIPE_TEAM_MONTHLY_PRICE_ID: z.string().min(1),
  STRIPE_TEAM_YEARLY_PRICE_ID: z.string().min(1),

  APP_URL: z.string().url().default('http://localhost:3000'),

  TOKEN_WARNING_THRESHOLD_1: z.coerce.number().default(80),
  TOKEN_WARNING_THRESHOLD_2: z.coerce.number().default(95),

  PLANS_CACHE_TTL: z.coerce.number().default(300),
  SUBSCRIPTION_CACHE_TTL: z.coerce.number().default(60),
  TOKEN_BUDGET_CACHE_TTL: z.coerce.number().default(10),

  WEBHOOK_IDEMPOTENCY_TTL: z.coerce.number().default(86400),
})

const parsed = EnvSchema.safeParse(process.env)
if (!parsed.success) {
  console.error('[billing-service] Invalid environment:', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
