import { Hono } from 'hono'

import { serviceRegistry } from '../config/serviceRegistry.js'
import { createCircuitBreaker } from '../middleware/circuitBreaker.js'
import { authRateLimiter, refreshRateLimiter, generalRateLimiter } from '../middleware/rateLimiter.js'
import { buildUpstreamUrl, proxyRequest } from '../lib/proxy.js'

const auth = new Hono()
const cb = createCircuitBreaker('auth')

function upstream(c: Parameters<typeof buildUpstreamUrl>[0]): string {
  return buildUpstreamUrl(c, serviceRegistry.auth)
}

async function proxy(c: Parameters<typeof proxyRequest>[0]): Promise<Response> {
  const url = upstream(c)
  return cb.fire(() => proxyRequest(c, url))
}

// ── Auth routes — NO JWT middleware (auth service handles token verification) ──

auth.post('/register', authRateLimiter, async (c) => proxy(c))
auth.post('/login', authRateLimiter, async (c) => proxy(c))
auth.post('/refresh', refreshRateLimiter, async (c) => proxy(c))
auth.post('/logout', generalRateLimiter, async (c) => proxy(c))
auth.post('/verify-email', generalRateLimiter, async (c) => proxy(c))
auth.post('/forgot-password', authRateLimiter, async (c) => proxy(c))
auth.post('/reset-password', authRateLimiter, async (c) => proxy(c))
auth.post('/oauth/google', authRateLimiter, async (c) => proxy(c))
auth.post('/2fa/setup', generalRateLimiter, async (c) => proxy(c))
auth.post('/2fa/verify', authRateLimiter, async (c) => proxy(c))
auth.delete('/2fa/disable', generalRateLimiter, async (c) => proxy(c))
auth.get('/sessions', generalRateLimiter, async (c) => proxy(c))

export { auth as authRoutes }
