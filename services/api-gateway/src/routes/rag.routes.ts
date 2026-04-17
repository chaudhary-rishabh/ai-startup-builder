import { Hono } from 'hono'

import { serviceRegistry } from '../config/serviceRegistry.js'
import { createJwtVerify } from '../middleware/jwtVerify.js'
import { createCircuitBreaker } from '../middleware/circuitBreaker.js'
import { generalRateLimiter, aiRateLimiter } from '../middleware/rateLimiter.js'
import { buildUpstreamUrl, proxyRequest } from '../lib/proxy.js'

const rag = new Hono()
const jwt = createJwtVerify()
const cb = createCircuitBreaker('rag')

function upstream(c: Parameters<typeof buildUpstreamUrl>[0]): string {
  return buildUpstreamUrl(c, serviceRegistry.rag)
}

async function proxy(c: Parameters<typeof proxyRequest>[0]): Promise<Response> {
  return cb.fire(() => proxyRequest(c, upstream(c)))
}

// ── All RAG routes require a valid JWT ────────────────────────────────────────
rag.use('/*', jwt)

/**
 * Document upload — multipart/form-data, 25 MB body limit enforced upstream.
 * The gateway streams the body without buffering.
 */
rag.post('/documents', aiRateLimiter, async (c) => proxy(c))
rag.get('/documents', generalRateLimiter, async (c) => proxy(c))
rag.delete('/documents/:docId', generalRateLimiter, async (c) => proxy(c))
rag.get('/documents/:docId/status', generalRateLimiter, async (c) => proxy(c))
rag.post('/documents/:docId/reindex', aiRateLimiter, async (c) => proxy(c))

// RAG query (triggers embedding + vector search)
rag.post('/query', aiRateLimiter, async (c) => proxy(c))

// Namespace management
rag.get('/namespaces', generalRateLimiter, async (c) => proxy(c))
rag.delete('/namespaces/:ns', generalRateLimiter, async (c) => proxy(c))

// Stats
rag.get('/stats', generalRateLimiter, async (c) => proxy(c))

export { rag as ragRoutes }
