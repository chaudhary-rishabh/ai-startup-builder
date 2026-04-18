import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import api from '@/lib/axios'
import { server } from '@/tests/mocks/server'

describe('axios instance', () => {
  it('has withCredentials true', () => {
    expect(api.defaults.withCredentials).toBe(true)
  })

  it('normalizes error responses to { code, message, status }', async () => {
    server.use(
      http.get('*/test-error', () =>
        HttpResponse.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: 'Resource not found' },
          },
          { status: 404 },
        ),
      ),
    )
    try {
      await api.get('/test-error')
      expect.fail('Should have thrown')
    } catch (err: unknown) {
      const e = err as { code: string; message: string; status: number }
      expect(e.code).toBe('NOT_FOUND')
      expect(e.message).toBe('Resource not found')
      expect(e.status).toBe(404)
    }
  })

  it('retries with refresh token on 401', async () => {
    let callCount = 0
    server.use(
      http.get('*/protected', () => {
        callCount += 1
        if (callCount === 1) {
          return new HttpResponse(null, { status: 401 })
        }
        return HttpResponse.json({ data: { ok: true } })
      }),
    )
    const result = await api.get('/protected')
    expect(callCount).toBe(2)
    expect(result.data).toEqual({ data: { ok: true } })
  })
})
