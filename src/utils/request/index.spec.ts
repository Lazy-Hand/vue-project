import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { pinia } from '@/stores'
import { useAuthStore } from '@/stores/auth'
import type { AuthTokenData } from '@/types/auth'
import { loginAuth } from '@/api/auth'
import { request } from './index'

const tokenData: AuthTokenData = {
  accessToken: 'access-token',
  tokenType: 'Bearer',
  expiresIn: 60,
  user: {
    id: '1',
    username: 'admin',
    nickname: null,
    email: null,
    phone: null,
    avatar: null,
    enabled: true,
  },
}

describe('authenticated requests', () => {
  const authStore = useAuthStore(pinia)

  beforeEach(() => {
    vi.useRealTimers()
    authStore.clearSession()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('stores the session and refreshes slightly early', () => {
    const now = new Date('2026-08-06T00:00:00.000Z')
    vi.setSystemTime(now)

    authStore.setSession(tokenData)

    expect(authStore.accessToken).toBe('access-token')
    expect(authStore.expiresAt).toBe(now.getTime() + 60_000)
    expect(authStore.user).toEqual(tokenData.user)
    expect(authStore.isAccessTokenExpired(now.getTime() + 29_999)).toBe(false)
    expect(authStore.isAccessTokenExpired(now.getTime() + 30_000)).toBe(true)
  })

  it('stores the session returned by login', async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ code: 0, message: 'success', data: tokenData }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(loginAuth({ username: 'admin', password: 'Admin@123456' })).resolves.toEqual(
      tokenData,
    )

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(authStore.accessToken).toBe(tokenData.accessToken)
    expect(authStore.user).toEqual(tokenData.user)
  })

  it('sends refresh cookies and then injects the refreshed bearer token', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = []
    const fetchMock = vi.fn<typeof fetch>(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      calls.push({ url, init: init ?? {} })

      if (url.endsWith('/auth/refresh')) {
        return new Response(
          JSON.stringify({
            code: 0,
            message: 'success',
            data: {
              accessToken: 'refreshed-token',
              tokenType: 'Bearer',
              expiresIn: 900,
              user: {
                id: '1',
                username: 'admin',
                nickname: null,
                email: null,
                phone: null,
                avatar: null,
                enabled: true,
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      return new Response(JSON.stringify({ code: 0, message: 'success', data: { ok: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(request.Get<{ ok: boolean }>('/protected')).resolves.toEqual({ ok: true })

    expect(calls).toHaveLength(2)
    const [refreshCall, protectedCall] = calls
    expect(refreshCall).toBeDefined()
    expect(protectedCall).toBeDefined()
    if (!refreshCall || !protectedCall) throw new Error('expected refresh and protected calls')
    expect(refreshCall.init.credentials).toBe('include')
    const sentHeaders = new Headers(protectedCall.init.headers)
    expect(sentHeaders.get('authorization')).toBe('Bearer refreshed-token')
    expect(sentHeaders.get('x-locale')).toBe('zh-CN')
  })

  it('omits Content-Type for write requests without a body', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = []
    const fetchMock = vi.fn<typeof fetch>(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init: init ?? {} })
      return new Response(JSON.stringify({ code: 0, message: 'success', data: { ok: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    authStore.setSession(tokenData)

    const publish = request.Post<{ ok: boolean }>('/notice/7/publish', undefined)
    const remove = request.Delete<{ ok: boolean }>('/notice/7', undefined)
    await expect(publish).resolves.toEqual({ ok: true })
    await expect(remove).resolves.toEqual({ ok: true })

    expect(calls).toHaveLength(2)
    for (const call of calls) {
      expect(call.init.body).toBeUndefined()
      const sentHeaders = new Headers(call.init.headers)
      expect(sentHeaders.has('content-type')).toBe(false)
    }
  })

  it('keeps Content-Type for write requests with a JSON body', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = []
    const fetchMock = vi.fn<typeof fetch>(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init: init ?? {} })
      return new Response(JSON.stringify({ code: 0, message: 'success', data: { ok: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    authStore.setSession(tokenData)

    await expect(
      request.Post<{ ok: boolean }>('/notice', { title: '公告' }, { cacheFor: 0 }),
    ).resolves.toEqual({ ok: true })

    expect(calls).toHaveLength(1)
    expect(calls[0]!.init.body).toBe(JSON.stringify({ title: '公告' }))
    const sentHeaders = new Headers(calls[0]!.init.headers)
    expect(sentHeaders.has('content-type')).toBe(true)
  })
})
