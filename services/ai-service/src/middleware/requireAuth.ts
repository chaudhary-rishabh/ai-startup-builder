import { errors, importSPKI, jwtVerify } from 'jose'
import type { MiddlewareHandler } from 'hono'

import { env } from '../config/env.js'
import { err } from '../lib/response.js'

const publicKeyPem = Buffer.from(env.JWT_PUBLIC_KEY_BASE64, 'base64').toString('utf-8')
const publicKey = await importSPKI(publicKeyPem, 'RS256')

export const requireAuth: MiddlewareHandler = async (c, next) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return err(c, 401, 'UNAUTHORIZED', 'Missing or invalid authorization header')
  }
  const token = auth.slice(7)
  try {
    const { payload } = await jwtVerify(token, publicKey, {
      issuer: 'ai-startup-builder',
      audience: 'ai-startup-builder-api',
      algorithms: ['RS256'],
    })
    if (payload['type'] !== 'access') {
      throw new errors.JWTInvalid('Expected access token')
    }
    const sub = payload.sub
    if (typeof sub !== 'string') {
      return err(c, 401, 'UNAUTHORIZED', 'Invalid token')
    }
    const role = typeof payload['role'] === 'string' ? payload['role'] : 'user'
    const plan = typeof payload['plan'] === 'string' ? payload['plan'] : 'free'
    c.set('userId' as never, sub)
    c.set('userRole' as never, role)
    c.set('userPlan' as never, plan)
    await next()
  } catch {
    return err(c, 401, 'UNAUTHORIZED', 'Invalid or expired token')
  }
}
