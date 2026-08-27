import type { NavigationGuard, RouteLocationRaw } from 'vue-router'

import { bootstrapAccess, refreshAuth } from '@/api/auth'
import { registerDynamicRoutes } from '@/router/dynamic'
import { pinia } from '@/stores'
import { useAuthStore } from '@/stores/auth'

export const LOGIN_PATH = '/login'
export const FORGOT_PATH = '/forgot'
export const HOME_PATH = '/'

type AuthStore = ReturnType<typeof useAuthStore>
type RefreshSession = () => Promise<unknown>
type BootstrapAccess = () => Promise<void>
type RegisterRoutes = () => string[]

function redirectToLogin(fullPath: string): RouteLocationRaw {
  return {
    path: LOGIN_PATH,
    query: { redirect: fullPath },
    replace: true,
  }
}

export function createAuthGuard(
  getAuthStore: () => AuthStore = () => useAuthStore(pinia),
  refreshSession: RefreshSession = refreshAuth,
  loadAccess: BootstrapAccess = bootstrapAccess,
  registerRoutes: RegisterRoutes = registerDynamicRoutes,
): NavigationGuard {
  let refreshPromise: Promise<void> | null = null
  let accessPromise: Promise<void> | null = null

  const ensureSession = () => {
    if (!refreshPromise) {
      refreshPromise = refreshSession()
        .then(() => undefined)
        .finally(() => {
          refreshPromise = null
        })
    }

    return refreshPromise
  }

  const ensureAccess = () => {
    if (!accessPromise) {
      accessPromise = loadAccess()
        .then(() => {
          registerRoutes()
        })
        .finally(() => {
          accessPromise = null
        })
    }

    return accessPromise
  }

  return async (to) => {
    const authStore = getAuthStore()
    const isAuthenticated = !authStore.isAccessTokenExpired()

    if (to.path === LOGIN_PATH || to.path === FORGOT_PATH) {
      return isAuthenticated ? { path: HOME_PATH, replace: true } : true
    }

    if (to.meta.requiresAuth === false) {
      return true
    }

    if (!isAuthenticated) {
      try {
        await ensureSession()

        if (authStore.isAccessTokenExpired()) {
          authStore.clearSession()
          return redirectToLogin(to.fullPath)
        }
      } catch {
        authStore.clearSession()
        return redirectToLogin(to.fullPath)
      }
    }

    if (!authStore.accessReady) {
      try {
        await ensureAccess()
      } catch {
        authStore.clearSession()
        return redirectToLogin(to.fullPath)
      }

      return { path: to.fullPath, replace: true }
    }

    return true
  }
}
