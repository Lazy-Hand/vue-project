import { createAlova } from 'alova'
import adapterFetch, { type FetchRequestInit } from 'alova/fetch'
import { createAlovaMockAdapter } from '@alova/mock'
import { describe, expect, it, vi } from 'vitest'

import type { AuthTokenData } from '@/types/auth'
import { unwrapResponse } from '@/utils/request/response'
import authMock from './auth'

function createMockAlova(customFetch?: typeof fetch) {
  return createAlova({
    requestAdapter: createAlovaMockAdapter<FetchRequestInit, Response, Headers>([authMock], {
      httpAdapter: adapterFetch(customFetch ? { customFetch } : undefined),
      delay: 0,
      matchMode: 'methodurl',
      mockRequestLogger: false,
    }),
    responded: (response: Response) => unwrapResponse(response),
  })
}

describe('auth mock', () => {
  it('returns login and refresh token data', async () => {
    const alova = createMockAlova()

    const loginData = await alova.Post<AuthTokenData>('/auth/login', {
      username: 'admin',
      password: 'Admin@123456',
    })
    const refreshData = await alova.Post<AuthTokenData>('/auth/refresh')

    expect(loginData.user.username).toBe('admin')
    expect(loginData.accessToken).toMatch(/^mock-access-token-/)
    expect(refreshData.tokenType).toBe('Bearer')
  })

  it('returns the backend error envelope for invalid credentials', async () => {
    const alova = createMockAlova()

    await expect(
      alova.Post('/auth/login', { username: 'admin', password: 'wrong-password' }),
    ).rejects.toMatchObject({
      name: 'ApiRequestError',
      status: 401,
      code: 401,
      message: '用户名或密码错误',
    })
  })

  it('falls back to fetch when no mock route matches', async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ code: 0, message: 'success', data: 'real response' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    )
    const alova = createMockAlova(fetchMock)

    await expect(alova.Get<string>('/not-mocked')).resolves.toBe('real response')
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
