import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as dbLib from '../../src/lib/db.js'
import { generateTokenPair } from '../../src/services/jwt.service.js'

const findActiveTokensByUserId = vi.fn()
const revokeRefreshToken = vi.fn()

vi.mock('../../src/db/queries/refreshTokens.queries.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/db/queries/refreshTokens.queries.js')>()
  return {
    ...actual,
    findActiveTokensByUserId: (...a: unknown[]) => findActiveTokensByUserId(...a),
    revokeRefreshToken: (...a: unknown[]) => revokeRefreshToken(...a),
  }
})

const { createApp } = await import('../../src/app.js')

function dbChainReturning(rows: unknown[]) {
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: () => Promise.resolve(rows),
  }
  return { select: () => chain }
}

describe('sessions routes', () => {
  let app: ReturnType<typeof createApp>
  let accessToken: string

  beforeEach(async () => {
    vi.clearAllMocks()
    app = createApp()
    const tokens = await generateTokenPair({
      id: 'user-1',
      role: 'user',
      planTier: 'free',
      email: 'u@test.com',
    })
    accessToken = tokens.accessToken
    findActiveTokensByUserId.mockResolvedValue([
      {
        id: 'sess-1',
        userId: 'user-1',
        tokenHash: 'secret-hash',
        deviceInfo: { ua: 'vitest' },
        expiresAt: new Date(Date.now() + 86_400_000),
        revokedAt: null,
        replacedByTokenId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])
  })

  it('GET /auth/sessions without auth → 401', async () => {
    const res = await app.request('/auth/sessions')
    expect(res.status).toBe(401)
  })

  it('GET /auth/sessions returns active sessions without tokenHash field', async () => {
    const res = await app.request('/auth/sessions', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    expect(res.status).toBe(200)
    const json = (await res.json()) as {
      success: boolean
      data: { sessions: Array<Record<string, unknown>> }
    }
    expect(json.success).toBe(true)
    expect(json.data.sessions).toHaveLength(1)
    const row = json.data.sessions[0]
    expect(row).not.toHaveProperty('tokenHash')
    expect(row['id']).toBe('sess-1')
  })

  it('DELETE /auth/sessions/:id for token belonging to another user → 403 FORBIDDEN', async () => {
    vi.spyOn(dbLib, 'getDb').mockReturnValue(
      dbChainReturning([
        {
          id: 'sess-x',
          userId: 'other-user',
          tokenHash: 'h',
        },
      ]) as never,
    )
    const res = await app.request('/auth/sessions/sess-x', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    expect(res.status).toBe(403)
    const json = (await res.json()) as { error: { code: string } }
    expect(json.error.code).toBe('FORBIDDEN')
    expect(revokeRefreshToken).not.toHaveBeenCalled()
  })

  it('DELETE /auth/sessions/:id success → 200', async () => {
    vi.spyOn(dbLib, 'getDb').mockReturnValue(
      dbChainReturning([
        {
          id: 'sess-x',
          userId: 'user-1',
          tokenHash: 'h',
        },
      ]) as never,
    )
    const res = await app.request('/auth/sessions/sess-x', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    expect(res.status).toBe(200)
    expect(revokeRefreshToken).toHaveBeenCalledWith('h')
  })
})
