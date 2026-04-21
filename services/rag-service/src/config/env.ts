import { z } from 'zod'

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4005),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_PUBLIC_KEY_BASE64: z.string().min(1),

  AWS_REGION: z.string().default('ap-south-1'),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),

  ANTHROPIC_API_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),

  PINECONE_API_KEY: z.string().min(1),
  PINECONE_INDEX_NAME: z.string().min(1),
  PINECONE_ENVIRONMENT: z.string().min(1),

  COHERE_API_KEY: z.string().min(1),

  MAX_FILE_SIZE_BYTES: z.coerce.number().default(20_971_520),
  MAX_DOCS_FREE_PLAN: z.coerce.number().default(5),
  MAX_DOCS_PRO_PLAN: z.coerce.number().default(50),
  MAX_DOCS_ENTERPRISE_PLAN: z.coerce.number().default(500),

  CHUNK_SIZE_TOKENS: z.coerce.number().default(512),
  CHUNK_OVERLAP_TOKENS: z.coerce.number().default(64),

  RETRIEVAL_TOP_K: z.coerce.number().default(20),
  RERANK_TOP_N: z.coerce.number().default(5),
  RERANK_MIN_SCORE: z.coerce.number().default(0.3),
  HYBRID_ALPHA: z.coerce.number().default(0.8),

  CONTEXT_ENRICHMENT_ENABLED: z
    .string()
    .optional()
    .transform((s) => {
      if (s === undefined || s === '') return true
      const v = s.trim().toLowerCase()
      if (['true', '1', 'yes', 'on'].includes(v)) return true
      if (['false', '0', 'no', 'off'].includes(v)) return false
      return true
    }),

  AI_SERVICE_URL: z.string().url().default('http://localhost:4004'),

  VECTOR_CACHE_TTL_SECONDS: z.coerce.number().default(1800),
})

const parsed = EnvSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('[rag-service] Invalid environment:', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
