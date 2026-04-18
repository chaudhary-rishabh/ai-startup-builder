import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import * as dbLib from '../../src/lib/db.js'
import type { User } from '../../src/db/schema.js'
import { hashPassword, hashToken } from '../../src/services/password.service.js'
import { signRefreshToken } from '../../src/services/jwt.service.js'

const usersMocks = vi.hoisted(() => ({
  findUserByEmail: vi.fn(),
  createUser: vi.fn(),
  findUserById: vi.fn(),
  findUserByEmailVerificationToken: vi.fn(),
  updateUser: vi.fn(),
  incrementFailedLoginAttempts: vi.fn(),
  resetFailedLoginAttempts: vi.fn(),
  updateLastActive: vi.fn(),
  lockUserAccount: vi.fn(),
}))

const refreshMocks = vi.hoisted(() => ({
  findRefreshToken: vi.fn(),
  createRefreshToken: vi.fn(),
  revokeRefreshToken: vi.fn(),
  revokeAllUserTokens: vi.fn(),
}))

const mfaMocks = vi.hoisted(() => ({
  findMfaByUserId: vi.fn(),
}))

const bruteMocks = vi.hoisted(() => ({
  checkBruteForce: vi.fn().mockResolvedValue({ blocked: false }),
  clearAttempts: vi.fn(),
  recordFailedAttempt: vi.fn(),
}))

const redisMocks = vi.hoisted(() => {
  const xadd = vi.fn().mockResolvedValue('1-0')
  return {
    xadd,
    getRedis: vi.fn(() => ({ xadd })),
  }
})

vi.mock('../../src/db/queries/users.queries.js', () => usersMocks)
vi.mock('../../src/db/queries/refreshTokens.queries.js', () => refreshMocks)
vi.mock('../../src/db/queries/mfaCredentials.queries.js', () => mfaMocks)

vi.mock('../../src/services/bruteForce.service.js', () => bruteMocks)

vi.mock('../../src/services/redis.service.js', () => ({
  getRedis: redisMocks.getRedis,
  bruteForceKey: (ip: string) => `auth:brute:${ip}`,
  refreshTokenKey: (h: string) => `auth:rt:${h}`,
  sessionKey: (id: string) => `auth:session:${id}`,
  emailVerifyKey: (t: string) => `auth:verify:${t}`,
  setRedisForTests: vi.fn(),
}))

const { createApp } = await import('../../src/app.js')

function baseUser(overrides: Partial<User> = {}): User {
  const now = new Date()
  return {
    id: 'user-1',
    email: 'u@test.com',
    emailVerifiedAt: null,
    passwordHash: null,
    fullName: 'User One',
    avatarUrl: null,
    role: 'user',
    planTier: 'free',
    status: 'active',
    onboardingCompleted: false,
    lastActiveAt: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    emailVerificationToken: null,
    passwordResetToken: null,
    passwordResetExpiresAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  }
}

describe('auth routes', () => {
  let app: ReturnType<typeof createApp>
  let loginPasswordHash: string

  beforeAll(async () => {
    loginPasswordHash = await hashPassword('Test123!')
  })

  beforeEach(() => {
    vi.clearAllMocks()
    bruteMocks.checkBruteForce.mockResolvedValue({ blocked: false })
    redisMocks.xadd.mockResolvedValue('1-0')
    app = createApp()
    mfaMocks.findMfaByUserId.mockResolvedValue(undefined)
    refreshMocks.createRefreshToken.mockResolvedValue({
      id: 'rt-row-1',
      userId: 'user-1',
      tokenHash: 'h',
      deviceInfo: null,
      expiresAt: new Date(Date.now() + 86_400_000),
      revokedAt: null,
      replacedByTokenId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  })

  it('POST /auth/register when IP is brute-force blocked → 429', async () => {
    bruteMocks.checkBruteForce.mockResolvedValue({ blocked: true, retryAfter: 120 })

    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'new@test.com',
        password: 'Test123!',
        fullName: 'Test',
        role: 'FOUNDER',
      }),
    })

    expect(res.status).toBe(429)
    const json = (await res.json()) as { error: { code: string } }
    expect(json.error.code).toBe('RATE_LIMITED')
  })

  it('POST /auth/register with valid body → 201', async () => {
    usersMocks.findUserByEmail.mockResolvedValue(undefined)
    usersMocks.createUser.mockResolvedValue(
      baseUser({
        id: 'new-id',
        email: 'test@test.com',
        fullName: 'Test',
        status: 'pending_verification',
      }),
    )

    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@test.com',
        password: 'Test123!',
        fullName: 'Test',
        role: 'FOUNDER',
      }),
    })

    expect(res.status).toBe(201)
    const json = (await res.json()) as {
      success: boolean
      data: { userId: string; email: string; message: string }
    }
    expect(json.success).toBe(true)
    expect(json.data.userId).toBe('new-id')
    expect(json.data.email).toBe('test@test.com')
  })

  it('POST /auth/register returns 201 even when Redis stream publish fails', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    redisMocks.xadd.mockRejectedValueOnce(new Error('redis unavailable'))
    usersMocks.findUserByEmail.mockResolvedValue(undefined)
    usersMocks.createUser.mockResolvedValue(
      baseUser({
        id: 'new-id-2',
        email: 'redisfail@test.com',
        fullName: 'Test',
        status: 'pending_verification',
      }),
    )

    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'redisfail@test.com',
        password: 'Test123!',
        fullName: 'Test',
        role: 'FOUNDER',
      }),
    })

    expect(res.status).toBe(201)
    errSpy.mockRestore()
  })

  it('POST /auth/register with duplicate email → 409', async () => {
    usersMocks.findUserByEmail.mockResolvedValue(baseUser({ email: 'taken@test.com' }))

    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'taken@test.com',
        password: 'Test123!',
        fullName: 'Test',
        role: 'FOUNDER',
      }),
    })

    expect(res.status).toBe(409)
    const json = (await res.json()) as { success: boolean; error: { code: string } }
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('CONFLICT')
  })

  it('POST /auth/register with invalid password → 422', async () => {
    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'a@b.com',
        password: 'weak',
        fullName: 'Test',
        role: 'FOUNDER',
      }),
    })

    expect(res.status).toBe(422)
    const json = (await res.json()) as { success: boolean; error: { code: string } }
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('POST /auth/login with wrong password → 401', async () => {
    usersMocks.findUserByEmail.mockResolvedValue(
      baseUser({ passwordHash: loginPasswordHash, emailVerifiedAt: new Date() }),
    )

    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'u@test.com',
        password: 'WrongPass1!',
      }),
    })

    expect(res.status).toBe(401)
    const json = (await res.json()) as { error: { code: string } }
    expect(json.error.code).toBe('INVALID_CREDENTIALS')
  })

  it('POST /auth/login with suspended account → 403', async () => {
    usersMocks.findUserByEmail.mockResolvedValue(
      baseUser({
        passwordHash: loginPasswordHash,
        emailVerifiedAt: new Date(),
        status: 'suspended',
      }),
    )

    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'u@test.com',
        password: 'Test123!',
      }),
    })

    expect(res.status).toBe(403)
    const json = (await res.json()) as { error: { code: string } }
    expect(json.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('POST /auth/login when email is not verified → 403', async () => {
    usersMocks.findUserByEmail.mockResolvedValue(
      baseUser({
        passwordHash: loginPasswordHash,
        emailVerifiedAt: null,
        status: 'pending_verification',
      }),
    )

    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'u@test.com',
        password: 'Test123!',
      }),
    })

    expect(res.status).toBe(403)
    const json = (await res.json()) as { error: { code: string } }
    expect(json.error.code).toBe('EMAIL_NOT_VERIFIED')
  })

  it('POST /auth/login with MFA and TOTP code returns 501 until P8', async () => {
    usersMocks.findUserByEmail.mockResolvedValue(
      baseUser({
        passwordHash: loginPasswordHash,
        emailVerifiedAt: new Date(),
      }),
    )
    mfaMocks.findMfaByUserId.mockResolvedValue({
      id: 'mfa-1',
      userId: 'user-1',
      totpSecret: 'enc',
      backupCodes: [],
      isEnabled: true,
      enabledAt: new Date(),
      lastUsedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'u@test.com',
        password: 'Test123!',
        totpCode: '123456',
      }),
    })

    expect(res.status).toBe(501)
  })

  it('POST /auth/login with MFA enabled returns MFA challenge', async () => {
    usersMocks.findUserByEmail.mockResolvedValue(
      baseUser({
        passwordHash: loginPasswordHash,
        emailVerifiedAt: new Date(),
      }),
    )
    mfaMocks.findMfaByUserId.mockResolvedValue({
      id: 'mfa-1',
      userId: 'user-1',
      totpSecret: 'enc',
      backupCodes: [],
      isEnabled: true,
      enabledAt: new Date(),
      lastUsedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'u@test.com',
        password: 'Test123!',
      }),
    })

    expect(res.status).toBe(200)
    const json = (await res.json()) as { data: { requiresMfa?: boolean; mfaToken?: string } }
    expect(json.data.requiresMfa).toBe(true)
    expect(json.data.mfaToken).toBeTruthy()
  })

  it('POST /auth/login with locked account → 423', async () => {
    usersMocks.findUserByEmail.mockResolvedValue(
      baseUser({
        passwordHash: loginPasswordHash,
        emailVerifiedAt: new Date(),
        lockedUntil: new Date(Date.now() + 120_000),
      }),
    )

    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'u@test.com',
        password: 'Test123!',
      }),
    })

    expect(res.status).toBe(423)
    const json = (await res.json()) as { error: { code: string } }
    expect(json.error.code).toBe('ACCOUNT_LOCKED')
  })

  it('POST /auth/login success → 200 with tokens', async () => {
    usersMocks.findUserByEmail.mockResolvedValue(
      baseUser({
        passwordHash: loginPasswordHash,
        emailVerifiedAt: new Date(),
      }),
    )

    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'u@test.com',
        password: 'Test123!',
      }),
    })

    expect(res.status).toBe(200)
    const json = (await res.json()) as {
      success: boolean
      data: { accessToken: string; refreshToken: string; expiresIn: number; user: { id: string } }
    }
    expect(json.success).toBe(true)
    expect(json.data.accessToken).toBeTruthy()
    expect(json.data.refreshToken).toBeTruthy()
    expect(json.data.user.id).toBe('user-1')
  })

  it('POST /auth/refresh with valid token → 200', async () => {
    const rt = await signRefreshToken({ sub: 'user-1' })
    const th = hashToken(rt)
    refreshMocks.findRefreshToken.mockResolvedValue({
      id: 'stored-rt',
      userId: 'user-1',
      tokenHash: th,
      deviceInfo: { ua: 't', ip: '1' },
      expiresAt: new Date(Date.now() + 3600_000),
      revokedAt: null,
      replacedByTokenId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    usersMocks.findUserById.mockResolvedValue(baseUser())
    refreshMocks.createRefreshToken.mockResolvedValue({
      id: 'rt-row-2',
      userId: 'user-1',
      tokenHash: 'newhash',
      deviceInfo: { ua: 't', ip: '1' },
      expiresAt: new Date(Date.now() + 86_400_000),
      revokedAt: null,
      replacedByTokenId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const res = await app.request('/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    })

    expect(res.status).toBe(200)
    const json = (await res.json()) as { data: { accessToken: string; refreshToken: string } }
    expect(json.data.accessToken).toBeTruthy()
    expect(json.data.refreshToken).toBeTruthy()
    expect(refreshMocks.revokeRefreshToken).toHaveBeenCalled()
  })

  it('POST /auth/refresh with malformed token → 401 INVALID_TOKEN', async () => {
    const res = await app.request('/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'not-a-valid-jwt' }),
    })

    expect(res.status).toBe(401)
    const json = (await res.json()) as { error: { code: string } }
    expect(json.error.code).toBe('INVALID_TOKEN')
  })

  it('POST /auth/refresh with expired stored token → 401 TOKEN_EXPIRED', async () => {
    const rt = await signRefreshToken({ sub: 'user-1' })
    const th = hashToken(rt)
    refreshMocks.findRefreshToken.mockResolvedValue({
      id: 'stored-rt',
      userId: 'user-1',
      tokenHash: th,
      deviceInfo: null,
      expiresAt: new Date(Date.now() - 60_000),
      revokedAt: null,
      replacedByTokenId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const res = await app.request('/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    })

    expect(res.status).toBe(401)
    const json = (await res.json()) as { error: { code: string } }
    expect(json.error.code).toBe('TOKEN_EXPIRED')
  })

  it('POST /auth/refresh when user missing → 401 INVALID_TOKEN', async () => {
    const rt = await signRefreshToken({ sub: 'user-1' })
    const th = hashToken(rt)
    refreshMocks.findRefreshToken.mockResolvedValue({
      id: 'stored-rt',
      userId: 'user-1',
      tokenHash: th,
      deviceInfo: null,
      expiresAt: new Date(Date.now() + 3600_000),
      revokedAt: null,
      replacedByTokenId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    usersMocks.findUserById.mockResolvedValue(undefined)

    const res = await app.request('/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    })

    expect(res.status).toBe(401)
    const json = (await res.json()) as { error: { code: string } }
    expect(json.error.code).toBe('INVALID_TOKEN')
  })

  it('POST /auth/refresh with suspended user → 403', async () => {
    const rt = await signRefreshToken({ sub: 'user-1' })
    const th = hashToken(rt)
    refreshMocks.findRefreshToken.mockResolvedValue({
      id: 'stored-rt',
      userId: 'user-1',
      tokenHash: th,
      deviceInfo: null,
      expiresAt: new Date(Date.now() + 3600_000),
      revokedAt: null,
      replacedByTokenId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    usersMocks.findUserById.mockResolvedValue(baseUser({ status: 'suspended' }))

    const res = await app.request('/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    })

    expect(res.status).toBe(403)
  })

  it('POST /auth/refresh with revoked token → 401 TOKEN_REVOKED', async () => {
    const rt = await signRefreshToken({ sub: 'user-1' })
    refreshMocks.findRefreshToken.mockResolvedValue(undefined)

    const res = await app.request('/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    })

    expect(res.status).toBe(401)
    const json = (await res.json()) as { error: { code: string } }
    expect(json.error.code).toBe('TOKEN_REVOKED')
  })

  it('POST /auth/logout → 200', async () => {
    const res = await app.request('/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'any' }),
    })

    expect(res.status).toBe(200)
    const json = (await res.json()) as { data: { message: string } }
    expect(json.data.message).toContain('Logged out')
  })

  it('POST /auth/verify-email with valid token → 200', async () => {
    usersMocks.findUserByEmailVerificationToken.mockResolvedValue(
      baseUser({ emailVerificationToken: 'tok', emailVerifiedAt: null, status: 'pending_verification' }),
    )
    usersMocks.updateUser.mockResolvedValue(baseUser({ emailVerifiedAt: new Date(), status: 'active' }))

    const res = await app.request('/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'tok' }),
    })

    expect(res.status).toBe(200)
  })

  it('POST /auth/verify-email when already verified → 200', async () => {
    usersMocks.findUserByEmailVerificationToken.mockResolvedValue(
      baseUser({
        emailVerificationToken: 'tok',
        emailVerifiedAt: new Date(),
        status: 'active',
      }),
    )

    const res = await app.request('/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'tok' }),
    })

    expect(res.status).toBe(200)
    const json = (await res.json()) as { data: { message: string } }
    expect(json.data.message).toContain('already verified')
  })

  it('POST /auth/verify-email with invalid token → 400', async () => {
    usersMocks.findUserByEmailVerificationToken.mockResolvedValue(undefined)

    const res = await app.request('/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'bad' }),
    })

    expect(res.status).toBe(400)
  })

  it('POST /auth/forgot-password → 200 regardless of email', async () => {
    usersMocks.findUserByEmail.mockResolvedValue(undefined)
    const res1 = await app.request('/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'none@test.com' }),
    })
    expect(res1.status).toBe(200)

    usersMocks.findUserByEmail.mockResolvedValue(baseUser())
    const res2 = await app.request('/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'u@test.com' }),
    })
    expect(res2.status).toBe(200)
  })

  it('POST /auth/forgot-password returns 200 when Redis publish fails', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    redisMocks.xadd.mockRejectedValueOnce(new Error('redis unavailable'))
    usersMocks.findUserByEmail.mockResolvedValue(baseUser())

    const res = await app.request('/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'u@test.com' }),
    })

    expect(res.status).toBe(200)
    errSpy.mockRestore()
  })

  it('POST /auth/reset-password with unknown token → 400 INVALID_TOKEN', async () => {
    const spy = vi.spyOn(dbLib, 'getDb').mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }),
    } as never)

    const res = await app.request('/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: 'unknown-plain',
        newPassword: 'Newpass1!',
      }),
    })

    spy.mockRestore()

    expect(res.status).toBe(400)
    const json = (await res.json()) as { error: { code: string } }
    expect(json.error.code).toBe('INVALID_TOKEN')
  })

  it('POST /auth/reset-password success → 200', async () => {
    const plainToken = 'valid-reset-plain'
    const tokenHash = hashToken(plainToken)
    const spy = vi.spyOn(dbLib, 'getDb').mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () =>
              Promise.resolve([
                {
                  id: 'u1',
                  passwordResetToken: tokenHash,
                  passwordResetExpiresAt: new Date(Date.now() + 3600_000),
                },
              ]),
          }),
        }),
      }),
    } as never)

    usersMocks.updateUser.mockResolvedValue(baseUser())

    const res = await app.request('/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: plainToken,
        newPassword: 'Newpass1!',
      }),
    })

    spy.mockRestore()

    expect(res.status).toBe(200)
    expect(usersMocks.updateUser).toHaveBeenCalled()
    expect(refreshMocks.revokeAllUserTokens).toHaveBeenCalledWith('u1')
  })

  it('POST /auth/reset-password with expired token → 400 TOKEN_EXPIRED', async () => {
    const plainToken = 'plain-reset-secret'
    const tokenHash = hashToken(plainToken)
    const spy = vi.spyOn(dbLib, 'getDb').mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () =>
              Promise.resolve([
                {
                  id: 'u1',
                  passwordResetToken: tokenHash,
                  passwordResetExpiresAt: new Date(Date.now() - 60_000),
                },
              ]),
          }),
        }),
      }),
    } as never)

    const res = await app.request('/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: plainToken,
        newPassword: 'Newpass1!',
      }),
    })

    spy.mockRestore()

    expect(res.status).toBe(400)
    const json = (await res.json()) as { error: { code: string } }
    expect(json.error.code).toBe('TOKEN_EXPIRED')
  })
})
