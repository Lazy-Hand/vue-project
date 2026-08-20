import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import { pinia } from '@/stores'
import { useAuthStore } from '@/stores/auth'
import type { PaginatedResult } from '@/types/common'
import type { JobLog } from '@/types/scheduler'
import LogPage from './index.vue'

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push: vi.fn<() => void>() }),
}))

vi.mock('@/api/scheduler', () => ({
  fetchJobLogList: vi.fn<() => Promise<PaginatedResult<JobLog>>>(),
  fetchJobLogDetail: vi.fn<() => Promise<JobLog>>(),
  cleanJobLogs: vi.fn<() => Promise<{ count: number }>>(),
  deleteJobLog: vi.fn<() => Promise<{ success: boolean }>>(),
}))

vi.mock('@/utils/request', () => ({
  ApiRequestError: class ApiRequestError extends Error {},
}))

import { fetchJobLogList } from '@/api/scheduler'

describe('LogPage (scheduler/log/index.vue)', () => {
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
    useAuthStore(pinia).setAccess([], ['system:scheduler:log:query', 'system:scheduler:log:delete'])
  })

  it('renders log list and calls fetchJobLogList', async () => {
    vi.mocked(fetchJobLogList).mockResolvedValue({
      items: [
        {
          id: '1',
          jobId: '1',
          jobName: 'operation-log-retention',
          jobGroup: 'SYSTEM',
          invokeTarget: 'operationLogRetention',
          args: null,
          status: 'SUCCESS',
          message: 'deletedCount=12',
          exceptionInfo: null,
          durationMs: 45,
          triggeredBy: 'scheduler',
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

    expect(fetchJobLogList).toHaveBeenCalledTimes(1)
    const text = wrapper.text()
    expect(text).toContain('operation-log-retention')
    expect(text).toContain('SYSTEM')
    expect(text).toContain('45ms')
    expect(text).toContain('定时调度')
    expect(text).toContain('清理历史')
  })

  it('skips loading when query permission is missing', async () => {
    useAuthStore(pinia).setAccess([], [])

    mount(LogPage, { global: { plugins: [i18n] } })
    await flushPromises()

    expect(fetchJobLogList).not.toHaveBeenCalled()
  })
})
