import { pathToFileURL } from 'node:url'

import { serve } from '@hono/node-server'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { count, sql } from 'drizzle-orm'

import app, { createApp } from './app.js'
import { env } from './config/env.js'
import { startBillingEventConsumer } from './events/consumer.js'
import { plans } from './db/schema.js'
import { getDb } from './lib/db.js'
import { logger } from './lib/logger.js'
import { getRedis } from './lib/redis.js'

export { createApp }
export { env }

function shouldStartServer(): boolean {
  if (!process.argv[1]) return false
  try {
    return import.meta.url === pathToFileURL(process.argv[1]).href
  } catch {
    return false
  }
}

if (shouldStartServer()) {
  void (async () => {
    void env
    const db = getDb()
    await db.execute(sql`SELECT 1`)
    logger.info('Database connected')
    const redis = getRedis()
    await redis.ping()
    logger.info('Redis connected')
    await migrate(db as never, { migrationsFolder: './src/db/migrations' })
    logger.info('Database migrations applied')
    const [planCount] = await db.select({ c: count() }).from(plans)
    if (Number(planCount?.c ?? 0) === 0) {
      logger.warn('Plans table is empty. Run seed migration.')
    }
    void startBillingEventConsumer()
    logger.info('Event consumer started')

    serve({ fetch: app.fetch, port: env.PORT }, () => {
      logger.info(`billing-service started on port ${env.PORT}`)
    })
  })().catch((error) => {
    logger.error('Startup failed', { error })
    process.exit(1)
  })
}
