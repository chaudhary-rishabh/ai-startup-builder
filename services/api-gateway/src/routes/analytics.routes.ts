import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'

import { serviceRegistry } from '../config/serviceRegistry.js'
import { createJwtVerify } from '../middleware/jwtVerify.js'
import { createCircuitBreaker } from '../middleware/circuitBreaker.js'
import { generalRateLimiter, adminRateLimiter } from '../middleware/rateLimiter.js'
import { buildUpstreamUrl, proxyRequest } from '../lib/proxy.js'
import type { AppJWTPayload } from '../types.js'
import type { ErrorResponse } from '@repo/types'

const analytics = new Hono()
const jwt = createJwtVerify()
const cb = createCircuitBreaker('analytics')

function upstream(c: Parameters<typeof buildUpstreamUrl>[0]): string {
  return buildUpstreamUrl(c, serviceRegistry.analytics)
}

async function proxy(c: Parameters<typeof proxyRequest>[0]): Promise<Response> {
  return cb.fire(() => proxyRequest(c, upstream(c)))
}

/**
 * Additional middleware that enforces admin / super_admin role.
 * Runs AFTER jwtVerify so `c.get('user')` is already populated.
 */
const requireAdmin: MiddlewareHandler = async (c, next) => {
  const user = c.get('user' as never) as AppJWTPayload | undefined
  if (!user?.role || !(['admin', 'super_admin'] as string[]).includes(user.role)) {
    const body: ErrorResponse = {
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Admin access required',
        traceId: (c.get('requestId' as never) as string | undefined) ?? '',
        service: 'api-gateway',
      },
    }
    return c.json(body, 403)
  }
  await next()
}

// ── All analytics routes require JWT ──────────────────────────────────────────
analytics.use('/*', jwt)

// Public (to authenticated users)
analytics.post('/events', generalRateLimiter, async (c) => proxy(c))
analytics.post('/events/batch', generalRateLimiter, async (c) => proxy(c))
analytics.get('/users/:userId/events', generalRateLimiter, async (c) => proxy(c))
analytics.get('/projects/:projectId/events', generalRateLimiter, async (c) => proxy(c))

// Admin-only routes — additional role check
analytics.get('/kpis', requireAdmin, adminRateLimiter, async (c) => proxy(c))
analytics.get('/funnel', requireAdmin, adminRateLimiter, async (c) => proxy(c))
analytics.post('/reports/weekly-digest', requireAdmin, adminRateLimiter, async (c) => proxy(c))
analytics.get('/admin/users', requireAdmin, adminRateLimiter, async (c) => proxy(c))
analytics.get('/admin/overview', requireAdmin, adminRateLimiter, async (c) => proxy(c))
analytics.get('/audit-logs', requireAdmin, adminRateLimiter, async (c) => proxy(c))

export { analytics as analyticsRoutes }
