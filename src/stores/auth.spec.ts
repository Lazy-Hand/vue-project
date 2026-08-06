import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useAuthStore } from './auth'
import type { AuthTokenData } from '@/types/auth'

const tokenData: AuthTokenData = {
  accessToken: 'access-token',
  tokenType: 'Bearer',
  expiresIn: 7200,
  user: {
    id: '1',
    username: 'admin',
    nickname: '管理员',
    email: null,
    phone: null,
    avatar: null,
    enabled: true,
  },
}

describe('auth store permissions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('checks permission codes with AND semantics', () => {
    const store = useAuthStore()
    store.setSession(tokenData)
    store.setAccess([], ['system:user:create', 'system:user:update'])

    expect(store.hasPermission('system:user:create')).toBe(true)
    expect(store.hasPermission(['system:user:create', 'system:user:update'])).toBe(true)
    expect(store.hasPermission(['system:user:create', 'system:user:delete'])).toBe(false)
    expect(store.accessReady).toBe(true)
  })

  it('clears access state with the session', () => {
    const store = useAuthStore()
    store.setSession(tokenData)
    store.setAccess([], ['system:user:create'])
    store.clearSession()

    expect(store.accessToken).toBeNull()
    expect(store.permissions).toEqual([])
    expect(store.accessReady).toBe(false)
  })
})
