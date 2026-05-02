import type { MiddlewareHandler, Context } from 'hono'
import { Redis } from 'ioredis'

import type { ErrorResponse } from '@repo/types'
import type { AppJWTPayload } from '../types.js'
import { env } from '../config/env.js'
import { logger } from '../observability/logger.js'

interface RateLimiterOptions {
  /** Maximum requests allowed within the window */
  max: number
  /** Sliding window size in seconds */
  window: number
  /** Optional custom key function. Default: userId (auth) or IP:prefix (anon) */
  keyFn?: (c: Context) => string
  /** Inject a Redis instance (used in tests) */
  redis?: Redis
}

// ── Lazy Redis singleton ──────────────────────────────────────────────────────
let _redisInstance: Redis | undefined

/** Inject a mock Redis for tests */
export function setRedisForTests(instance: Redis): void {
  _redisInstance = instance
}

function getRedis(): Redis {
  if (!_redisInstance) {
    _redisInstance = new Redis(env.REDIS_URL)
    _redisInstance.on('error', (err: Error) =>
      logger.error({ event: 'redis_error', message: err.message }),
    )
  }
  return _redisInstance
}

function buildErrorResponse(requestId: string): ErrorResponse {
  return {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.',
      traceId: requestId,
      service: 'api-gateway',
    },
  }
}

/**
 * Redis sliding-window rate limiter.
 *
 * Algorithm (sorted set per key):
 *   1. ZADD  key NX <nowMs> <uuid-member>     — record this request
 *   2. ZREMRANGEBYSCORE key -inf <(now-window_ms)> — evict expired entries
 *   3. ZCARD key                               — count requests in window
 *   4. EXPIRE key <windowSecs>                 — keep key from persisting forever
 *   5. If ZCARD > max → 429
 */
export function createRateLimiter(options: RateLimiterOptions): MiddlewareHandler {
  const { max, window: windowSecs, keyFn, redis: injectedRedis } = options
  const windowMs = windowSecs * 1000

  return async (c, next) => {
    const redis = injectedRedis ?? getRedis()
    const requestId = (c.get('requestId' as never) as string | undefined) ?? ''
    const user = c.get('user' as never) as AppJWTPayload | undefined

    const defaultKey = user?.sub
      ? `user:${user.sub}`
      : `ip:${(c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown').split(',')[0]?.trim() ?? 'unknown'}`

    const scopeKey = `ratelimit:${keyFn ? keyFn(c) : defaultKey}`
    const nowMs = Date.now()
    const member = `${nowMs}:${Math.random().toString(36).slice(2)}`

    try {
      const pipeline = redis.pipeline()
      pipeline.zadd(scopeKey, nowMs, member)
      pipeline.zremrangebyscore(scopeKey, '-inf', nowMs - windowMs)
      pipeline.zcard(scopeKey)
      pipeline.expire(scopeKey, windowSecs)
      const results = await pipeline.exec()

      const count = (results?.[2]?.[1] as number | null) ?? 0
      const remaining = Math.max(0, max - count)
      const resetEpoch = Math.ceil((nowMs + windowMs) / 1000)

      c.header('X-RateLimit-Limit', String(max))
      c.header('X-RateLimit-Remaining', String(remaining))
      c.header('X-RateLimit-Reset', String(resetEpoch))

      if (count > max) {
        c.header('Retry-After', String(windowSecs))
        return c.json(buildErrorResponse(requestId), 429)
      }
    } catch (err) {
      // Fail open — never block traffic due to Redis being unavailable
      logger.warn({
        event: 'rate_limiter_redis_error',
        requestId,
        message: err instanceof Error ? err.message : 'unknown',
      })
    }

    return next()
  }
}

// ── Pre-built rate limiters for route groups ─────────────────────────────────
/** Stricter cap for unauthenticated auth flows (login, OAuth, password reset, etc.) */
export const authRateLimiter = createRateLimiter({ max: 160, window: 60 })
export const refreshRateLimiter = createRateLimiter({ max: 220, window: 60 })
export const generalRateLimiter = createRateLimiter({ max: 600, window: 60 })
export const aiRateLimiter = createRateLimiter({ max: 120, window: 60 })
export const adminRateLimiter = createRateLimiter({ max: 1200, window: 60 })
