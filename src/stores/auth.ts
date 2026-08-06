import { defineStore } from 'pinia'

import type { AuthTokenData, AuthTokenState, AuthUser } from '@/types/auth'

export const TOKEN_REFRESH_EARLY_MS = 30_000

interface AuthState {
  accessToken: string | null
  expiresAt: number | null
  user: AuthUser | null
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    accessToken: null,
    expiresAt: null,
    user: null,
  }),
  actions: {
    setSession(tokenData: AuthTokenData): AuthTokenState {
      const expiresInMs = Math.max(0, Number(tokenData.expiresIn) * 1000)
      const session = {
        accessToken: tokenData.accessToken,
        expiresAt: Date.now() + (Number.isFinite(expiresInMs) ? expiresInMs : 0),
      }

      this.accessToken = session.accessToken
      this.expiresAt = session.expiresAt
      this.user = tokenData.user

      return session
    },
    clearSession(): void {
      this.$reset()
    },
    isAccessTokenExpired(now = Date.now()): boolean {
      return (
        !this.accessToken ||
        this.expiresAt === null ||
        now >= this.expiresAt - TOKEN_REFRESH_EARLY_MS
      )
    },
  },
  persist: {
    pick: ['accessToken', 'expiresAt', 'user'],
  },
})
