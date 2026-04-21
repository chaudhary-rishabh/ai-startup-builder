import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateKeyPairSync } from 'node:crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ragEnvPath = path.join(__dirname, '..', '.vitest-rag-integration.json')
if (fs.existsSync(ragEnvPath)) {
  try {
    const extra = JSON.parse(fs.readFileSync(ragEnvPath, 'utf8')) as Record<string, string>
    Object.assign(process.env, extra)
  } catch {
    /* ignore */
  }
}

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})

Object.assign(process.env, {
  NODE_ENV: 'test',
  PORT: '4005',
  DATABASE_URL:
    process.env['DATABASE_URL'] ?? 'postgresql://postgres:devpassword@localhost:5432/aistartup',
  REDIS_URL: process.env['REDIS_URL'] ?? 'redis://127.0.0.1:6379',
  JWT_PUBLIC_KEY_BASE64: Buffer.from(publicKey).toString('base64'),
  JWT_PRIVATE_KEY_TEST_BASE64: Buffer.from(privateKey).toString('base64'),
  AWS_REGION: 'ap-south-1',
  AWS_ACCESS_KEY_ID: 'test',
  AWS_SECRET_ACCESS_KEY: 'test',
  S3_BUCKET: 'test-bucket',
  ANTHROPIC_API_KEY: 'sk-ant-test',
  OPENAI_API_KEY: 'sk-openai-test',
  PINECONE_API_KEY: 'pc-test',
  PINECONE_INDEX_NAME: 'test-index',
  PINECONE_ENVIRONMENT: 'us-east-1-aws',
  COHERE_API_KEY: 'cohere-test',
  CONTEXT_ENRICHMENT_ENABLED: 'false',
  RAG_EMBED_WORKER: '0',
  RAG_EVENT_CONSUMER: '0',
})
