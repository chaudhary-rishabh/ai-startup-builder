import { generateKeyPairSync } from 'node:crypto'

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})

Object.assign(process.env, {
  NODE_ENV: 'test',
  PORT: '4006',
  DATABASE_URL: process.env['DATABASE_URL'] ?? 'postgresql://postgres:devpassword@localhost:5432/aistartup',
  REDIS_URL: process.env['REDIS_URL'] ?? 'redis://127.0.0.1:6379',
  JWT_PUBLIC_KEY_BASE64: Buffer.from(publicKey).toString('base64'),
  JWT_PRIVATE_KEY_TEST_BASE64: Buffer.from(privateKey).toString('base64'),
  STRIPE_SECRET_KEY: 'sk_test_123',
  STRIPE_WEBHOOK_SECRET: 'whsec_test_123',
  STRIPE_PRO_MONTHLY_PRICE_ID: 'price_pro_monthly',
  STRIPE_PRO_YEARLY_PRICE_ID: 'price_pro_yearly',
  STRIPE_TEAM_MONTHLY_PRICE_ID: 'price_team_monthly',
  STRIPE_TEAM_YEARLY_PRICE_ID: 'price_team_yearly',
  APP_URL: 'http://localhost:3000',
})
