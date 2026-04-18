import { Hono } from 'hono'
import { Redis } from 'ioredis'

import { env } from '../config/env.js'

let _testRedis: Redis | null = null

/** Inject a Redis instance for tests */
export function setHealthRedisForTests(r: Redis): void {
  _testRedis = r
}

async function checkRedis(): Promise<'ok' | 'failed'> {
  try {
    if (_testRedis) {
      await _testRedis.ping()
      return 'ok'
    }

    const redis = new Redis(env.REDIS_URL, { lazyConnect: true, connectTimeout: 3000 })
    await redis.connect()
    await redis.ping()
    await redis.quit()
    return 'ok'
  } catch {
    return 'failed'
  }
}

const health = new Hono()

/**
 * GET /health
 * Always 200 — indicates the process is alive.
 */
health.get('/health', (c) =>
  c.json({
    status: 'ok',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
  }),
)

/**
 * GET /ready
 * Checks actual dependencies (Redis). Returns 503 if any are unavailable.
 */
health.get('/ready', async (c) => {
  const redisStatus = await checkRedis()
  const allHealthy = redisStatus === 'ok'

  return c.json(
    {
      status: allHealthy ? 'ok' : 'error',
      service: 'api-gateway',
      checks: { redis: redisStatus },
      timestamp: new Date().toISOString(),
    },
    allHealthy ? 200 : 503,
  )
})

export { health as healthRoutes }
