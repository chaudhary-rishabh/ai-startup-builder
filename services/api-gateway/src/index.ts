import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'

import { env } from './config/env.js'
import { corsMiddleware } from './middleware/cors.js'
import { helmetMiddleware } from './middleware/helmet.js'
import { requestLogger } from './middleware/requestLogger.js'
import { generalRateLimiter } from './middleware/rateLimiter.js'
import { logger } from './observability/logger.js'
import type { ErrorResponse } from '@repo/types'

import { authRoutes } from './routes/auth.routes.js'
import { buildLivenessPayload, healthRoutes } from './routes/health.routes.js'
import { userRoutes } from './routes/user.routes.js'
import { projectRoutes } from './routes/project.routes.js'
import { aiRoutes } from './routes/ai.routes.js'
import { ragRoutes } from './routes/rag.routes.js'
import { billingRoutes } from './routes/billing.routes.js'
import { notificationRoutes } from './routes/notification.routes.js'
import { analyticsRoutes } from './routes/analytics.routes.js'

// ── Assemble the application ───────────────────────────────────────────────────
const app = new Hono()

// ── Global middleware (order matters) ─────────────────────────────────────────
// 1. Request ID + timing (always first — captures full duration)
app.use('*', requestLogger)

// 2. CORS — must run before any request processing
app.use('*', corsMiddleware)

// 3. Security headers
app.use('*', helmetMiddleware)

// 4. Global IP-based rate limit baseline — skip for health and root ping so probes are never throttled
const rateLimitUnlessHealthOrRoot: MiddlewareHandler = async (c, next) => {
  const p = c.req.path
  if (p === '/' || p === '/health' || p.startsWith('/health/')) {
    return next()
  }
  return generalRateLimiter(c, next)
}
app.use('*', rateLimitUnlessHealthOrRoot)

// ── Route mounting ─────────────────────────────────────────────────────────────
/** Root GET — minimal liveness for load balancers that only hit `/`. */
app.get('/', (c) => c.json(buildLivenessPayload()))

// Public routes
app.route('/health', healthRoutes)
app.route('/auth', authRoutes)

// Protected routes (individual middleware applied per-route-group)
app.route('/users', userRoutes)
app.route('/projects', projectRoutes)
app.route('/ai', aiRoutes)
app.route('/rag', ragRoutes)
app.route('/billing', billingRoutes)
app.route('/notifications', notificationRoutes)
app.route('/analytics', analyticsRoutes)

// ── Global error handler ───────────────────────────────────────────────────────
app.onError((err, c) => {
  const requestId = (c.get('requestId' as never) as string | undefined) ?? ''

  logger.error({
    event: 'unhandled_error',
    requestId,
    message: err.message,
    // Only expose stack in development
    ...(env.NODE_ENV !== 'production' && { stack: err.stack }),
  })

  const body: ErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message:
        env.NODE_ENV === 'production'
          ? 'An unexpected error occurred'
          : err.message,
      traceId: requestId,
      service: 'api-gateway',
    },
  }

  return c.json(body, 500)
})

// ── 404 fallback ───────────────────────────────────────────────────────────────
app.notFound((c) => {
  const body: ErrorResponse = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${c.req.method} ${c.req.path} not found`,
      traceId: (c.get('requestId' as never) as string | undefined) ?? '',
      service: 'api-gateway',
    },
  }
  return c.json(body, 404)
})

// ── Start the Node.js HTTP server ──────────────────────────────────────────────
if (process.env['NODE_ENV'] !== 'test') {
  serve(
    { fetch: app.fetch, port: env.PORT },
    (info) => {
      logger.info({
        event: 'server_started',
        service: 'api-gateway',
        port: info.port,
        env: env.NODE_ENV,
      })
    },
  )
}

export default app
