import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import type { Job, JobHandlerOption } from '@/types/scheduler'
import TaskFormDialog from './TaskFormDialog.vue'

vi.mock('@/api/scheduler', () => ({
  createJob: vi.fn<() => Promise<Job>>(),
  updateJob: vi.fn<() => Promise<Job>>(),
}))

vi.mock('@/utils/request', () => ({
  ApiRequestError: class ApiRequestError extends Error {},
}))

import { updateJob } from '@/api/scheduler'

describe('TaskFormDialog.vue', () => {
  const handlers: JobHandlerOption[] = [
    {
      name: 'operationLogRetention',
      label: '系统日志清理',
      description: '清理过期日志',
      defaultArgs: '{"retentionDays": 90}',
    },
  ]

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
  })

  it('renders create dialog with default handlers', async () => {
    const wrapper = mount(TaskFormDialog, {
      props: {
        open: true,
        job: null,
        handlers,
      },
      global: { plugins: [i18n] },
    })
    await flushPromises()

    const text = wrapper.text() || document.body.textContent || ''
    expect(text).toContain('新增定时任务')
    expect(text).toContain('任务名称')
    expect(text).toContain('Cron 表达式')
  })

  it('renders edit dialog in edit mode', async () => {
    vi.mocked(updateJob).mockResolvedValue({
      id: '1',
      jobName: 'op-log',
      jobGroup: 'SYSTEM',
      invokeTarget: 'operationLogRetention',
      cronExpression: '0 0 0 * * *',
      misfirePolicy: 'DEFAULT',
      concurrent: false,
      status: 'ENABLED',
      args: null,
      remark: null,
      createdAt: '2026-08-01T00:00:00Z',
      updatedAt: '2026-08-01T00:00:00Z',
    })

    const wrapper = mount(TaskFormDialog, {
      props: {
        open: true,
        job: {
          id: '1',
          jobName: 'op-log',
          jobGroup: 'SYSTEM',
          invokeTarget: 'operationLogRetention',
          cronExpression: '0 0 0 * * *',
          misfirePolicy: 'DEFAULT',
          concurrent: false,
          status: 'ENABLED',
          args: null,
          remark: null,
          createdAt: '2026-08-01T00:00:00Z',
          updatedAt: '2026-08-01T00:00:00Z',
        },
        handlers,
      },
      global: { plugins: [i18n] },
    })
    await flushPromises()

    const text = wrapper.text() || document.body.textContent || ''
    expect(text).toContain('编辑定时任务')
  })
})
