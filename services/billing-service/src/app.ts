import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger as honoLogger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'

import { errorHandler } from './middleware/errorHandler.js'
import { requestIdMiddleware } from './middleware/requestId.js'
import adminRoutes from './routes/admin.routes.js'
import checkoutRoutes from './routes/checkout.routes.js'
import couponsRoutes from './routes/coupons.routes.js'
import invoicesRoutes from './routes/invoices.routes.js'
import internalRoutes from './routes/internal.routes.js'
import plansRoutes from './routes/plans.routes.js'
import subscriptionRoutes from './routes/subscription.routes.js'
import tokenUsageRoutes from './routes/tokenUsage.routes.js'
import webhookRoutes from './routes/webhook.routes.js'

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

  app.route('/billing', plansRoutes)
  app.route('/billing', webhookRoutes)
  app.route('/billing', subscriptionRoutes)
  app.route('/billing', checkoutRoutes)
  app.route('/billing', invoicesRoutes)
  app.route('/billing', tokenUsageRoutes)
  app.route('/billing', couponsRoutes)
  app.route('/billing', adminRoutes)
  app.route('/internal', internalRoutes)

  app.get('/health', (c) =>
    c.json({
      status: 'ok',
      service: 'billing-service',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    }),
  )
  app.onError(errorHandler)
  return app
}

export default createApp()
