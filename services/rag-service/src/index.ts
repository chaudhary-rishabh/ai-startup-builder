import { serve } from '@hono/node-server'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { sql } from 'drizzle-orm'
import { Pinecone } from '@pinecone-database/pinecone'

import app from './app.js'
import { env } from './config/env.js'
import { startRagEventConsumer } from './events/consumer.js'
import { getDb } from './lib/db.js'
import { logger } from './lib/logger.js'
import { getRedis } from './lib/redis.js'
import { startEmbedWorker } from './queues/embed.worker.js'

async function main(): Promise<void> {
  void env

  const db = getDb()
  await db.execute(sql`SELECT 1`)
  logger.info('Database connected')

  const redis = getRedis()
  await redis.ping()
  logger.info('Redis connected')

  await migrate(db as never, { migrationsFolder: './src/db/migrations' })
  logger.info('Database migrations applied')

  try {
    const pc = new Pinecone({ apiKey: env.PINECONE_API_KEY })
    const indexes = await pc.listIndexes()
    const indexList = (indexes as { indexes?: Array<{ name?: string }> }).indexes ?? []
    const exists = indexList.some((i) => i.name === env.PINECONE_INDEX_NAME)
    if (!exists) {
      logger.error(
        `Pinecone index '${env.PINECONE_INDEX_NAME}' not found. Create it with: dimension=3072, metric=dotproduct, type=serverless`,
      )
      process.exit(1)
    }
    logger.info('Pinecone index verified', { index: env.PINECONE_INDEX_NAME })
  } catch (error) {
    logger.error('Pinecone connection failed — check PINECONE_API_KEY', { error })
    process.exit(1)
  }

  if (process.env['RAG_EVENT_CONSUMER'] !== '0') {
    void startRagEventConsumer()
    logger.info('Event consumer started')
  }
  if (process.env['RAG_EMBED_WORKER'] !== '0') {
    startEmbedWorker()
    logger.info('Embed worker started')
  }

  serve({ fetch: app.fetch, port: env.PORT }, () => {
    logger.info(`rag-service running on port ${env.PORT}`)
  })
}

void main().catch((error) => {
  logger.error('Startup failed', { error })
  process.exit(1)
})
