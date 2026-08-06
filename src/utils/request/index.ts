import { createAlova, type Method } from 'alova';
import VueHook from 'alova/vue';
import adapterFetch from 'alova/fetch';
import { createClientTokenAuthentication } from 'alova/client';

import type {
  ApiResponse,
  AuthTokenData,
  AuthTokenState,
} from '@/types/auth';
import { ApiRequestError as ApiRequestErrorClass } from '@/types/auth';

export const ACCESS_TOKEN_KEY = 'access_token';
export const ACCESS_TOKEN_EXPIRES_AT_KEY = 'access_token_expires_at';
export const TOKEN_REFRESH_EARLY_MS = 30_000;

export const authMeta = {
  visitor: { authRole: 'visitor' as const },
  login: { authRole: 'login' as const },
  refreshToken: { authRole: 'refreshToken' as const },
};

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  return getStorage()?.getItem(ACCESS_TOKEN_KEY) ?? null;
}

export function getAccessTokenExpiresAt(): number | null {
  const value = getStorage()?.getItem(ACCESS_TOKEN_EXPIRES_AT_KEY);
  if (!value) return null;

  const expiresAt = Number(value);
  return Number.isFinite(expiresAt) ? expiresAt : null;
}

export function isAccessTokenExpired(now = Date.now()): boolean {
  const token = getAccessToken();
  const expiresAt = getAccessTokenExpiresAt();

  return !token || expiresAt === null || now >= expiresAt - TOKEN_REFRESH_EARLY_MS;
}

export function saveAccessToken(tokenData: AuthTokenData): AuthTokenState {
  const expiresInMs = Math.max(0, Number(tokenData.expiresIn) * 1000);
  const state: AuthTokenState = {
    accessToken: tokenData.accessToken,
    expiresAt: Date.now() + (Number.isFinite(expiresInMs) ? expiresInMs : 0),
  };
  const storage = getStorage();

  storage?.setItem(ACCESS_TOKEN_KEY, state.accessToken);
  storage?.setItem(ACCESS_TOKEN_EXPIRES_AT_KEY, String(state.expiresAt));

  return state;
}

export function clearAccessToken(): void {
  const storage = getStorage();
  storage?.removeItem(ACCESS_TOKEN_KEY);
  storage?.removeItem(ACCESS_TOKEN_EXPIRES_AT_KEY);
}

export const tokenStore = {
  get: (): AuthTokenState | null => {
    const accessToken = getAccessToken();
    const expiresAt = getAccessTokenExpiresAt();
    return accessToken && expiresAt !== null ? { accessToken, expiresAt } : null;
  },
  set: saveAccessToken,
  clear: clearAccessToken,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function readResponseBody(response: unknown): Promise<unknown> {
  if (!isRecord(response)) return response;

  const responseToRead =
    typeof response.clone === 'function' ? (response.clone() as Record<string, unknown>) : response;
  if (typeof responseToRead.json === 'function') {
    return responseToRead.json();
  }

  return responseToRead;
}

export async function unwrapResponse<T>(response: Response | ApiResponse<T>): Promise<T> {
  const status = isRecord(response) && typeof response.status === 'number' ? response.status : undefined;
  let body: unknown;

  try {
    body = await readResponseBody(response);
  } catch (error) {
    throw new ApiRequestErrorClass('响应不是有效的 JSON 数据', {
      status,
      errors: error,
    });
  }

  if (!isRecord(body)) {
    throw new ApiRequestErrorClass('响应格式无效', { status });
  }

  const code = typeof body.code === 'number' ? body.code : undefined;
  const message = typeof body.message === 'string' ? body.message : '请求失败';
  const errors = body.errors;
  const isHttpError = status !== undefined && (status < 200 || status >= 300);

  if (isHttpError || code !== 0 || !('data' in body)) {
    throw new ApiRequestErrorClass(message, { status, code, errors });
  }

  return body.data as T;
}

function assignBearerToken(method: Method): void {
  const accessToken = getAccessToken();
  if (!accessToken) return;

  method.config.headers = {
    ...method.config.headers,
    Authorization: `Bearer ${accessToken}`,
  };
}

async function refreshAccessToken(): Promise<AuthTokenData> {
  try {
    const tokenData = await alovaInstance.Post<AuthTokenData>('/auth/refresh', undefined, {
      meta: authMeta.refreshToken,
      cacheFor: 0,
    });
    saveAccessToken(tokenData);
    return tokenData;
  } catch (error) {
    clearAccessToken();
    throw error;
  }
}

const { onAuthRequired, onResponseRefreshToken } = createClientTokenAuthentication({
  visitorMeta: authMeta.visitor,
  login: {
    metaMatches: authMeta.login,
    handler: async () => undefined,
  },
  refreshToken: {
    metaMatches: authMeta.refreshToken,
    isExpired: () => isAccessTokenExpired(),
    handler: async () => {
      await refreshAccessToken();
    },
  },
  assignToken: assignBearerToken,
});

export const alovaInstance = createAlova({
  statesHook: VueHook,
  requestAdapter: adapterFetch(),
  baseURL: API_BASE_URL,
  cacheFor: {
    GET: 0,
    get: 0,
  },
  beforeRequest: onAuthRequired((method) => {
    method.config.credentials = 'include';
    method.config.headers = {
      Accept: 'application/json',
      ...method.config.headers,
    };
  }),
  responded: onResponseRefreshToken({
    onSuccess: (response) => unwrapResponse(response),
  }),
});

export { refreshAccessToken };
export { ApiRequestErrorClass as ApiRequestError };
