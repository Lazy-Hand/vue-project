import { alovaInstance, authMeta, refreshAccessToken } from '@/utils/request'
import { pinia } from '@/stores'
import { useAuthStore } from '@/stores/auth'
import type { AuthTokenData, LoginParams } from '@/types/auth'

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
