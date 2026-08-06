import { createAlova, type Method } from 'alova'
import VueHook from 'alova/vue'
import { createClientTokenAuthentication } from 'alova/client'

import { requestAdapter } from '@/mocks'
import { pinia } from '@/stores'
import { useAppConfigStore } from '@/stores/app-config'
import { useAuthStore } from '@/stores/auth'
import type { AuthTokenData } from '@/types/auth'
import { unwrapResponse } from './response'

export const authMeta = {
  visitor: { authRole: null },
  login: { authRole: 'login' as const },
  refreshToken: { authRole: 'refreshToken' as const },
}

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

function assignBearerToken(method: Method): void {
  const { accessToken, currentAccountSetId } = useAuthStore(pinia)
  if (!accessToken) return

  method.config.headers = {
    ...method.config.headers,
    Authorization: `Bearer ${accessToken}`,
    ...(currentAccountSetId
      ? { 'X-Account-Set-Id': currentAccountSetId }
      : {}),
  }
}

async function refreshAccessToken(): Promise<AuthTokenData> {
  const authStore = useAuthStore(pinia)

  try {
    const tokenData = await alovaInstance.Post<AuthTokenData>('/auth/refresh', {}, {
      meta: authMeta.refreshToken,
      cacheFor: 0,
    })
    authStore.setSession(tokenData)
    return tokenData
  } catch (error) {
    authStore.clearSession()
    throw error
  }
}

const { onAuthRequired, onResponseRefreshToken } = createClientTokenAuthentication({
  refreshToken: {
    metaMatches: authMeta.refreshToken,
    isExpired: () => useAuthStore(pinia).isAccessTokenExpired(),
    handler: async () => {
      await refreshAccessToken()
    },
  },
  assignToken: assignBearerToken,
})

export const alovaInstance = createAlova({
  statesHook: VueHook,
  requestAdapter,
  baseURL: API_BASE_URL,
  cacheFor: {
    GET: 0,
    get: 0,
  },
  beforeRequest: onAuthRequired((method) => {
    method.config.credentials = 'include'
    method.config.headers = {
      Accept: 'application/json',
      'X-Locale': useAppConfigStore(pinia).locale,
      ...method.config.headers,
    }
  }),
  responded: onResponseRefreshToken({
    onSuccess: (response) => unwrapResponse(response),
  }),
})

export { refreshAccessToken }
export { ApiRequestError, unwrapResponse } from './response'
