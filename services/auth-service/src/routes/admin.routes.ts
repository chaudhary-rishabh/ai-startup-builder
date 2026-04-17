import { AdminLoginSchema } from '@repo/validators'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'

import { env } from '../config/env.js'
import * as mfaQueries from '../db/queries/mfaCredentials.queries.js'
import * as refreshQueries from '../db/queries/refreshTokens.queries.js'
import * as usersQueries from '../db/queries/users.queries.js'
import { err, ok } from '../lib/response.js'
import {
  checkAdminBruteForce,
  clearAdminAttempts,
  recordAdminFailedAttempt,
} from '../services/bruteForce.service.js'
import { decrypt } from '../services/encryption.service.js'
import { generateTokenPair } from '../services/jwt.service.js'
import { comparePassword, hashToken } from '../services/password.service.js'
import { verifyTotpCode } from '../services/totp.service.js'

function clientIp(c: { req: { header: (n: string) => string | undefined } }): string {
  const xff = c.req.header('x-forwarded-for')
  if (xff) return xff.split(',')[0]?.trim() ?? 'unknown'
  return c.req.header('x-real-ip') ?? 'unknown'
}

const admin = new Hono()

admin.post(
  '/login',
  zValidator('json', AdminLoginSchema, (r) => {
    if (!r.success) throw r.error
  }),
  async (c) => {
    const ip = clientIp(c)
    const brute = await checkAdminBruteForce(ip)
    if (brute.blocked) {
      return err(
        c,
        429,
        'RATE_LIMITED',
        'Too many failed attempts. Please try again later.',
        brute.retryAfter !== undefined
          ? [{ field: 'retryAfter', message: String(brute.retryAfter) }]
          : undefined,
      )
    }

    const body = c.req.valid('json')
    const user = await usersQueries.findUserByEmail(body.email)
    if (!user) {
      await recordAdminFailedAttempt(ip)
      return err(c, 401, 'INVALID_CREDENTIALS', 'Invalid email or password')
    }

    if (user.role !== 'admin' && user.role !== 'super_admin') {
      await recordAdminFailedAttempt(ip)
      return err(c, 401, 'INVALID_CREDENTIALS', 'Invalid email or password')
    }

    if (user.status === 'suspended') {
      return err(c, 403, 'ACCOUNT_SUSPENDED', 'This account has been suspended')
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const retryAfter = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000)
      return err(c, 423, 'ACCOUNT_LOCKED', 'Account is temporarily locked', [
        { field: 'retryAfter', message: String(retryAfter) },
      ])
    }

    const passwordOk = await comparePassword(body.password, user.passwordHash ?? '')
    if (!passwordOk) {
      await recordAdminFailedAttempt(ip)
      return err(c, 401, 'INVALID_CREDENTIALS', 'Invalid email or password')
    }

    const mfaRow = await mfaQueries.findMfaByUserId(user.id)
    if (!mfaRow?.isEnabled) {
      return err(
        c,
        403,
        'MFA_REQUIRED',
        'Admin accounts must have 2FA enabled. Please set up 2FA from your account settings first.',
      )
    }

    let secretPlain: string
    try {
      secretPlain = decrypt(mfaRow.totpSecret)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Decryption failed'
      console.error('[auth-service] Admin MFA decrypt failed:', e)
      return err(c, 500, 'INTERNAL_ERROR', msg)
    }

    if (!verifyTotpCode(secretPlain, body.totpCode)) {
      await recordAdminFailedAttempt(ip)
      return err(c, 401, 'INVALID_TOTP_CODE', 'The verification code is incorrect')
    }

    await clearAdminAttempts(ip)
    await usersQueries.resetFailedLoginAttempts(user.id)
    await usersQueries.updateLastActive(user.id)

    const tokens = await generateTokenPair({
      id: user.id,
      role: user.role,
      planTier: user.planTier,
      email: user.email,
    })
    const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TOKEN_TTL * 1000)
    await refreshQueries.createRefreshToken({
      userId: user.id,
      tokenHash: hashToken(tokens.refreshToken),
      deviceInfo: { ua: c.req.header('user-agent') ?? '', ip },
      expiresAt,
    })

    return ok(c, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        planTier: user.planTier,
      },
    })
  },
)

export default admin
