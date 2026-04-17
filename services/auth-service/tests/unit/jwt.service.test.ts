import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  generateTokenPair,
  signAccessToken,
  signMfaPendingToken,
  signRefreshToken,
  verifyAccessToken,
  verifyMfaPendingToken,
  verifyRefreshToken,
} from '../../src/services/jwt.service.js'

describe('jwt.service', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('signAccessToken returns compact JWT', async () => {
    const token = await signAccessToken({
      sub: 'u1',
      role: 'user',
      plan: 'free',
      email: 'a@b.com',
    })
    expect(token.split('.')).toHaveLength(3)
  })

  it('verifyAccessToken succeeds for valid token', async () => {
    const token = await signAccessToken({
      sub: 'u1',
      role: 'user',
      plan: 'free',
      email: 'a@b.com',
    })
    const payload = await verifyAccessToken(token)
    expect(payload.sub).toBe('u1')
    expect(payload['type']).toBe('access')
  })

  it('verifyAccessToken throws after expiry (mocked time)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'))
    const token = await signAccessToken({
      sub: 'u1',
      role: 'user',
      plan: 'free',
      email: 'a@b.com',
    })
    vi.setSystemTime(new Date('2025-01-01T00:00:10.000Z'))
    await expect(verifyAccessToken(token)).rejects.toThrow()
  })

  it('verifyAccessToken throws on tampered signature', async () => {
    const token = await signAccessToken({
      sub: 'u1',
      role: 'user',
      plan: 'free',
      email: 'a@b.com',
    })
    const parts = token.split('.')
    parts[2] = parts[2] === 'abc' ? 'def' : 'abc'
    const bad = parts.join('.')
    await expect(verifyAccessToken(bad)).rejects.toThrow()
  })

  it('generateTokenPair returns access and refresh tokens', async () => {
    const pair = await generateTokenPair({
      id: 'u1',
      role: 'user',
      planTier: 'free',
      email: 'a@b.com',
    })
    expect(pair.accessToken.length).toBeGreaterThan(20)
    expect(pair.refreshToken.length).toBeGreaterThan(20)
    expect(pair.expiresIn).toBe(2)
  })

  it('verifyRefreshToken accepts a valid refresh token', async () => {
    const token = await signRefreshToken({ sub: 'u1' })
    const payload = await verifyRefreshToken(token)
    expect(payload.sub).toBe('u1')
    expect(payload['type']).toBe('refresh')
  })

  it('verifyRefreshToken rejects an access token', async () => {
    const token = await signAccessToken({
      sub: 'u1',
      role: 'user',
      plan: 'free',
      email: 'a@b.com',
    })
    await expect(verifyRefreshToken(token)).rejects.toThrow()
  })

  it('verifyAccessToken rejects a refresh token', async () => {
    const token = await signRefreshToken({ sub: 'u1' })
    await expect(verifyAccessToken(token)).rejects.toThrow()
  })

  it('signMfaPendingToken and verifyMfaPendingToken round-trip', async () => {
    const t = await signMfaPendingToken('user-x')
    const out = await verifyMfaPendingToken(t)
    expect(out.sub).toBe('user-x')
  })
})
