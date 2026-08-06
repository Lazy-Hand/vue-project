import { alovaInstance, authMeta, refreshAccessToken, saveAccessToken } from '@/utils/request';
import type { AuthTokenData, LoginParams } from '@/types/auth';

export async function loginAuth(params: LoginParams): Promise<AuthTokenData> {
  const tokenData = await alovaInstance.Post<AuthTokenData>('/auth/login', params, {
    meta: authMeta.login,
    cacheFor: 0,
  });
  saveAccessToken(tokenData);
  return tokenData;
}

export function refreshAuth(): Promise<AuthTokenData> {
  return refreshAccessToken();
}
