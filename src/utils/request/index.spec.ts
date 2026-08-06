import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  alovaInstance,
  clearAccessToken,
  getAccessToken,
  getAccessTokenExpiresAt,
  isAccessTokenExpired,
  saveAccessToken,
  unwrapResponse,
} from './index';

describe('request response handling', () => {
  it('unwraps a successful API envelope', async () => {
    const response = new Response(JSON.stringify({ code: 0, message: 'success', data: { ok: true } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    await expect(unwrapResponse<{ ok: boolean }>(response)).resolves.toEqual({ ok: true });
  });

  it('exposes HTTP and business error details', async () => {
    const response = new Response(
      JSON.stringify({ code: 1001, message: 'invalid credentials', data: null, errors: { field: 'username' } }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    );

    await expect(unwrapResponse(response)).rejects.toMatchObject({
      name: 'ApiRequestError',
      status: 401,
      code: 1001,
      errors: { field: 'username' },
      message: 'invalid credentials',
    });
  });
});

describe('access token storage', () => {
  beforeEach(() => {
    vi.useRealTimers();
    clearAccessToken();
  });

  it('stores an absolute expiry and refreshes slightly early', () => {
    const now = new Date('2026-08-06T00:00:00.000Z');
    vi.setSystemTime(now);

    saveAccessToken({
      accessToken: 'access-token',
      tokenType: 'Bearer',
      expiresIn: 60,
      user: {
        id: '1',
        username: 'admin',
        nickname: null,
        email: null,
        phone: null,
        avatar: null,
        enabled: true,
      },
    });

    expect(getAccessToken()).toBe('access-token');
    expect(getAccessTokenExpiresAt()).toBe(now.getTime() + 60_000);
    expect(isAccessTokenExpired(now.getTime() + 29_999)).toBe(false);
    expect(isAccessTokenExpired(now.getTime() + 30_000)).toBe(true);
  });

  it('sends refresh cookies and then injects the refreshed bearer token', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchMock = vi.fn<typeof fetch>(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init: init ?? {} });

      if (url.endsWith('/auth/refresh')) {
        return new Response(
          JSON.stringify({
            code: 0,
            message: 'success',
            data: {
              accessToken: 'refreshed-token',
              tokenType: 'Bearer',
              expiresIn: 900,
              user: {
                id: '1',
                username: 'admin',
                nickname: null,
                email: null,
                phone: null,
                avatar: null,
                enabled: true,
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      return new Response(JSON.stringify({ code: 0, message: 'success', data: { ok: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(alovaInstance.Get<{ ok: boolean }>('/protected')).resolves.toEqual({ ok: true });

    expect(calls).toHaveLength(2);
    const [refreshCall, protectedCall] = calls;
    expect(refreshCall).toBeDefined();
    expect(protectedCall).toBeDefined();
    if (!refreshCall || !protectedCall) throw new Error('expected refresh and protected calls');
    expect(refreshCall.init.credentials).toBe('include');
    expect(protectedCall.init.headers).toMatchObject({ Authorization: 'Bearer refreshed-token' });
    vi.unstubAllGlobals();
  });
});
