import { Hono } from 'hono'

import { env } from '../config/env.js'
import * as refreshQueries from '../db/queries/refreshTokens.queries.js'
import * as usersQueries from '../db/queries/users.queries.js'
import { err, ok } from '../lib/response.js'
import {
  exchangeCodeForTokens,
  generateAuthUrl,
  handleOAuthCallback,
  isOAuthRouteError,
  type OAuthCallbackSuccess,
} from '../services/oauth.service.js'
import { hashToken } from '../services/password.service.js'

const oauth = new Hono()

oauth.get('/oauth/google', async (c) => {
  try {
    const { url, state } = await generateAuthUrl()
    return ok(c, { authUrl: url, state })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to start Google sign-in'
    console.error('[auth-service] OAuth generateAuthUrl failed:', e)
    return err(c, 500, 'INTERNAL_ERROR', msg)
  }
})

oauth.get('/oauth/google/callback', async (c) => {
  const oauthError = c.req.query('error')
  if (oauthError) {
    const frontend = env.FRONTEND_APP_URL.replace(/\/$/, '')
    const description = c.req.query('error_description') ?? oauthError
    return c.redirect(
      `${frontend}/auth/callback?error=${encodeURIComponent(oauthError)}&error_description=${encodeURIComponent(description)}`,
      302,
    )
  }

  const code = c.req.query('code')
  const state = c.req.query('state')
  if (!code || !state) {
    return err(c, 400, 'INVALID_REQUEST', 'Missing code or state parameter')
  }

  try {
    const { userInfo, tokens } = await exchangeCodeForTokens(code, state)
    const result = await handleOAuthCallback(userInfo, tokens)

    if ('requiresMfa' in result && result.requiresMfa) {
      return ok(c, { requiresMfa: true, mfaTempToken: result.mfaTempToken })
    }

    const { user, isNewUser, tokenPair } = result as OAuthCallbackSuccess
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      c.req.header('x-real-ip') ??
      'unknown'
    const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TOKEN_TTL * 1000)
    await refreshQueries.createRefreshToken({
      userId: user.id,
      tokenHash: hashToken(tokenPair.refreshToken),
      deviceInfo: { ua: c.req.header('user-agent') ?? '', ip },
      expiresAt,
    })
    await usersQueries.updateLastActive(user.id)

    return ok(c, {
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      expiresIn: tokenPair.expiresIn,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        planTier: user.planTier,
      },
      isNewUser,
    })
  } catch (e: unknown) {
    if (isOAuthRouteError(e)) {
      return err(c, e.status, e.code, e.message, e.details)
    }
    if (e instanceof Error && e.message === 'Invalid OAuth state') {
      return err(c, 400, 'INVALID_REQUEST', e.message)
    }
    if (
      e instanceof Error &&
      (e.message.startsWith('Google ') || e.message.includes('Google token'))
    ) {
      console.error('[auth-service] Google OAuth token/userinfo error:', e)
      return err(c, 502, 'BAD_GATEWAY', 'Unable to complete Google sign-in')
    }
    console.error('[auth-service] OAuth callback failed:', e)
    throw e
  }
})

export default oauth
