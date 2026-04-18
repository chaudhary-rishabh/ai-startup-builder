import { Hono } from 'hono'

import { listRegisteredAgentTypes } from '../agents/registry.js'
import { getRedis } from '../lib/redis.js'
import { ok } from '../lib/response.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { TOKEN_COSTS_PER_1K } from '../services/modelRouter.service.js'

const CACHE_KEY = 'ai:catalog:agent-types:v6'
const CACHE_TTL = 300

const routes = new Hono()
routes.use('*', requireAuth)

routes.get('/agent-types', async (c) => {
  const redis = getRedis()
  try {
    const hit = await redis.get(CACHE_KEY)
    if (hit) {
      return ok(c, JSON.parse(hit) as { agents: string[]; count: number })
    }
  } catch {
    /* ignore */
  }
  const agents = listRegisteredAgentTypes()
  const payload = { agents, count: agents.length }
  try {
    await redis.setex(CACHE_KEY, CACHE_TTL, JSON.stringify(payload))
  } catch {
    /* ignore */
  }
  return ok(c, payload)
})

routes.get('/models', async (c) => {
  return ok(c, {
    models: [
      { id: 'claude-sonnet-4-5', costsPer1kTokens: TOKEN_COSTS_PER_1K['claude-sonnet-4-5'] },
      { id: 'claude-opus-4-5', costsPer1kTokens: TOKEN_COSTS_PER_1K['claude-opus-4-5'] },
      { id: 'claude-haiku-4-5', costsPer1kTokens: TOKEN_COSTS_PER_1K['claude-haiku-4-5'] },
    ],
  })
})

export default routes
