import { Verify2FASchema, Setup2FASchema } from '@repo/validators'
import { zValidator } from '@hono/zod-validator'
import type { MiddlewareHandler } from 'hono'
import { Hono } from 'hono'
import { z } from 'zod'

import { env } from '../config/env.js'
import * as mfaQueries from '../db/queries/mfaCredentials.queries.js'
import * as refreshQueries from '../db/queries/refreshTokens.queries.js'
import * as usersQueries from '../db/queries/users.queries.js'
import { err, ok } from '../lib/response.js'
import { decrypt, encrypt } from '../services/encryption.service.js'
import { generateTokenPair, verifyAccessToken, verifyMfaPendingToken } from '../services/jwt.service.js'
import { comparePassword, hashToken } from '../services/password.service.js'
import {
  generateBackupCodes,
  generateTotpSecret,
  verifyTotpCode,
} from '../services/totp.service.js'

const MfaVerifyBodySchema = Verify2FASchema.extend({
  mfaTempToken: z.string().min(1).optional(),
})

const Disable2FABodySchema = z.object({
  password: z.string().min(1),
  totpCode: z.string().length(6),
})

export const requireAuth: MiddlewareHandler = async (c, next) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return err(c, 401, 'UNAUTHORIZED', 'Missing or invalid authorization header')
  }
  const token = auth.slice(7)
  try {
    const payload = await verifyAccessToken(token)
    const sub = payload.sub
    if (typeof sub !== 'string') {
      return err(c, 401, 'UNAUTHORIZED', 'Invalid token')
    }
    c.set('userId' as never, sub)
    await next()
  } catch {
    return err(c, 401, 'UNAUTHORIZED', 'Invalid or expired token')
  }
}

const mfa = new Hono()

mfa.post(
  '/2fa/setup',
  requireAuth,
  zValidator('json', Setup2FASchema, (r) => {
    if (!r.success) throw r.error
  }),
  async (c) => {
    const userId = c.get('userId' as never) as string
    const body = c.req.valid('json')

    const user = await usersQueries.findUserById(userId)
    if (!user) {
      return err(c, 404, 'NOT_FOUND', 'User not found')
    }

    const passwordOk = await comparePassword(body.password, user.passwordHash ?? '')
    if (!passwordOk) {
      return err(c, 401, 'INVALID_CREDENTIALS', 'Invalid password')
    }

    const existing = await mfaQueries.findMfaByUserId(userId)
    if (existing?.isEnabled) {
      return err(c, 409, 'CONFLICT', '2FA is already enabled')
    }

    const { secret, otpAuthUrl, qrCodeDataUrl } = await generateTotpSecret(user.email)
    const encryptedSecret = encrypt(secret)
    const { plaintext, hashed } = generateBackupCodes(8)

    if (existing) {
      await mfaQueries.updateMfaCredential(userId, {
        totpSecret: encryptedSecret,
        backupCodes: hashed,
        isEnabled: false,
        enabledAt: null,
      })
    } else {
      await mfaQueries.createMfaCredential({
        userId,
        totpSecret: encryptedSecret,
        backupCodes: hashed,
        isEnabled: false,
      })
    }

    return ok(c, {
      qrCodeDataUrl,
      otpAuthUrl,
      backupCodes: plaintext,
      message: 'Scan the QR code and enter a code to complete setup',
    })
  },
)

mfa.post(
  '/2fa/verify',
  zValidator('json', MfaVerifyBodySchema, (r) => {
    if (!r.success) throw r.error
  }),
  async (c) => {
    const body = c.req.valid('json')

    let userId: string
    let authSource: 'jwt' | 'mfa_temp'

    const authHeader = c.req.header('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const payload = await verifyAccessToken(authHeader.slice(7))
        if (typeof payload.sub !== 'string') {
          return err(c, 401, 'UNAUTHORIZED', 'Invalid token')
        }
        userId = payload.sub
        authSource = 'jwt'
      } catch {
        if (body.mfaTempToken) {
          try {
            userId = (await verifyMfaPendingToken(body.mfaTempToken)).sub
            authSource = 'mfa_temp'
          } catch {
            return err(c, 401, 'UNAUTHORIZED', 'Invalid or expired MFA temporary token')
          }
        } else {
          return err(c, 401, 'UNAUTHORIZED', 'Invalid or expired token')
        }
      }
    } else if (body.mfaTempToken) {
      try {
        userId = (await verifyMfaPendingToken(body.mfaTempToken)).sub
        authSource = 'mfa_temp'
      } catch {
        return err(c, 401, 'UNAUTHORIZED', 'Invalid or expired MFA temporary token')
      }
    } else {
      return err(c, 401, 'UNAUTHORIZED', 'Authentication required')
    }

    const mfaRow = await mfaQueries.findMfaByUserId(userId)
    if (!mfaRow) {
      return err(c, 400, 'INVALID_REQUEST', 'MFA not set up')
    }

    let secretPlain: string
    try {
      secretPlain = decrypt(mfaRow.totpSecret)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Decryption failed'
      console.error('[auth-service] MFA decrypt failed:', e)
      return err(c, 500, 'INTERNAL_ERROR', msg)
    }

    if (!verifyTotpCode(secretPlain, body.totpCode)) {
      return err(c, 401, 'INVALID_TOTP_CODE', 'The verification code is incorrect')
    }

    if (!mfaRow.isEnabled) {
      if (authSource !== 'jwt') {
        return err(c, 400, 'INVALID_REQUEST', 'Use your access token to complete 2FA setup')
      }
      await mfaQueries.enableMfa(userId)
      await mfaQueries.updateLastUsed(userId)
      return ok(c, { message: '2FA enabled successfully' })
    }

    if (authSource !== 'mfa_temp') {
      return err(c, 400, 'INVALID_REQUEST', 'Use the MFA temporary token from sign-in to verify 2FA')
    }

    const user = await usersQueries.findUserById(userId)
    if (!user) {
      return err(c, 404, 'NOT_FOUND', 'User not found')
    }

    await mfaQueries.updateLastUsed(userId)
    const tokens = await generateTokenPair({
      id: user.id,
      role: user.role,
      planTier: user.planTier,
      email: user.email,
    })
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      c.req.header('x-real-ip') ??
      'unknown'
    const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TOKEN_TTL * 1000)
    await refreshQueries.createRefreshToken({
      userId: user.id,
      tokenHash: hashToken(tokens.refreshToken),
      deviceInfo: { ua: c.req.header('user-agent') ?? '', ip },
      expiresAt,
    })
    await usersQueries.updateLastActive(user.id)

    return ok(c, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    })
  },
)

mfa.delete(
  '/2fa/disable',
  requireAuth,
  zValidator('json', Disable2FABodySchema, (r) => {
    if (!r.success) throw r.error
  }),
  async (c) => {
    const userId = c.get('userId' as never) as string
    const body = c.req.valid('json')

    const user = await usersQueries.findUserById(userId)
    if (!user) {
      return err(c, 404, 'NOT_FOUND', 'User not found')
    }

    const passwordOk = await comparePassword(body.password, user.passwordHash ?? '')
    if (!passwordOk) {
      return err(c, 401, 'INVALID_CREDENTIALS', 'Invalid password')
    }

    const mfaRow = await mfaQueries.findMfaByUserId(userId)
    if (!mfaRow?.isEnabled) {
      return err(c, 400, 'INVALID_REQUEST', 'Two-factor authentication is not enabled')
    }

    let secretPlain: string
    try {
      secretPlain = decrypt(mfaRow.totpSecret)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Decryption failed'
      console.error('[auth-service] MFA decrypt failed:', e)
      return err(c, 500, 'INTERNAL_ERROR', msg)
    }

    if (!verifyTotpCode(secretPlain, body.totpCode)) {
      return err(c, 401, 'INVALID_TOTP_CODE', 'The verification code is incorrect')
    }

    await mfaQueries.disableMfa(userId)
    return ok(c, { message: '2FA disabled' })
  },
)

export default mfa
