import { describe, expect, it } from 'vitest'

import { unwrapResponse } from './response'

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
})
