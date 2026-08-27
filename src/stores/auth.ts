import { ref } from 'vue'
import { defineStore } from 'pinia'

import type { AccountSetSummary } from '@/types/account-set'
import type { AuthTokenData, AuthTokenState, AuthUser } from '@/types/auth'
import type { PermissionTreeNode } from '@/types/permission'

export const TOKEN_REFRESH_EARLY_MS = 30_000

export const useAuthStore = defineStore(
  'auth',
  () => {
    const accessToken = ref<string | null>(null)
    const expiresAt = ref<number | null>(null)
    const user = ref<AuthUser | null>(null)
    const permissions = ref<string[]>([])
    const menus = ref<PermissionTreeNode[]>([])
    const accessReady = ref(false)
    const accountSets = ref<AccountSetSummary[]>([])
    const currentAccountSetId = ref<string | null>(null)

    function setSession(tokenData: AuthTokenData): AuthTokenState {
      const expiresInMs = Math.max(0, Number(tokenData.expiresIn) * 1000)
      const session = {
        accessToken: tokenData.accessToken,
        expiresAt: Date.now() + (Number.isFinite(expiresInMs) ? expiresInMs : 0),
      }

      accessToken.value = session.accessToken
      expiresAt.value = session.expiresAt
      user.value = tokenData.user

      return session
    }

    function setAccess(nextMenus: PermissionTreeNode[], nextPermissions: string[]): void {
      menus.value = nextMenus
      permissions.value = nextPermissions
      accessReady.value = true
    }

    function setUser(nextUser: AuthUser): void {
      user.value = nextUser
    }

    function setAccountSets(nextAccountSets: AccountSetSummary[]): void {
      accountSets.value = nextAccountSets

      const stillValid =
        currentAccountSetId.value !== null &&
        nextAccountSets.some((item) => item.id === currentAccountSetId.value)

      if (stillValid) {
        return
      }

      const defaultSet =
        nextAccountSets.find((item) => item.isDefault) ?? nextAccountSets[0] ?? null
      currentAccountSetId.value = defaultSet?.id ?? null
    }

    function setCurrentAccountSetId(id: string): void {
      if (!accountSets.value.some((item) => item.id === id)) {
        throw new Error('无权切换到该账套')
      }
      currentAccountSetId.value = id
    }

    function clearAccess(): void {
      menus.value = []
      permissions.value = []
      accessReady.value = false
    }

    function clearSession(): void {
      accessToken.value = null
      expiresAt.value = null
      user.value = null
      accountSets.value = []
      currentAccountSetId.value = null
      clearAccess()
    }

    function isAccessTokenExpired(now = Date.now()): boolean {
      return (
        !accessToken.value ||
        expiresAt.value === null ||
        now >= expiresAt.value - TOKEN_REFRESH_EARLY_MS
      )
    }

    function hasPermission(code: string | string[]): boolean {
      const codes = Array.isArray(code) ? code : [code]
      if (codes.length === 0) return true
      return codes.every((item) => permissions.value.includes(item))
    }

    return {
      accessToken,
      expiresAt,
      user,
      permissions,
      menus,
      accessReady,
      accountSets,
      currentAccountSetId,
      setSession,
      setAccess,
      setUser,
      setAccountSets,
      setCurrentAccountSetId,
      clearAccess,
      clearSession,
      isAccessTokenExpired,
      hasPermission,
    }
  },
  {
    persist: {
      pick: ['accessToken', 'expiresAt', 'user', 'currentAccountSetId'],
    },
  },
)
