/**
 * Vitest global setup — runs before every test file.
 * Sets the minimum required environment variables so env.ts parses cleanly.
 * Individual test files override specific vars in their own beforeAll/beforeEach.
 */

// Must be set before any module in src/ is imported, because env.ts validates
// process.env at module evaluation time.
Object.assign(process.env, {
  NODE_ENV: 'test',
  PORT: '4000',
  // A valid base64 string (Zod only checks min(1)); real key is set per-test
  JWT_PUBLIC_KEY_BASE64: Buffer.from('test-placeholder-key').toString('base64'),
  REDIS_URL: 'redis://localhost:6379',
  LOG_LEVEL: 'error',
  AUTH_SERVICE_URL: 'http://localhost:4001',
  USER_SERVICE_URL: 'http://localhost:4002',
  PROJECT_SERVICE_URL: 'http://localhost:4003',
  AI_SERVICE_URL: 'http://localhost:4004',
  RAG_SERVICE_URL: 'http://localhost:4005',
  BILLING_SERVICE_URL: 'http://localhost:4006',
  NOTIFICATION_SERVICE_URL: 'http://localhost:4007',
  ANALYTICS_SERVICE_URL: 'http://localhost:4008',
  ALLOWED_ORIGINS: 'http://localhost:3000,http://localhost:3002',
})
