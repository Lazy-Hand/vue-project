import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import { pinia } from '@/stores'
import { useAuthStore } from '@/stores/auth'
import type { PaginatedResult } from '@/types/common'
import type {
  CleanLoginLogResult,
  CleanOperationLogResult,
  LoginLog,
  OperationLog,
} from '@/types/log'
import LogPage from './index.vue'

vi.mock('@/api/log', () => ({
  fetchOperationLogList: vi.fn<() => Promise<PaginatedResult<OperationLog>>>(),
  cleanOperationLogs: vi.fn<() => Promise<CleanOperationLogResult>>(),
  fetchLoginLogList: vi.fn<() => Promise<PaginatedResult<LoginLog>>>(),
  cleanLoginLogs: vi.fn<() => Promise<CleanLoginLogResult>>(),
}))

vi.mock('@/utils/request', () => ({
  ApiRequestError: class ApiRequestError extends Error {},
}))

import { fetchLoginLogList, fetchOperationLogList } from '@/api/log'

describe('LogPage (index.vue)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.matchMedia ??= (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    })
    i18n.global.locale.value = 'zh-CN'
    useAuthStore(pinia).setAccess(
      [],
      ['system:log:query', 'system:log:delete', 'system:log:loginQuery', 'system:log:loginDelete'],
    )
  })

  it('renders operation logs and login logs tabs', async () => {
    vi.mocked(fetchOperationLogList).mockResolvedValue({
      items: [
        {
          id: '1',
          userId: '1',
          username: 'admin',
          module: 'user',
          action: 'create',
          method: 'POST',
          path: '/api/user',
          statusCode: 201,
          success: true,
          errorMessage: null,
          durationMs: 32,
          ip: '127.0.0.1',
          userAgent: 'Mozilla',
          params: '{}',
          createdAt: '2026-08-19T00:00:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    })

    vi.mocked(fetchLoginLogList).mockResolvedValue({
      items: [
        {
          id: '1',
          userId: '1',
          username: 'admin',
          loginType: 'PASSWORD',
          success: true,
          failReason: null,
          ip: '127.0.0.1',
          userAgent: 'Mozilla',
          createdAt: '2026-08-19T00:00:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    })

    const wrapper = mount(LogPage, { global: { plugins: [i18n] } })
    await flushPromises()

    expect(fetchOperationLogList).toHaveBeenCalledTimes(1)
    const text = wrapper.text()
    expect(text).toContain('操作日志')
    expect(text).toContain('登录日志')
    expect(text).toContain('POST')
    expect(text).toContain('/api/user')
  })

  it('activates login log tab if only loginQuery permission is held', async () => {
    useAuthStore(pinia).setAccess([], ['system:log:loginQuery'])
    vi.mocked(fetchLoginLogList).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
    })

    const wrapper = mount(LogPage, { global: { plugins: [i18n] } })
    await flushPromises()

    expect(fetchOperationLogList).not.toHaveBeenCalled()
    expect(fetchLoginLogList).toHaveBeenCalled()
    const text = wrapper.text()
    expect(text).toContain('登录日志')
  })
})
