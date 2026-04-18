import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { User } from '../../src/db/schema.js'
import { encrypt } from '../../src/services/encryption.service.js'
import { signAccessToken, signMfaPendingToken } from '../../src/services/jwt.service.js'
import { hashPassword } from '../../src/services/password.service.js'
import * as totpSvc from '../../src/services/totp.service.js'

const userMocks = vi.hoisted(() => ({
  findUserById: vi.fn(),
  updateLastActive: vi.fn(),
}))

const mfaMocks = vi.hoisted(() => ({
  findMfaByUserId: vi.fn(),
  createMfaCredential: vi.fn(),
  updateMfaCredential: vi.fn(),
  enableMfa: vi.fn(),
  updateLastUsed: vi.fn(),
  disableMfa: vi.fn(),
}))

const refreshMocks = vi.hoisted(() => ({
  createRefreshToken: vi.fn(),
}))

vi.mock('../../src/db/queries/users.queries.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/db/queries/users.queries.js')>()
  return {
    ...actual,
    findUserById: userMocks.findUserById,
    updateLastActive: userMocks.updateLastActive,
  }
})

vi.mock('../../src/db/queries/mfaCredentials.queries.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/db/queries/mfaCredentials.queries.js')>()
  return {
    ...actual,
    findMfaByUserId: mfaMocks.findMfaByUserId,
    createMfaCredential: mfaMocks.createMfaCredential,
    updateMfaCredential: mfaMocks.updateMfaCredential,
    enableMfa: mfaMocks.enableMfa,
    updateLastUsed: mfaMocks.updateLastUsed,
    disableMfa: mfaMocks.disableMfa,
  }
})

vi.mock('../../src/db/queries/refreshTokens.queries.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/db/queries/refreshTokens.queries.js')>()
  return {
    ...actual,
    createRefreshToken: refreshMocks.createRefreshToken,
  }
})

const { createApp } = await import('../../src/app.js')

function baseUser(overrides: Partial<User> = {}): User {
  const now = new Date()
  return {
    id: 'mfa-u1',
    email: 'mfa@test.com',
    emailVerifiedAt: new Date(),
    passwordHash: null,
    fullName: 'Mfa User',
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

describe('mfa routes', () => {
  let passwordHash: string
  let app: ReturnType<typeof createApp>

  beforeAll(async () => {
    passwordHash = await hashPassword('MfaPass1!')
  })

  beforeEach(() => {
    vi.clearAllMocks()
    userMocks.updateLastActive.mockResolvedValue(undefined)
    app = createApp()
    refreshMocks.createRefreshToken.mockResolvedValue({
      id: 'rt',
      userId: 'mfa-u1',
      tokenHash: 'h',
      deviceInfo: null,
      expiresAt: new Date(Date.now() + 86_400_000),
      revokedAt: null,
      replacedByTokenId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  })

  it('POST /auth/2fa/setup without auth → 401', async () => {
    const res = await app.request('/auth/2fa/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'x' }),
    })
    expect(res.status).toBe(401)
  })

  it('POST /auth/2fa/setup with wrong password → 401', async () => {
    const token = await signAccessToken({
      sub: 'mfa-u1',
      role: 'user',
      plan: 'free',
      email: 'mfa@test.com',
    })
    userMocks.findUserById.mockResolvedValue(baseUser({ passwordHash }))

    const res = await app.request('/auth/2fa/setup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ password: 'WrongPass1!' }),
    })
    expect(res.status).toBe(401)
  })

  it('POST /auth/2fa/setup success → 200 with qrCodeDataUrl and backupCodes', async () => {
    const token = await signAccessToken({
      sub: 'mfa-u1',
      role: 'user',
      plan: 'free',
      email: 'mfa@test.com',
    })
    userMocks.findUserById.mockResolvedValue(baseUser({ passwordHash }))
    mfaMocks.findMfaByUserId.mockResolvedValue(undefined)
    mfaMocks.createMfaCredential.mockResolvedValue({} as never)

    const res = await app.request('/auth/2fa/setup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ password: 'MfaPass1!' }),
    })

    expect(res.status).toBe(200)
    const json = (await res.json()) as {
      data: { qrCodeDataUrl: string; backupCodes: string[]; message: string }
    }
    expect(json.data.qrCodeDataUrl).toContain('data:image/png')
    expect(json.data.backupCodes.length).toBe(8)
  })

  it('POST /auth/2fa/verify with correct code → 200 and enableMfa called', async () => {
    const token = await signAccessToken({
      sub: 'mfa-u1',
      role: 'user',
      plan: 'free',
      email: 'mfa@test.com',
    })
    mfaMocks.findMfaByUserId.mockResolvedValue({
      id: 'm1',
      userId: 'mfa-u1',
      totpSecret: encrypt('SECRETBASE32'),
      backupCodes: [],
      isEnabled: false,
      enabledAt: null,
      lastUsedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.spyOn(totpSvc, 'verifyTotpCode').mockReturnValue(true)

    const res = await app.request('/auth/2fa/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ totpCode: '123456' }),
    })

    vi.mocked(totpSvc.verifyTotpCode).mockRestore()

    expect(res.status).toBe(200)
    expect(mfaMocks.enableMfa).toHaveBeenCalledWith('mfa-u1')
  })

  it('POST /auth/2fa/verify with wrong code → 401', async () => {
    const token = await signAccessToken({
      sub: 'mfa-u1',
      role: 'user',
      plan: 'free',
      email: 'mfa@test.com',
    })
    mfaMocks.findMfaByUserId.mockResolvedValue({
      id: 'm1',
      userId: 'mfa-u1',
      totpSecret: encrypt('SECRETBASE32'),
      backupCodes: [],
      isEnabled: false,
      enabledAt: null,
      lastUsedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.spyOn(totpSvc, 'verifyTotpCode').mockReturnValue(false)

    const res = await app.request('/auth/2fa/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ totpCode: '000000' }),
    })

    vi.mocked(totpSvc.verifyTotpCode).mockRestore()

    expect(res.status).toBe(401)
  })

  it('DELETE /auth/2fa/disable with correct creds → 200', async () => {
    const token = await signAccessToken({
      sub: 'mfa-u1',
      role: 'user',
      plan: 'free',
      email: 'mfa@test.com',
    })
    userMocks.findUserById.mockResolvedValue(baseUser({ passwordHash }))
    mfaMocks.findMfaByUserId.mockResolvedValue({
      id: 'm1',
      userId: 'mfa-u1',
      totpSecret: encrypt('SECRETBASE32'),
      backupCodes: [],
      isEnabled: true,
      enabledAt: new Date(),
      lastUsedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.spyOn(totpSvc, 'verifyTotpCode').mockReturnValue(true)

    const res = await app.request('/auth/2fa/disable', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ password: 'MfaPass1!', totpCode: '123456' }),
    })

    vi.mocked(totpSvc.verifyTotpCode).mockRestore()

    expect(res.status).toBe(200)
    expect(mfaMocks.disableMfa).toHaveBeenCalledWith('mfa-u1')
  })

  it('POST /auth/2fa/verify with mfaTempToken returns tokens when MFA is enabled', async () => {
    const mfaTempToken = await signMfaPendingToken('mfa-u1')
    mfaMocks.findMfaByUserId.mockResolvedValue({
      id: 'm1',
      userId: 'mfa-u1',
      totpSecret: encrypt('SECRETBASE32'),
      backupCodes: [],
      isEnabled: true,
      enabledAt: new Date(),
      lastUsedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    userMocks.findUserById.mockResolvedValue(baseUser({ passwordHash }))
    vi.spyOn(totpSvc, 'verifyTotpCode').mockReturnValue(true)

    const res = await app.request('/auth/2fa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ totpCode: '111111', mfaTempToken }),
    })

    vi.mocked(totpSvc.verifyTotpCode).mockRestore()

    expect(res.status).toBe(200)
    const json = (await res.json()) as { data: { accessToken: string } }
    expect(json.data.accessToken).toBeTruthy()
    expect(mfaMocks.enableMfa).not.toHaveBeenCalled()
    expect(mfaMocks.updateLastUsed).toHaveBeenCalled()
  })

  it('POST /auth/2fa/setup with pending MFA row calls updateMfaCredential', async () => {
    const token = await signAccessToken({
      sub: 'mfa-u1',
      role: 'user',
      plan: 'free',
      email: 'mfa@test.com',
    })
    userMocks.findUserById.mockResolvedValue(baseUser({ passwordHash }))
    mfaMocks.findMfaByUserId.mockResolvedValue({
      id: 'm1',
      userId: 'mfa-u1',
      totpSecret: encrypt('old'),
      backupCodes: [],
      isEnabled: false,
      enabledAt: null,
      lastUsedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    mfaMocks.updateMfaCredential.mockResolvedValue({} as never)

    const res = await app.request('/auth/2fa/setup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ password: 'MfaPass1!' }),
    })

    expect(res.status).toBe(200)
    expect(mfaMocks.updateMfaCredential).toHaveBeenCalled()
    expect(mfaMocks.createMfaCredential).not.toHaveBeenCalled()
  })
})
