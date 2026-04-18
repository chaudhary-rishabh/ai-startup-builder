import { createHash, randomBytes } from 'node:crypto'

import type { ValidationErrorDetail } from '@repo/types'

import { env } from '../config/env.js'
import * as mfaQueries from '../db/queries/mfaCredentials.queries.js'
import * as oauthQueries from '../db/queries/oauthAccounts.queries.js'
import * as usersQueries from '../db/queries/users.queries.js'
import type { User } from '../db/schema.js'
import { getRedis, oauthStateKey } from './redis.service.js'
import { generateTokenPair, signMfaPendingToken, type TokenPair } from './jwt.service.js'

export type GoogleUserInfo = {
  email: string
  sub: string
  name: string
  picture?: string
}

export type GoogleOAuthTokens = {
  access_token: string
  refresh_token?: string
  expires_in?: number
  scope?: string
}

export type OAuthRouteError = {
  oauthRouteError: true
  status: number
  code: string
  message: string
  details?: ValidationErrorDetail[]
}

export type OAuthCallbackSuccess = {
  user: User
  isNewUser: boolean
  tokenPair: TokenPair
}

export type OAuthCallbackMfa = {
  requiresMfa: true
  mfaTempToken: string
}

export type OAuthCallbackResult = OAuthCallbackSuccess | OAuthCallbackMfa

function oauthFail(
  status: number,
  code: string,
  message: string,
  details?: ValidationErrorDetail[],
): never {
  const oauthErr: OAuthRouteError = {
    oauthRouteError: true,
    status,
    code,
    message,
    ...(details !== undefined ? { details } : {}),
  }
  throw oauthErr
}

export function isOAuthRouteError(e: unknown): e is OAuthRouteError {
  return (
    typeof e === 'object' &&
    e !== null &&
    'oauthRouteError' in e &&
    (e as OAuthRouteError).oauthRouteError === true
  )
}

export async function generateAuthUrl(): Promise<{ url: string; state: string }> {
  const state = randomBytes(16).toString('hex')
  const codeVerifier = randomBytes(32).toString('base64url')
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent',
  })
  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  const redis = getRedis()
  await redis.set(oauthStateKey(state), JSON.stringify({ codeVerifier }), 'EX', 600)
  return { url, state }
}

export async function exchangeCodeForTokens(
  code: string,
  state: string,
): Promise<{ userInfo: GoogleUserInfo; tokens: GoogleOAuthTokens }> {
  const redis = getRedis()
  const key = oauthStateKey(state)
  const raw = await redis.get(key)
  if (!raw) {
    throw new Error('Invalid OAuth state')
  }
  await redis.del(key)
  let codeVerifier: string
  try {
    const parsed = JSON.parse(raw) as unknown
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as { codeVerifier?: unknown }).codeVerifier !== 'string'
    ) {
      throw new Error('Invalid OAuth state payload')
    }
    codeVerifier = (parsed as { codeVerifier: string }).codeVerifier
  } catch (e) {
    if (e instanceof Error && e.message === 'Invalid OAuth state') throw e
    throw new Error('Invalid OAuth state')
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    }),
  })

  if (!tokenRes.ok) {
    const bodyText = await tokenRes.text()
    throw new Error(`Google token exchange failed: ${tokenRes.status} ${bodyText}`)
  }

  const tokens = (await tokenRes.json()) as GoogleOAuthTokens
  if (typeof tokens.access_token !== 'string') {
    throw new Error('Google token response missing access_token')
  }

  const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  if (!userRes.ok) {
    const bodyText = await userRes.text()
    throw new Error(`Google userinfo failed: ${userRes.status} ${bodyText}`)
  }
  const profile = (await userRes.json()) as {
    email?: string
    sub?: string
    name?: string
    picture?: string
  }
  if (typeof profile.sub !== 'string' || typeof profile.email !== 'string') {
    throw new Error('Google userinfo missing required fields')
  }
  const userInfo: GoogleUserInfo = {
    sub: profile.sub,
    email: profile.email.toLowerCase(),
    name: typeof profile.name === 'string' ? profile.name : profile.email,
    ...(typeof profile.picture === 'string' ? { picture: profile.picture } : {}),
  }
  return { userInfo, tokens }
}

export async function handleOAuthCallback(
  googleUser: GoogleUserInfo,
  tokens: GoogleOAuthTokens,
): Promise<OAuthCallbackResult> {
  const expiresAt =
    typeof tokens.expires_in === 'number'
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null

  const oauthRow = await oauthQueries.findOAuthAccount('google', googleUser.sub)
  let user: User
  let isNewUser = false

  if (oauthRow) {
    const loaded = await usersQueries.findUserById(oauthRow.userId)
    if (!loaded) {
      oauthFail(400, 'INVALID_REQUEST', 'OAuth account is not linked to a valid user')
    }
    user = loaded
    await oauthQueries.upsertOAuthAccount({
      userId: user.id,
      provider: 'google',
      providerAccountId: googleUser.sub,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      accessTokenExpiresAt: expiresAt,
      scope: tokens.scope ?? null,
      rawProfile: googleUser,
    })
  } else {
    const existing = await usersQueries.findUserByEmail(googleUser.email)
    if (existing) {
      user = existing
      await oauthQueries.upsertOAuthAccount({
        userId: user.id,
        provider: 'google',
        providerAccountId: googleUser.sub,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        accessTokenExpiresAt: expiresAt,
        scope: tokens.scope ?? null,
        rawProfile: googleUser,
      })
    } else {
      const created = await usersQueries.createUser({
        email: googleUser.email,
        fullName: googleUser.name || googleUser.email,
        emailVerifiedAt: new Date(),
        passwordHash: null,
        status: 'active',
        avatarUrl: googleUser.picture ?? null,
      })
      user = created
      isNewUser = true
      await oauthQueries.upsertOAuthAccount({
        userId: user.id,
        provider: 'google',
        providerAccountId: googleUser.sub,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        accessTokenExpiresAt: expiresAt,
        scope: tokens.scope ?? null,
        rawProfile: googleUser,
      })
    }
  }

  if (user.status === 'suspended') {
    oauthFail(403, 'ACCOUNT_SUSPENDED', 'This account has been suspended')
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    const retryAfter = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000)
    oauthFail(423, 'ACCOUNT_LOCKED', 'Account is temporarily locked', [
      { field: 'retryAfter', message: String(retryAfter) },
    ])
  }

  const mfa = await mfaQueries.findMfaByUserId(user.id)
  if (mfa?.isEnabled) {
    const mfaTempToken = await signMfaPendingToken(user.id)
    return { requiresMfa: true, mfaTempToken }
  }

  const tokenPair = await generateTokenPair({
    id: user.id,
    role: user.role,
    planTier: user.planTier,
    email: user.email,
  })
  return { user, isNewUser, tokenPair }
}
