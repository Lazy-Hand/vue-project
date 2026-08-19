import { createAlovaMockAdapter } from '@alova/mock'
import adapterFetch from 'alova/fetch'
import authMock from './auth'

/**
 * alova 的 fetch 适配器只要未显式设置 Content-Type 就会补上 application/json，
 * 即使请求体为空（undefined/null）。Fastify 对「声明了 JSON Content-Type 但无
 * 请求体」的请求一律返回 400（publish / mark-read / read-all 等无参数写请求都会
 * 命中）。这里在真正发出前判断：没有请求体就不带 Content-Type，避免空体 JSON 报错。
 */
function fetchWithoutEmptyJsonBody(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers)
  const hasBody = init?.body !== undefined && init?.body !== null

  if (!hasBody) {
    headers.delete('content-type')
  }

  return fetch(input, { ...init, headers })
}

const fetchAdapter = adapterFetch({ customFetch: fetchWithoutEmptyJsonBody })

export const mockEnabled =
  import.meta.env.DEV &&
  import.meta.env.MODE !== 'test' &&
  import.meta.env.VITE_ENABLE_MOCK !== 'false'

export const requestAdapter = mockEnabled
  ? createAlovaMockAdapter([], {
      httpAdapter: fetchAdapter,
      delay: 300,
      matchMode: 'methodurl',
      mockRequestLogger: true,
    })
  : fetchAdapter
