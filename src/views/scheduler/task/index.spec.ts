import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import { pinia } from '@/stores'
import { useAuthStore } from '@/stores/auth'
import type { PaginatedResult } from '@/types/common'
import type { Job, JobHandlerOption } from '@/types/scheduler'
import TaskPage from './index.vue'

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push: vi.fn<() => void>() }),
}))

vi.mock('@/api/scheduler', () => ({
  fetchJobList: vi.fn<() => Promise<PaginatedResult<Job>>>(),
  fetchJobHandlerOptions: vi.fn<() => Promise<JobHandlerOption[]>>(),
  changeJobStatus: vi.fn<() => Promise<Job>>(),
  runJobOnce: vi.fn<() => Promise<{ success: boolean }>>(),
  deleteJob: vi.fn<() => Promise<{ success: boolean }>>(),
}))

vi.mock('@/utils/request', () => ({
  ApiRequestError: class ApiRequestError extends Error {},
}))

import { fetchJobHandlerOptions, fetchJobList } from '@/api/scheduler'

describe('TaskPage (index.vue)', () => {
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
      [
        'system:scheduler:task:query',
        'system:scheduler:task:create',
        'system:scheduler:task:update',
        'system:scheduler:task:delete',
        'system:scheduler:task:status',
        'system:scheduler:task:run',
      ],
    )
  })

  it('renders task list and calls fetchJobList', async () => {
    vi.mocked(fetchJobHandlerOptions).mockResolvedValue([
      { name: 'operationLogRetention', label: '日志清理', description: 'desc' },
    ])
    vi.mocked(fetchJobList).mockResolvedValue({
      items: [
        {
          id: '1',
          jobName: 'operation-log-retention',
          jobGroup: 'SYSTEM',
          invokeTarget: 'operationLogRetention',
          cronExpression: '0 0 0 * * *',
          runAt: null,
          misfirePolicy: 'DEFAULT',
          concurrent: false,
          status: 'ENABLED',
          args: null,
          remark: '清理日志',
          createdAt: '2026-08-19T00:00:00.000Z',
          updatedAt: '2026-08-19T00:00:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    })

    const wrapper = mount(TaskPage, { global: { plugins: [i18n] } })
    await flushPromises()

    expect(fetchJobList).toHaveBeenCalledTimes(1)
    const text = wrapper.text()
    expect(text).toContain('operation-log-retention')
    expect(text).toContain('SYSTEM')
    expect(text).toContain('0 0 0 * * *')
    expect(text).toContain('新增任务')
  })

  it('skips loading when permission is missing', async () => {
    useAuthStore(pinia).setAccess([], [])

    mount(TaskPage, { global: { plugins: [i18n] } })
    await flushPromises()

    expect(fetchJobList).not.toHaveBeenCalled()
  })
})
