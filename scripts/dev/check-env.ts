import { join } from 'node:path'

import chalk from 'chalk'
import { config as loadEnv } from 'dotenv'
import { z } from 'zod'

import { getRepoRoot } from '../lib/repoRoot.js'

const ALL_SERVICES_REQUIRED = [
  'NODE_ENV',
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_PRIVATE_KEY_BASE64',
  'JWT_PUBLIC_KEY_BASE64',
] as const

const AUTH_SERVICE_REQUIRED = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'] as const
const AI_SERVICE_REQUIRED = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY'] as const
const RAG_SERVICE_REQUIRED = ['PINECONE_API_KEY', 'PINECONE_INDEX_NAME', 'PINECONE_ENVIRONMENT'] as const
const BILLING_SERVICE_REQUIRED = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'] as const
const NOTIFICATION_SERVICE_REQUIRED = ['RESEND_API_KEY'] as const
const AWS_REQUIRED = ['AWS_REGION', 'AWS_S3_BUCKET_UPLOADS', 'AWS_S3_BUCKET_EXPORTS'] as const
const FRONTEND_REQUIRED = ['NEXT_PUBLIC_API_URL', 'NEXT_PUBLIC_APP_URL'] as const

const DESCRIPTIONS: Record<string, string> = {
  NODE_ENV: 'Node environment (development | test | production)',
  DATABASE_URL: 'PostgreSQL connection string for the platform database',
  REDIS_URL: 'Redis connection URL for cache, rate limits, and queues',
  JWT_PRIVATE_KEY_BASE64: 'Base64-encoded PKCS#8 PEM for RS256 JWT signing (auth-service)',
  JWT_PUBLIC_KEY_BASE64: 'Base64-encoded SPKI PEM for RS256 JWT verification (gateway / services)',
  GOOGLE_CLIENT_ID: 'Google OAuth 2.0 client ID',
  GOOGLE_CLIENT_SECRET: 'Google OAuth 2.0 client secret',
  ANTHROPIC_API_KEY: 'Anthropic API key for Claude models',
  OPENAI_API_KEY: 'OpenAI API key for embeddings / optional models',
  PINECONE_API_KEY: 'Pinecone API key for vector storage',
  PINECONE_INDEX_NAME: 'Pinecone index name for RAG',
  PINECONE_ENVIRONMENT: 'Pinecone environment / region identifier',
  STRIPE_SECRET_KEY: 'Stripe secret key for billing API',
  STRIPE_WEBHOOK_SECRET: 'Stripe webhook signing secret',
  RESEND_API_KEY: 'Resend API key for transactional email',
  AWS_REGION: 'AWS region for S3 and other services',
  AWS_S3_BUCKET_UPLOADS: 'S3 bucket for user uploads',
  AWS_S3_BUCKET_EXPORTS: 'S3 bucket for project exports',
  NEXT_PUBLIC_API_URL: 'Public URL of the API (browser)',
  NEXT_PUBLIC_APP_URL: 'Public URL of the web app',
}

const ServiceSchema = z.enum([
  'all',
  'auth',
  'ai',
  'rag',
  'billing',
  'notification',
  'aws',
  'frontend',
])

function parseServiceFlag(): z.infer<typeof ServiceSchema> {
  const idx = process.argv.indexOf('--service')
  if (idx === -1 || idx === process.argv.length - 1) return 'all'
  const raw = process.argv[idx + 1]
  const parsed = ServiceSchema.safeParse(raw)
  if (!parsed.success) {
    console.error(chalk.red(`Invalid --service value. Use: ${ServiceSchema.options.join(', ')}`))
    process.exit(1)
  }
  return parsed.data
}

function varsForService(service: z.infer<typeof ServiceSchema>): readonly string[] {
  const base = [...ALL_SERVICES_REQUIRED]
  if (service === 'all') {
    return [
      ...base,
      ...AUTH_SERVICE_REQUIRED,
      ...AI_SERVICE_REQUIRED,
      ...RAG_SERVICE_REQUIRED,
      ...BILLING_SERVICE_REQUIRED,
      ...NOTIFICATION_SERVICE_REQUIRED,
      ...AWS_REQUIRED,
      ...FRONTEND_REQUIRED,
    ]
  }
  const extra: Record<Exclude<typeof service, 'all'>, readonly string[]> = {
    auth: AUTH_SERVICE_REQUIRED,
    ai: AI_SERVICE_REQUIRED,
    rag: RAG_SERVICE_REQUIRED,
    billing: BILLING_SERVICE_REQUIRED,
    notification: NOTIFICATION_SERVICE_REQUIRED,
    aws: AWS_REQUIRED,
    frontend: FRONTEND_REQUIRED,
  }
  return [...base, ...extra[service]]
}

function isSensitiveName(name: string): boolean {
  if (name.startsWith('NEXT_PUBLIC_')) return false
  if (name === 'DATABASE_URL' || name === 'REDIS_URL') return true
  const u = name.toUpperCase()
  return /SECRET|PRIVATE|PASSWORD|TOKEN|_KEY/.test(u)
}

function main(): void {
  const root = getRepoRoot()
  loadEnv({ path: join(root, '.env.local') })

  const service = parseServiceFlag()
  const toCheck = [...new Set(varsForService(service))].sort()

  const missing: string[] = []

  for (const name of toCheck) {
    const val = process.env[name]
    const desc = DESCRIPTIONS[name] ?? 'Required environment variable'
    if (val === undefined || val === '') {
      missing.push(name)
      console.log(chalk.red(`✗ MISSING: ${name}`) + chalk.dim(` — ${desc}`))
    } else if (isSensitiveName(name)) {
      console.log(chalk.green(`✓ SET: ${name}`) + chalk.dim(' (value hidden)'))
    } else {
      console.log(chalk.green(`✓ SET: ${name}`))
    }
  }

  console.log()

  if (missing.length > 0) {
    console.log(
      chalk.red.bold(`${missing.length} required variable(s) missing. Run failed. Fix missing vars.`),
    )
    process.exit(1)
  }

  console.log(chalk.green.bold('All environment variables are set. Ready to start.'))
}

main()
