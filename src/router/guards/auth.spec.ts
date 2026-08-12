import { createPinia, setActivePinia } from 'pinia'
import {
  createMemoryHistory,
  createRouter,
  type NavigationGuard,
  type NavigationGuardNext,
  type RouteRecordRaw,
} from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import type { AuthTokenData } from '@/types/auth'
import { createAuthGuard } from './auth'

const RouteView = { template: '<div />' }
const routes: RouteRecordRaw[] = [
  { path: '/', component: RouteView },
  { path: '/login', component: RouteView, meta: { requiresAuth: false } },
  { path: '/public', component: RouteView, meta: { requiresAuth: false } },
  { path: '/protected', component: RouteView },
  { path: '/protected-second', component: RouteView },
]

const tokenData: AuthTokenData = {
  accessToken: 'access-token',
  tokenType: 'Bearer',
  expiresIn: 7200,
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

describe('authentication route guard', () => {
  let authStore: ReturnType<typeof useAuthStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    authStore = useAuthStore()
  })

  function createTestRouter(
    refreshSession = vi.fn<() => Promise<unknown>>(),
    loadAccess = vi.fn<() => Promise<void>>(async () => {
      authStore.setAccess([], [])
    }),
    registerRoutes = vi.fn<() => string[]>(() => []),
  ) {
    const router = createRouter({
      history: createMemoryHistory(),
      routes,
    })
    router.beforeEach(createAuthGuard(() => authStore, refreshSession, loadAccess, registerRoutes))
    return { router, loadAccess, registerRoutes, refreshSession }
  }

  it('allows public routes without refreshing the session', async () => {
    const { router, refreshSession } = createTestRouter()

    await router.push('/public')

    expect(router.currentRoute.value.path).toBe('/public')
    expect(refreshSession).not.toHaveBeenCalled()
  })

  it('allows protected routes when the access token is valid and access is ready', async () => {
    authStore.setSession(tokenData)
    authStore.setAccess([], [])
    const { router, refreshSession, loadAccess } = createTestRouter()

    await router.push('/protected')

    expect(router.currentRoute.value.path).toBe('/protected')
    expect(refreshSession).not.toHaveBeenCalled()
    expect(loadAccess).not.toHaveBeenCalled()
  })

  it('bootstraps access before entering protected routes when access is not ready', async () => {
    authStore.setSession(tokenData)
    const loadAccess = vi.fn<() => Promise<void>>(async () => {
      authStore.setAccess([], [])
    })
    const registerRoutes = vi.fn<() => string[]>(() => [])
    const { router } = createTestRouter(vi.fn<() => Promise<unknown>>(), loadAccess, registerRoutes)

    await router.push('/protected')

    expect(loadAccess).toHaveBeenCalledOnce()
    expect(registerRoutes).toHaveBeenCalledOnce()
    expect(router.currentRoute.value.path).toBe('/protected')
  })

  it('restores the session before entering a dynamically added protected route', async () => {
    const refreshSession = vi.fn<() => Promise<void>>(async () => {
      authStore.setSession(tokenData)
    })
    const loadAccess = vi.fn<() => Promise<void>>(async () => {
      authStore.setAccess([], [])
    })
    const { router } = createTestRouter(refreshSession, loadAccess)
    router.addRoute({ path: '/dynamic', component: RouteView })

    await router.push('/dynamic')

    expect(router.currentRoute.value.path).toBe('/dynamic')
    expect(refreshSession).toHaveBeenCalledOnce()
    expect(loadAccess).toHaveBeenCalledOnce()
  })

  it('redirects to login and preserves the target when refresh fails', async () => {
    const { router } = createTestRouter(
      vi.fn<() => Promise<unknown>>().mockRejectedValue(new Error('refresh failed')),
    )

    await router.push('/protected?tab=profile')

    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBe('/protected?tab=profile')
  })

  it('shares one refresh request between concurrent guard calls', async () => {
    let finishRefresh = () => undefined
    const refreshSession = vi.fn<() => Promise<void>>(
      () =>
        new Promise<void>((resolve) => {
          finishRefresh = () => {
            authStore.setSession(tokenData)
            resolve()
          }
        }),
    )
    const loadAccess = vi.fn<() => Promise<void>>(async () => {
      authStore.setAccess([], [])
    })
    const guard = createAuthGuard(
      () => authStore,
      refreshSession,
      loadAccess,
      vi.fn<() => string[]>(() => []),
    )
    const { router } = createTestRouter()
    const from = router.resolve('/') as Parameters<NavigationGuard>[1]
    const next: NavigationGuardNext = () => undefined

    const firstGuard = guard(
      router.resolve('/protected') as Parameters<NavigationGuard>[0],
      from,
      next,
    )
    const secondGuard = guard(
      router.resolve('/protected-second') as Parameters<NavigationGuard>[0],
      from,
      next,
    )

    expect(refreshSession).toHaveBeenCalledOnce()
    finishRefresh()
    const results = await Promise.all([firstGuard, secondGuard])

    expect(loadAccess).toHaveBeenCalledOnce()
    expect(results).toHaveLength(2)
    for (const result of results) {
      expect(
        result === true ||
          (typeof result === 'object' &&
            result !== null &&
            'path' in result &&
            result.replace === true),
      ).toBe(true)
    }
  })
})
