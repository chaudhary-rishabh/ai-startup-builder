import type { JWTPayload } from 'jose'
import { errors, importPKCS8, importSPKI, jwtVerify, SignJWT } from 'jose'
import { randomUUID } from 'node:crypto'

import { env } from '../config/env.js'

const privateKeyPem = Buffer.from(env.JWT_PRIVATE_KEY_BASE64, 'base64').toString('utf-8')
const publicKeyPem = Buffer.from(env.JWT_PUBLIC_KEY_BASE64, 'base64').toString('utf-8')

const privateKey = await importPKCS8(privateKeyPem, 'RS256')
const publicKey = await importSPKI(publicKeyPem, 'RS256')

export type TokenPair = { accessToken: string; refreshToken: string; expiresIn: number }

export async function signAccessToken(payload: {
  sub: string
  role: string
  plan: string
  email: string
}): Promise<string> {
  return new SignJWT({
    sub: payload.sub,
    role: payload.role,
    plan: payload.plan,
    email: payload.email,
    type: 'access',
  })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer('ai-startup-builder')
    .setAudience('ai-startup-builder-api')
    .setIssuedAt()
    .setExpirationTime(`${env.JWT_ACCESS_TOKEN_TTL}s`)
    .sign(privateKey)
}

export async function signRefreshToken(payload: { sub: string }): Promise<string> {
  return new SignJWT({ sub: payload.sub, type: 'refresh', jti: randomUUID() })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer('ai-startup-builder')
    .setAudience('ai-startup-builder-api')
    .setIssuedAt()
    .setExpirationTime(`${env.JWT_REFRESH_TOKEN_TTL}s`)
    .sign(privateKey)
}

export async function signMfaPendingToken(sub: string): Promise<string> {
  return new SignJWT({ sub, type: 'mfa_pending' })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer('ai-startup-builder')
    .setAudience('ai-startup-builder-api')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey)
}

export async function verifyMfaPendingToken(token: string): Promise<{ sub: string }> {
  const { payload } = await jwtVerify(token, publicKey, {
    issuer: 'ai-startup-builder',
    audience: 'ai-startup-builder-api',
    algorithms: ['RS256'],
  })
  if (payload['type'] !== 'mfa_pending' || typeof payload.sub !== 'string') {
    throw new Error('Invalid MFA pending token')
  }
  return { sub: payload.sub }
}

export async function verifyAccessToken(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, publicKey, {
    issuer: 'ai-startup-builder',
    audience: 'ai-startup-builder-api',
    algorithms: ['RS256'],
  })
  if (payload['type'] !== 'access') {
    throw new errors.JWTInvalid('Expected access token')
  }
  return payload
}

export async function verifyRefreshToken(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, publicKey, {
    issuer: 'ai-startup-builder',
    audience: 'ai-startup-builder-api',
    algorithms: ['RS256'],
  })
  if (payload['type'] !== 'refresh') {
    throw new errors.JWTInvalid('Expected refresh token')
  }
  return payload
}

export async function generateTokenPair(user: {
  id: string
  role: string
  planTier: string
  email: string
}): Promise<TokenPair> {
  const accessToken = await signAccessToken({
    sub: user.id,
    role: user.role,
    plan: user.planTier,
    email: user.email,
  })
  const refreshToken = await signRefreshToken({ sub: user.id })
  return {
    accessToken,
    refreshToken,
    expiresIn: env.JWT_ACCESS_TOKEN_TTL,
  }
}
