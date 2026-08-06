import { alovaInstance, authMeta, refreshAccessToken } from '@/utils/request'
import { pinia } from '@/stores'
import { useAuthStore } from '@/stores/auth'
import type { AccountSetSummary } from '@/types/account-set'
import type { AuthTokenData, AuthUser, LoginParams } from '@/types/auth'
import type { PermissionTreeNode } from '@/types/permission'

export async function loginAuth(params: LoginParams): Promise<AuthTokenData> {
  const tokenData = await alovaInstance.Post<AuthTokenData>('/auth/login', params, {
    meta: authMeta.login,
    cacheFor: 0,
  })
  useAuthStore(pinia).setSession(tokenData)
  return tokenData
}

export function refreshAuth(): Promise<AuthTokenData> {
  return refreshAccessToken()
}

export function fetchAuthMe(): Promise<AuthUser> {
  return alovaInstance.Get<AuthUser>('/auth/me', { cacheFor: 0 })
}

export function fetchAuthPermissions(): Promise<string[]> {
  return alovaInstance.Get<string[]>('/auth/me/permissions', { cacheFor: 0 })
}

export function fetchAuthMenus(): Promise<PermissionTreeNode[]> {
  return alovaInstance.Get<PermissionTreeNode[]>('/auth/me/menus', { cacheFor: 0 })
}

export function fetchMyAccountSets(): Promise<AccountSetSummary[]> {
  return alovaInstance.Get<AccountSetSummary[]>('/auth/me/account-sets', { cacheFor: 0 })
}

export async function bootstrapAccess(): Promise<void> {
  const authStore = useAuthStore(pinia)
  const [accountSets, menus, permissions] = await Promise.all([
    fetchMyAccountSets(),
    fetchAuthMenus(),
    fetchAuthPermissions(),
  ])
  authStore.setAccountSets(accountSets)
  authStore.setAccess(menus, permissions)
}

/** Re-fetch menus after locale change so sidebar/route titles match X-Locale. */
export async function refreshLocalizedMenus(): Promise<void> {
  const authStore = useAuthStore(pinia)
  if (!authStore.accessReady) return

  const menus = await fetchAuthMenus()
  authStore.setAccess(menus, authStore.permissions)
  const { registerDynamicRoutes } = await import('@/router/dynamic')
  registerDynamicRoutes(menus)
}

export async function logoutAuth(): Promise<void> {
  try {
    await alovaInstance.Post<{ success: boolean }>(
      '/auth/logout',
      {},
      {
        cacheFor: 0,
      },
    )
  } finally {
    const { resetDynamicRoutes } = await import('@/router/dynamic')
    resetDynamicRoutes()
    useAuthStore(pinia).clearSession()
  }
}
