import { withActive } from '@repo/db'
import type { UserRegisteredEvent } from '@repo/types'
import {
  ForgotPasswordSchema,
  LoginSchema,
  RefreshTokenSchema,
  RegisterSchema,
  ResetPasswordSchema,
  VerifyEmailSchema,
} from '@repo/validators'
import { zValidator } from '@hono/zod-validator'
import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'

import { env } from '../config/env.js'
import * as mfaQueries from '../db/queries/mfaCredentials.queries.js'
import * as refreshQueries from '../db/queries/refreshTokens.queries.js'
import * as usersQueries from '../db/queries/users.queries.js'
import { users } from '../db/schema.js'
import { getDb } from '../lib/db.js'
import { created, err, ok } from '../lib/response.js'
import { checkBruteForce, clearAttempts, recordFailedAttempt } from '../services/bruteForce.service.js'
import {
  generateTokenPair,
  signMfaPendingToken,
  verifyRefreshToken,
} from '../services/jwt.service.js'
import {
  comparePassword,
  generateSecureToken,
  hashPassword,
  hashToken,
} from '../services/password.service.js'
import { publishUserPasswordReset, publishUserRegistered } from '../events/publisher.js'

const LogoutBodySchema = z.object({
  refreshToken: z.string().min(1),
})

function clientIp(c: { req: { header: (n: string) => string | undefined } }): string {
  const xff = c.req.header('x-forwarded-for')
  if (xff) return xff.split(',')[0]?.trim() ?? 'unknown'
  return c.req.header('x-real-ip') ?? 'unknown'
}

const auth = new Hono()

auth.post(
  '/register',
  zValidator('json', RegisterSchema, (r, _c) => {
    if (!r.success) throw r.error
  }),
  async (c) => {
    const body = c.req.valid('json')
    const ip = clientIp(c)

    const brute = await checkBruteForce(ip)
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

    const existing = await usersQueries.findUserByEmail(body.email)
    if (existing) {
      return err(c, 409, 'CONFLICT', 'An account with this email already exists')
    }

    const passwordHash = await hashPassword(body.password)
    const emailVerificationToken = generateSecureToken()
    const userId = randomUUID()

    const user = await usersQueries.createUser({
      id: userId,
      email: body.email,
      passwordHash,
      fullName: body.fullName,
      role: 'user',
      planTier: 'free',
      status: 'pending_verification',
      emailVerificationToken,
    })

    const event: UserRegisteredEvent = {
      userId: user.id,
      email: user.email,
      name: user.fullName,
      plan: 'free',
      createdAt: user.createdAt.toISOString(),
    }

    try {
      await publishUserRegistered(event)
    } catch (e) {
      console.error('[auth-service] Failed to publish user.registered event:', e)
    }

    return created(c, {
      userId: user.id,
      email: user.email,
      message: 'Verification email sent',
    })
  },
)

auth.post(
  '/login',
  zValidator('json', LoginSchema, (r, _c) => {
    if (!r.success) throw r.error
  }),
  async (c) => {
    const body = c.req.valid('json')
    const ip = clientIp(c)

    const brute = await checkBruteForce(ip)
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

    const user = await usersQueries.findUserByEmail(body.email)
    if (!user) {
      await recordFailedAttempt(ip)
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
      await recordFailedAttempt(ip)
      await usersQueries.incrementFailedLoginAttempts(user.id)
      const after = await usersQueries.findUserById(user.id)
      if (after && after.failedLoginAttempts >= env.BRUTE_FORCE_MAX_ATTEMPTS) {
        await usersQueries.lockUserAccount(
          user.id,
          new Date(Date.now() + env.BRUTE_FORCE_LOCK_MINUTES * 60 * 1000),
        )
      }
      return err(c, 401, 'INVALID_CREDENTIALS', 'Invalid email or password')
    }

    const mfa = await mfaQueries.findMfaByUserId(user.id)
    if (mfa?.isEnabled) {
      if (!body.totpCode) {
        const mfaToken = await signMfaPendingToken(user.id)
        return ok(c, { requiresMfa: true, mfaToken })
      }
      return err(
        c,
        501,
        'NOT_IMPLEMENTED',
        'On-device TOTP verification is delivered in a later release. Use the MFA verification flow when available.',
      )
    }

    if (!user.emailVerifiedAt) {
      return err(c, 403, 'EMAIL_NOT_VERIFIED', 'Please verify your email before signing in')
    }

    await clearAttempts(ip)
    await usersQueries.resetFailedLoginAttempts(user.id)

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
      deviceInfo: body.deviceInfo ?? {
        ua: c.req.header('user-agent') ?? '',
        ip,
      },
      expiresAt,
    })

    await usersQueries.updateLastActive(user.id)

    return ok(c, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        planTier: user.planTier,
        onboardingCompleted: user.onboardingCompleted,
      },
    })
  },
)

auth.post(
  '/refresh',
  zValidator('json', RefreshTokenSchema, (r, _c) => {
    if (!r.success) throw r.error
  }),
  async (c) => {
    const body = c.req.valid('json')

    let payload: { sub?: string }
    try {
      payload = await verifyRefreshToken(body.refreshToken)
    } catch {
      return err(c, 401, 'INVALID_TOKEN', 'Invalid or malformed refresh token')
    }

    const sub = typeof payload.sub === 'string' ? payload.sub : undefined
    if (!sub) {
      return err(c, 401, 'INVALID_TOKEN', 'Invalid or malformed refresh token')
    }

    const tokenHash = hashToken(body.refreshToken)
    const stored = await refreshQueries.findRefreshToken(tokenHash)
    if (!stored) {
      return err(c, 401, 'TOKEN_REVOKED', 'Refresh token is no longer valid')
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      return err(c, 401, 'TOKEN_EXPIRED', 'Refresh token has expired')
    }

    const user = await usersQueries.findUserById(stored.userId)
    if (!user) {
      return err(c, 401, 'INVALID_TOKEN', 'Invalid or malformed refresh token')
    }

    if (user.status === 'suspended') {
      return err(c, 403, 'ACCOUNT_SUSPENDED', 'This account has been suspended')
    }

    const tokens = await generateTokenPair({
      id: user.id,
      role: user.role,
      planTier: user.planTier,
      email: user.email,
    })

    const newRow = await refreshQueries.createRefreshToken({
      userId: user.id,
      tokenHash: hashToken(tokens.refreshToken),
      deviceInfo: stored.deviceInfo ?? undefined,
      expiresAt: new Date(Date.now() + env.JWT_REFRESH_TOKEN_TTL * 1000),
    })

    await refreshQueries.revokeRefreshToken(tokenHash, newRow.id)

    return ok(c, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    })
  },
)

auth.post(
  '/logout',
  zValidator('json', LogoutBodySchema, (r, _c) => {
    if (!r.success) throw r.error
  }),
  async (c) => {
    const body = c.req.valid('json')
    await refreshQueries.revokeRefreshToken(hashToken(body.refreshToken), undefined)
    return ok(c, { message: 'Logged out successfully' })
  },
)

auth.post(
  '/verify-email',
  zValidator('json', VerifyEmailSchema, (r, _c) => {
    if (!r.success) throw r.error
  }),
  async (c) => {
    const { token } = c.req.valid('json')
    const user = await usersQueries.findUserByEmailVerificationToken(token)
    if (!user) {
      return err(c, 400, 'INVALID_TOKEN', 'Invalid or expired verification token')
    }

    if (user.emailVerifiedAt) {
      return ok(c, { message: 'Email already verified' })
    }

    await usersQueries.updateUser(user.id, {
      emailVerifiedAt: new Date(),
      status: 'active',
      emailVerificationToken: null,
    })

    return ok(c, { message: 'Email verified successfully' })
  },
)

auth.post(
  '/forgot-password',
  zValidator('json', ForgotPasswordSchema, (r, _c) => {
    if (!r.success) throw r.error
  }),
  async (c) => {
    const { email } = c.req.valid('json')
    const user = await usersQueries.findUserByEmail(email)

    const message =
      'If an account exists for this email, you will receive password reset instructions shortly.'

    if (user && user.status !== 'suspended') {
      const resetToken = generateSecureToken()
      const tokenHash = hashToken(resetToken)
      const expires = new Date(Date.now() + 60 * 60 * 1000)
      await usersQueries.updateUser(user.id, {
        passwordResetToken: tokenHash,
        passwordResetExpiresAt: expires,
      })

      try {
        await publishUserPasswordReset(user.id)
      } catch (e) {
        console.error('[auth-service] Failed to publish password reset event:', e)
      }
    }

    return ok(c, { message })
  },
)

auth.post(
  '/reset-password',
  zValidator('json', ResetPasswordSchema, (r, _c) => {
    if (!r.success) throw r.error
  }),
  async (c) => {
    const { token, newPassword } = c.req.valid('json')
    const hashed = hashToken(token)

    const rows = await getDb()
      .select()
      .from(users)
      .where(and(eq(users.passwordResetToken, hashed), withActive(users.deletedAt)))
      .limit(1)
    const row = rows[0]

    if (!row) {
      return err(c, 400, 'INVALID_TOKEN', 'Invalid or expired reset token')
    }

    if (!row.passwordResetExpiresAt || row.passwordResetExpiresAt.getTime() <= Date.now()) {
      return err(c, 400, 'TOKEN_EXPIRED', 'This password reset link has expired')
    }

    const newHash = await hashPassword(newPassword)
    await usersQueries.updateUser(row.id, {
      passwordHash: newHash,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
    })

    await refreshQueries.revokeAllUserTokens(row.id)

    return ok(c, {
      message: 'Password reset successfully. Please log in.',
    })
  },
)

export default auth
