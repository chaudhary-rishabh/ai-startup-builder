import type { Context } from 'hono'

import type { AppJWTPayload } from '../types.js'

export interface ProxyOptions {
  /** Stream response as Server-Sent Events (no buffering) */
  streaming?: boolean
  /** Skip reading / forwarding the request body (used for raw webhook passthrough) */
  skipBodyParsing?: boolean
}

/**
 * Forward the inbound Hono request to an upstream service URL.
 *
 * What gets forwarded:
 *  - HTTP method
 *  - A curated set of client headers (content-type, accept, cookie, …)
 *  - Gateway-injected context headers: X-User-ID, X-User-Role, X-Plan-Tier,
 *    X-Request-ID, X-Forwarded-For
 *  - Request body as a streaming pass-through (supports JSON, multipart, raw)
 *
 * What gets returned:
 *  - Upstream status + headers + body, untouched
 *  - OR: a streaming SSE response when options.streaming = true
 */
export async function proxyRequest(
  c: Context,
  targetUrl: string,
  options: ProxyOptions = {},
): Promise<Response> {
  const user = c.get('user' as never) as AppJWTPayload | undefined
  const requestId = c.get('requestId' as never) as string | undefined

  // ── Build forwarded headers ─────────────────────────────────────────────────
  const headers = new Headers()

  const forwardable = [
    'content-type',
    'accept',
    'accept-language',
    'accept-encoding',
    'cookie',
    'user-agent',
    'stripe-signature',
    'x-real-ip',
  ]

  for (const name of forwardable) {
    const value = c.req.header(name)
    if (value !== undefined) headers.set(name, value)
  }

  const xff = c.req.header('x-forwarded-for')
  if (xff !== undefined) headers.set('x-forwarded-for', xff)

  // Inject gateway auth context for downstream services
  if (user?.sub) headers.set('x-user-id', user.sub)
  if (user?.role) headers.set('x-user-role', user.role)
  if (user?.plan) headers.set('x-plan-tier', user.plan)
  if (requestId) headers.set('x-request-id', requestId)

  // ── Build fetch options ─────────────────────────────────────────────────────
  const method = c.req.method.toUpperCase()
  const hasBody = !['GET', 'HEAD', 'OPTIONS'].includes(method) && !options.skipBodyParsing
  const body = hasBody ? c.req.raw.body : undefined

  // `duplex: 'half'` is required in Node 18+ when body is a readable stream
  const fetchInit: Record<string, unknown> = { method, headers }
  if (body) {
    fetchInit['body'] = body
    fetchInit['duplex'] = 'half'
  }

  // ── Execute the upstream request ────────────────────────────────────────────
  const upstream = await fetch(targetUrl, fetchInit as RequestInit)

  // ── SSE streaming mode (AI runs) ────────────────────────────────────────────
  if (options.streaming) {
    const sseHeaders = new Headers({
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      'x-accel-buffering': 'no',
      connection: 'keep-alive',
    })
    if (requestId) sseHeaders.set('x-request-id', requestId)

    return new Response(upstream.body, { status: upstream.status, headers: sseHeaders })
  }

  // ── Standard pass-through ────────────────────────────────────────────────────
  const responseHeaders = new Headers(upstream.headers)
  if (requestId) responseHeaders.set('x-request-id', requestId)

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  })
}

/**
 * Convenience wrapper: build the upstream path from the inbound request URL
 * (preserves query string) and proxy to the given base URL.
 */
export function buildUpstreamUrl(c: Context, serviceBaseUrl: string): string {
  const incomingUrl = new URL(c.req.raw.url)
  return `${serviceBaseUrl}${incomingUrl.pathname}${incomingUrl.search}`
}
