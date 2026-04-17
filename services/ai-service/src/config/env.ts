import { z } from 'zod'

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4004),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_PUBLIC_KEY_BASE64: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  COHERE_API_KEY: z.string().min(1),
  PROJECT_SERVICE_URL: z.string().url().default('http://localhost:4003'),
  BILLING_SERVICE_URL: z.string().url().default('http://localhost:4006'),
  RAG_SERVICE_URL: z.string().url().default('http://localhost:4005'),
  AGENT_CONCURRENCY_FREE: z.coerce.number().default(1),
  AGENT_CONCURRENCY_PRO: z.coerce.number().default(3),
  AGENT_CONCURRENCY_ENTERPRISE: z.coerce.number().default(10),
  TOKEN_WARNING_THRESHOLD_1: z.coerce.number().default(80),
  TOKEN_WARNING_THRESHOLD_2: z.coerce.number().default(95),
  DOC_DIRECT_INJECT_MAX_TOKENS: z.coerce.number().default(80_000),
  DOC_COMPRESSION_THRESHOLD: z.coerce.number().default(30_000),
  RAG_TOP_K_RETRIEVE: z.coerce.number().default(20),
  RAG_TOP_K_INJECT: z.coerce.number().default(5),
  RAG_RERANK_MIN_SCORE: z.coerce.number().default(0.3),
  PROMPT_CACHE_TTL: z.enum(['5m', '1h']).default('5m'),
})

const parsed = EnvSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid ai-service environment:', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
