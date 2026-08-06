import { createAlova } from 'alova'
import adapterFetch, { type FetchRequestInit } from 'alova/fetch'
import { createAlovaMockAdapter } from '@alova/mock'
import { describe, expect, it, vi } from 'vitest'

import type { AuthTokenData, AuthUser } from '@/types/auth'
import type { PermissionTreeNode } from '@/types/permission'
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

  it('returns me, menus, permissions, account-sets and logout payloads', async () => {
    const alova = createMockAlova()

    await expect(alova.Get<AuthUser>('/auth/me')).resolves.toMatchObject({
      username: 'admin',
      enabled: true,
    })
    await expect(alova.Get<string[]>('/auth/me/permissions')).resolves.toContain(
      'system:user:create',
    )
    const menus = await alova.Get<PermissionTreeNode[]>('/auth/me/menus')
    expect(menus.some((node) => node.code === 'system')).toBe(true)
    await expect(alova.Get('/auth/me/account-sets')).resolves.toEqual([
      {
        id: '1',
        code: 'DEFAULT',
        name: '默认账套',
        isDefault: true,
        enabled: true,
      },
    ])
    await expect(alova.Post<{ success: boolean }>('/auth/logout')).resolves.toEqual({
      success: true,
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
