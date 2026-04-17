import { z } from 'zod'

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),

  // Auth — RS256 public key encoded in base64 for safe env transport
  JWT_PUBLIC_KEY_BASE64: z.string().min(1, 'JWT_PUBLIC_KEY_BASE64 is required'),

  // Infrastructure
  REDIS_URL: z.string().url('REDIS_URL must be a valid URL'),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Upstream service URLs (default to localhost for local dev)
  AUTH_SERVICE_URL: z.string().url().default('http://localhost:4001'),
  USER_SERVICE_URL: z.string().url().default('http://localhost:4002'),
  PROJECT_SERVICE_URL: z.string().url().default('http://localhost:4003'),
  AI_SERVICE_URL: z.string().url().default('http://localhost:4004'),
  RAG_SERVICE_URL: z.string().url().default('http://localhost:4005'),
  BILLING_SERVICE_URL: z.string().url().default('http://localhost:4006'),
  NOTIFICATION_SERVICE_URL: z.string().url().default('http://localhost:4007'),
  ANALYTICS_SERVICE_URL: z.string().url().default('http://localhost:4008'),

  // CORS — comma-separated list of allowed origins
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://localhost:3002'),
})

const parsed = EnvSchema.safeParse(process.env)

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  ${i.path.join('.')}: ${i.message}`)
    .join('\n')
  throw new Error(`[api-gateway] Environment validation failed:\n${issues}`)
}

/** Validated, typed environment — import this everywhere instead of process.env */
export const env = parsed.data

export type Env = typeof env
