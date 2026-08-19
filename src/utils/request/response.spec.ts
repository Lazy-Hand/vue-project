import { describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'
import { normalizeRequestError, ApiRequestError, unwrapResponse } from './response'

describe('request response handling', () => {
  it.each([204, 205])(
    'resolves undefined for HTTP %i responses without content',
    async (status) => {
      const response = new Response(null, { status })

      await expect(unwrapResponse<void>(response)).resolves.toBeUndefined()
    },
  )

  it('unwraps a successful API envelope', async () => {
    const response = new Response(
      JSON.stringify({ code: 0, message: 'success', data: { ok: true } }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )

    await expect(unwrapResponse<{ ok: boolean }>(response)).resolves.toEqual({ ok: true })
  })

  it('treats a success envelope without data as undefined (void endpoints)', async () => {
    const response = new Response(
      JSON.stringify({ code: 0, message: 'success' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )

    await expect(unwrapResponse<void>(response)).resolves.toBeUndefined()
  })

  it('unwraps a success envelope with explicit null data', async () => {
    const response = new Response(
      JSON.stringify({ code: 0, message: 'success', data: null }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )

    await expect(unwrapResponse<void>(response)).resolves.toBeNull()
  })

  it('exposes HTTP and business error details', async () => {
    const response = new Response(
      JSON.stringify({
        code: 1001,
        message: 'invalid credentials',
        data: null,
        errors: { field: 'username' },
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )

    await expect(unwrapResponse(response)).rejects.toMatchObject({
      name: 'ApiRequestError',
      status: 401,
      code: 1001,
      errors: { field: 'username' },
      message: 'invalid credentials',
    })
  })

  describe('non-JSON error bodies (backend unreachable)', () => {
    it('reports 502 gateway errors instead of "not valid JSON"', async () => {
      const response = new Response('<html><body>502 Bad Gateway</body></html>', {
        status: 502,
        headers: { 'Content-Type': 'text/html' },
      })

      await expect(unwrapResponse(response)).rejects.toMatchObject({
        name: 'ApiRequestError',
        status: 502,
        message: i18n.global.t('request.serviceUnavailable', { status: 502 }),
      })
    })

    it('reports generic 5xx gateway errors with the status', async () => {
      const response = new Response('Internal Server Error', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      })

      await expect(unwrapResponse(response)).rejects.toMatchObject({
        name: 'ApiRequestError',
        status: 500,
        message: i18n.global.t('request.serverError', { status: 500 }),
      })
    })

    it('reports generic 4xx errors with the status', async () => {
      const response = new Response('Not Found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' },
      })

      await expect(unwrapResponse(response)).rejects.toMatchObject({
        name: 'ApiRequestError',
        status: 404,
        message: i18n.global.t('request.httpError', { status: 404 }),
      })
    })
  })

  it('keeps "not valid JSON" only for success statuses with a malformed body', async () => {
    const response = new Response('<html>unexpected</html>', { status: 200 })

    await expect(unwrapResponse(response)).rejects.toMatchObject({
      name: 'ApiRequestError',
      status: 200,
      message: i18n.global.t('request.invalidJson'),
    })
  })

  describe('normalizeRequestError', () => {
    it('passes business errors through unchanged', () => {
      const businessError = new ApiRequestError('invalid credentials', { status: 401 })

      expect(() => normalizeRequestError(businessError)).toThrow(businessError)
    })

    it('converts network-level failures into a localized message', () => {
      expect(() => normalizeRequestError(new TypeError('Failed to fetch'))).toThrowError(
        i18n.global.t('request.networkError'),
      )
    })
  })
})
