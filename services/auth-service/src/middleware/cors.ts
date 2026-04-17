import { cors } from 'hono/cors'

const defaultOrigins = 'http://localhost:3000,http://localhost:3002'

function parseOrigins(): string[] {
  const raw = process.env['ALLOWED_ORIGINS'] ?? defaultOrigins
  return raw.split(',').map((o) => o.trim()).filter(Boolean)
}

/**
 * CORS for auth-service (env.ALLOWED_ORIGINS is not part of P6 env schema).
 */
export const corsMiddleware = cors({
  origin: (origin) => {
    const allowed = parseOrigins()
    if (!origin) return '*'
    return allowed.includes(origin) ? origin : allowed[0] ?? '*'
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposeHeaders: ['X-Request-ID'],
  credentials: true,
  maxAge: 86_400,
})
