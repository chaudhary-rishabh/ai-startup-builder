import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger as honoLogger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'

import { errorHandler } from './middleware/errorHandler.js'
import { requestIdMiddleware } from './middleware/requestId.js'
import agentPerformanceRoutes from './routes/agentPerformance.routes.js'
import auditRoutes from './routes/audit.routes.js'
import eventsRoutes from './routes/events.routes.js'
import funnelRoutes from './routes/funnel.routes.js'
import kpiRoutes from './routes/kpi.routes.js'
import myUsageRoutes from './routes/myUsage.routes.js'
import revenueRoutes from './routes/revenue.routes.js'
import tokenUsageRoutes from './routes/tokenUsage.routes.js'
import userActivityRoutes from './routes/userActivity.routes.js'

export function createApp(): Hono {
  const app = new Hono()
  app.use('*', honoLogger())
  app.use('*', secureHeaders())
  app.use(
    '*',
    cors({
      origin: process.env['NODE_ENV'] === 'production' ? ['https://app.aistartupbuilder.com'] : '*',
      credentials: true,
    }),
  )
  app.use('*', requestIdMiddleware)

  app.route('/analytics', eventsRoutes)
  app.route('/analytics', myUsageRoutes)
  app.route('/analytics/admin', kpiRoutes)
  app.route('/analytics/admin', funnelRoutes)
  app.route('/analytics/admin', tokenUsageRoutes)
  app.route('/analytics/admin', agentPerformanceRoutes)
  app.route('/analytics/admin', revenueRoutes)
  app.route('/analytics/admin', userActivityRoutes)
  app.route('/analytics/admin', auditRoutes)

  app.get('/health', (c) =>
    c.json({
      status: 'ok',
      service: 'analytics-service',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    }),
  )
  app.onError(errorHandler)
  return app
}

export default createApp()
