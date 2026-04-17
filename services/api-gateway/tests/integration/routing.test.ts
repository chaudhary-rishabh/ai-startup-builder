import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import type { Mock } from 'vitest'
import { generateKeyPair, SignJWT, exportSPKI } from 'jose'
import RedisMock from 'ioredis-mock'

import { _resetPublicKeyCache } from '../../src/middleware/jwtVerify.js'
import { setRedisForTests } from '../../src/middleware/rateLimiter.js'

// ── Shared JWT setup ──────────────────────────────────────────────────────────
let privateKey: CryptoKey
let validToken: string
let adminToken: string

// ── Import the assembled Hono app ─────────────────────────────────────────────
let app: { request: (input: string | Request, init?: RequestInit) => Promise<Response> }
let redisMock: InstanceType<typeof RedisMock>

beforeAll(async () => {
  // Inject an in-memory Redis mock so rate limiters work without a real server
  // and so their state can be flushed between tests.
  redisMock = new RedisMock()
  setRedisForTests(redisMock as never)

  // Generate a real RSA key pair for integration tests
  const pair = await generateKeyPair('RS256')
  privateKey = pair.privateKey as CryptoKey

  const publicKeySpki = await exportSPKI(pair.publicKey)
  process.env['JWT_PUBLIC_KEY_BASE64'] = Buffer.from(publicKeySpki).toString('base64')

  // Reset cached key so the new one is picked up
  _resetPublicKeyCache()

  // Mint tokens once for all tests
  validToken = await new SignJWT({ role: 'user', plan: 'free' })
    .setProtectedHeader({ alg: 'RS256' })
    .setSubject('user-123')
    .setIssuer('ai-startup-builder')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey)

  adminToken = await new SignJWT({ role: 'admin', plan: 'enterprise' })
    .setProtectedHeader({ alg: 'RS256' })
    .setSubject('admin-456')
    .setIssuer('ai-startup-builder')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey)

  const mod = await import('../../src/index.js')
  app = mod.default
}, 30_000)

beforeEach(async () => {
  // Flush all Redis keys before each test so rate-limit counters don't bleed
  // across tests (multiple rate limiters share the same in-memory store).
  await redisMock.flushall()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── Helpers ───────────────────────────────────────────────────────────────────
function mockFetchOnce(body: unknown, status = 200): Mock {
  const stub = vi.fn().mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  )
  vi.stubGlobal('fetch', stub)
  return stub
}

function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` }
}

// ─────────────────────────────────────────────────────────────────────────────

describe('Integration: routing', () => {
  // ── Health endpoints ────────────────────────────────────────────────────────
  describe('GET /health/health', () => {
    it('returns 200 with status ok', async () => {
      const res = await app.request('/health/health')
      expect(res.status).toBe(200)
      const body = await res.json() as { status: string; service: string }
      expect(body.status).toBe('ok')
      expect(body.service).toBe('api-gateway')
    })
  })

  // ── Auth proxy ──────────────────────────────────────────────────────────────
  describe('POST /auth/login', () => {
    it('proxies to auth-service and returns its response', async () => {
      const mockFetch = mockFetchOnce({ success: true, data: { accessToken: 'tok' } })

      const res = await app.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@test.com', password: 'Test123!' }),
        headers: { 'content-type': 'application/json' },
      })

      expect(res.status).toBe(200)
      expect(mockFetch).toHaveBeenCalledOnce()
      const [calledUrl] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(calledUrl).toContain('localhost:4001')
      expect(calledUrl).toContain('/auth/login')
    })
  })

  describe('POST /auth/register', () => {
    it('proxies to auth-service', async () => {
      const mockFetch = mockFetchOnce({ success: true, data: { userId: '123' } }, 201)
      const res = await app.request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email: 'new@test.com', password: 'Test123!', fullName: 'Test' }),
        headers: { 'content-type': 'application/json' },
      })
      expect(res.status).toBe(201)
      const [calledUrl] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(calledUrl).toContain('/auth/register')
    })
  })

  // ── JWT protection ─────────────────────────────────────────────────────────
  describe('JWT protection', () => {
    it('GET /projects returns 401 without a token', async () => {
      const res = await app.request('/projects')
      expect(res.status).toBe(401)
      const body = await res.json() as { error: { code: string } }
      expect(body.error.code).toBe('UNAUTHORIZED')
    })

    it('GET /users/me returns 401 without a token', async () => {
      const res = await app.request('/users/me')
      expect(res.status).toBe(401)
    })

    it('GET /ai/runs returns 401 without a token', async () => {
      const res = await app.request('/ai/runs')
      expect(res.status).toBe(401)
    })

    it('GET /rag/documents returns 401 without a token', async () => {
      const res = await app.request('/rag/documents')
      expect(res.status).toBe(401)
    })

    it('GET /billing/subscription returns 401 without a token', async () => {
      const res = await app.request('/billing/subscription')
      expect(res.status).toBe(401)
    })

    it('GET /notifications returns 401 without a token', async () => {
      const res = await app.request('/notifications')
      expect(res.status).toBe(401)
    })

    it('GET /analytics/events returns 401 without a token', async () => {
      const res = await app.request('/analytics/events')
      expect(res.status).toBe(401)
    })
  })

  // ── Protected routes with valid JWT ────────────────────────────────────────
  describe('Authenticated routes', () => {
    it('GET /users/me with valid JWT proxies to user-service', async () => {
      const mockFetch = mockFetchOnce({ success: true, data: { id: 'user-123' } })

      const res = await app.request('/users/me', {
        headers: authHeader(validToken),
      })

      expect(res.status).toBe(200)
      expect(mockFetch).toHaveBeenCalledOnce()
      const [calledUrl, calledInit] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(calledUrl).toContain('localhost:4002')
      expect(calledUrl).toContain('/users/me')
      // Gateway should inject user context headers — headers is a Headers instance
      const sentHeaders = calledInit.headers as Headers
      expect(sentHeaders.get('x-user-id')).toBe('user-123')
    })

    it('GET /projects with valid JWT proxies to project-service', async () => {
      const mockFetch = mockFetchOnce({ success: true, data: [] })

      const res = await app.request('/projects', {
        headers: authHeader(validToken),
      })

      expect(res.status).toBe(200)
      const [calledUrl] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(calledUrl).toContain('localhost:4003')
    })

    it('POST /ai/runs with valid JWT proxies to ai-service', async () => {
      const mockFetch = mockFetchOnce({ success: true, data: { runId: 'run-1' } }, 201)

      const res = await app.request('/ai/runs', {
        method: 'POST',
        body: JSON.stringify({ projectId: 'proj-1', phase: 1 }),
        headers: { ...authHeader(validToken), 'content-type': 'application/json' },
      })

      expect(res.status).toBe(201)
      const [calledUrl] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(calledUrl).toContain('localhost:4004')
    })

    it('POST /rag/documents with valid JWT proxies to rag-service', async () => {
      const mockFetch = mockFetchOnce({ success: true, data: { docId: 'doc-1' } }, 202)

      const res = await app.request('/rag/documents', {
        method: 'POST',
        body: JSON.stringify({ url: 'https://example.com/doc.pdf' }),
        headers: { ...authHeader(validToken), 'content-type': 'application/json' },
      })

      expect(res.status).toBe(202)
      const [calledUrl] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(calledUrl).toContain('localhost:4005')
    })

    it('GET /billing/subscription with valid JWT proxies to billing-service', async () => {
      mockFetchOnce({ success: true, data: { plan: 'pro' } })

      const res = await app.request('/billing/subscription', {
        headers: authHeader(validToken),
      })

      expect(res.status).toBe(200)
    })

    it('GET /notifications with valid JWT proxies to notification-service', async () => {
      mockFetchOnce({ success: true, data: [] })

      const res = await app.request('/notifications', {
        headers: authHeader(validToken),
      })

      expect(res.status).toBe(200)
    })

    it('POST /analytics/events with valid JWT proxies to analytics-service', async () => {
      mockFetchOnce({ success: true })

      const res = await app.request('/analytics/events', {
        method: 'POST',
        body: JSON.stringify({ event: 'page_view', properties: {} }),
        headers: { ...authHeader(validToken), 'content-type': 'application/json' },
      })

      expect(res.status).toBe(200)
    })
  })

  // ── Admin-only routes ───────────────────────────────────────────────────────
  describe('Admin protection', () => {
    it('GET /analytics/kpis with non-admin JWT returns 403', async () => {
      const res = await app.request('/analytics/kpis', {
        headers: authHeader(validToken), // user role, not admin
      })
      expect(res.status).toBe(403)
      const body = await res.json() as { error: { code: string } }
      expect(body.error.code).toBe('FORBIDDEN')
    })

    it('GET /analytics/kpis with admin JWT proxies to analytics-service', async () => {
      mockFetchOnce({ success: true, data: {} })

      const res = await app.request('/analytics/kpis', {
        headers: authHeader(adminToken),
      })

      expect(res.status).toBe(200)
    })
  })

  // ── Stripe webhook (no JWT) ─────────────────────────────────────────────────
  describe('POST /billing/webhooks/stripe', () => {
    it('passes through without JWT requirement', async () => {
      mockFetchOnce({ received: true })

      const res = await app.request('/billing/webhooks/stripe', {
        method: 'POST',
        body: '{"type":"payment_intent.succeeded"}',
        headers: { 'content-type': 'application/json', 'stripe-signature': 'sig-abc' },
      })

      expect(res.status).toBe(200)
    })
  })

  // ── CORS headers ────────────────────────────────────────────────────────────
  describe('CORS', () => {
    it('OPTIONS preflight returns CORS headers', async () => {
      const res = await app.request('/auth/login', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'POST',
        },
      })
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeTruthy()
    })

    it('successful request includes Access-Control-Allow-Origin header', async () => {
      const res = await app.request('/health/health', {
        headers: { Origin: 'http://localhost:3000' },
      })
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeTruthy()
    })
  })

  // ── Security headers ────────────────────────────────────────────────────────
  describe('Security headers (helmet)', () => {
    it('response includes X-Content-Type-Options: nosniff', async () => {
      const res = await app.request('/health/health')
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
    })

    it('response includes X-Frame-Options: DENY', async () => {
      const res = await app.request('/health/health')
      expect(res.headers.get('X-Frame-Options')).toBe('DENY')
    })
  })

  // ── 404 fallback ─────────────────────────────────────────────────────────────
  describe('404 not found', () => {
    it('returns 404 for unknown routes', async () => {
      const res = await app.request('/this/does/not/exist')
      expect(res.status).toBe(404)
      const body = await res.json() as { error: { code: string } }
      expect(body.error.code).toBe('NOT_FOUND')
    })
  })

  // ── Request-ID propagation ──────────────────────────────────────────────────
  describe('X-Request-ID', () => {
    it('every response includes X-Request-ID header', async () => {
      const res = await app.request('/health/health')
      expect(res.headers.get('X-Request-ID')).toBeTruthy()
    })
  })

  // ── Ready endpoint ──────────────────────────────────────────────────────────
  describe('GET /health/ready', () => {
    it('returns 200 or 503 with a checks object', async () => {
      const res = await app.request('/health/ready')
      expect([200, 503]).toContain(res.status)
      const body = await res.json() as { checks: { redis: string } }
      expect(body.checks).toBeDefined()
      expect(body.checks.redis).toMatch(/^(ok|failed)$/)
    })
  })
})
