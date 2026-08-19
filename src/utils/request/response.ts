import { i18n } from '@/i18n'
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

function translate(key: string, params: Record<string, unknown> = {}): string {
  return i18n.global.t(key, params) as string
}

/**
 * 网关/代理层错误（后端不可达时返回的 502/503/504 等非 JSON 错误页）
 * 给出贴近真实原因的提示，而不是误导性的「响应不是有效的 JSON」。
 */
function httpFallbackMessage(status: number | undefined): string {
  if (status === 502 || status === 503 || status === 504) {
    return translate('request.serviceUnavailable', { status })
  }
  if (status !== undefined && status >= 500) {
    return translate('request.serverError', { status })
  }
  return translate('request.httpError', { status })
}

async function readResponseBody(response: unknown): Promise<unknown> {
  if (!isRecord(response)) return response
  if (typeof response.json === 'function') return response.json()

  return response
}

/** 把网络层错误（如 fetch 被拒）转成面向用户的本地化提示，业务错误原样透传。 */
export function normalizeRequestError(error: unknown): never {
  if (error instanceof ApiRequestError) throw error
  throw new ApiRequestError(translate('request.networkError'), { errors: error })
}

export async function unwrapResponse<T>(response: Response | ApiResponse<T>): Promise<T> {
  const status =
    isRecord(response) && typeof response.status === 'number' ? response.status : undefined

  if (response instanceof Response && (status === 204 || status === 205)) {
    return undefined as T
  }

  const isHttpError = status !== undefined && (status < 200 || status >= 300)

  let body: unknown

  try {
    body = await readResponseBody(response)
  } catch (error) {
    if (isHttpError) {
      throw new ApiRequestError(httpFallbackMessage(status), { status, errors: error })
    }
    throw new ApiRequestError(translate('request.invalidJson'), { status, errors: error })
  }

  if (!isRecord(body)) {
    if (isHttpError) {
      throw new ApiRequestError(httpFallbackMessage(status), { status, errors: body })
    }
    throw new ApiRequestError(translate('request.invalidFormat'), { status })
  }

  const code = typeof body.code === 'number' ? body.code : undefined
  const message =
    typeof body.message === 'string' ? body.message : translate('request.requestFailed')

  if (isHttpError || code !== 0) {
    throw new ApiRequestError(message, { status, code, errors: body.errors })
  }

  // 部分接口（如删除）可能返回缺失 data 字段的成功信封，视为成功并返回 undefined
  return ('data' in body ? body.data : undefined) as T
}
