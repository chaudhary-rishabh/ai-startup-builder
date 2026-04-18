import { Hono } from 'hono'

import { registerAllAgents } from './agents/index.js'
import { corsMiddleware } from './middleware/cors.js'
import { errorHandler } from './middleware/errorHandler.js'
import { requestIdMiddleware } from './middleware/requestId.js'
import { readyHandler } from './ready.js'
import adminRoutes from './routes/admin.routes.js'
import catalogueRoutes from './routes/catalogue.routes.js'
import chatRoutes from './routes/chat.routes.js'
import runsRoutes from './routes/runs.routes.js'

export function createApp(): Hono {
  registerAllAgents()
  const app = new Hono()
  app.use('*', requestIdMiddleware)
  app.use('*', corsMiddleware)

  const ai = new Hono()
  ai.route('/', runsRoutes)
  ai.route('/', chatRoutes)
  ai.route('/', catalogueRoutes)
  ai.route('/', adminRoutes)

  app.route('/ai', ai)
  app.get('/health', (c) => c.json({ status: 'ok', service: 'ai-service' }))
  app.get('/ready', readyHandler)
  app.onError(errorHandler)
  return app
}
