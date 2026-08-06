import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { pinia } from '@/stores'
import { useAuthStore } from '@/stores/auth'
import type { AuthTokenData } from '@/types/auth'
import { loginAuth } from '@/api/auth'
import { alovaInstance } from './index'

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

    await expect(alovaInstance.Get<{ ok: boolean }>('/protected')).resolves.toEqual({ ok: true })

    expect(calls).toHaveLength(2)
    const [refreshCall, protectedCall] = calls
    expect(refreshCall).toBeDefined()
    expect(protectedCall).toBeDefined()
    if (!refreshCall || !protectedCall) throw new Error('expected refresh and protected calls')
    expect(refreshCall.init.credentials).toBe('include')
    expect(protectedCall.init.headers).toMatchObject({
      Authorization: 'Bearer refreshed-token',
      'X-Locale': 'zh-CN',
    })
  })
})
