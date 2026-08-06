import type { ApiErrorDetails, ApiResponse } from '@/types/auth'

export class ApiRequestError extends Error {
  readonly status?: number
  readonly code?: number
  readonly errors?: unknown

  constructor(message: string, details: ApiErrorDetails = {}) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = details.status
    this.code = details.code
    this.errors = details.errors
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

async function readResponseBody(response: unknown): Promise<unknown> {
  if (!isRecord(response)) return response
  if (typeof response.json === 'function') return response.json()

  return response
}

export async function unwrapResponse<T>(response: Response | ApiResponse<T>): Promise<T> {
  const status =
    isRecord(response) && typeof response.status === 'number' ? response.status : undefined
  let body: unknown

  try {
    body = await readResponseBody(response)
  } catch (error) {
    throw new ApiRequestError('响应不是有效的 JSON 数据', {
      status,
      errors: error,
    })
  }

  if (!isRecord(body)) {
    throw new ApiRequestError('响应格式无效', { status })
  }

  const code = typeof body.code === 'number' ? body.code : undefined
  const message = typeof body.message === 'string' ? body.message : '请求失败'
  const isHttpError = status !== undefined && (status < 200 || status >= 300)

  if (isHttpError || code !== 0 || !('data' in body)) {
    throw new ApiRequestError(message, { status, code, errors: body.errors })
  }

  return body.data as T
}
