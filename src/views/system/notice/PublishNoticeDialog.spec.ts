import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import PublishNoticeDialog from './PublishNoticeDialog.vue'

vi.mock('@/api/notice', () => ({
  publishNotice: vi.fn<(payload: Record<string, unknown> | undefined) => Promise<unknown>>(),
}))

vi.mock('@/api/role', () => ({
  fetchRoles: vi.fn<() => Promise<Array<{ id: string; name: string }>>>(),
}))

vi.mock('@/api/post', () => ({
  fetchPosts: vi.fn<() => Promise<Array<{ id: string; name: string }>>>(),
}))

vi.mock('@/api/dept', () => ({
  fetchDeptTree: vi.fn<() => Promise<Array<{ id: string; name: string; children: unknown[] }>>>(),
}))

vi.mock('@/api/user', () => ({
  fetchUserList: vi.fn<() => Promise<{ items: unknown[]; total: number }>>(),
}))

vi.mock('@/utils/request', () => ({
  ApiRequestError: class ApiRequestError extends Error {},
}))

import { publishNotice } from '@/api/notice'
import { fetchDeptTree } from '@/api/dept'
import { fetchPosts } from '@/api/post'
import { fetchRoles } from '@/api/role'
import { fetchUserList } from '@/api/user'

describe('PublishNoticeDialog', () => {
  let wrapper: ReturnType<typeof mount>

  function mountDialog(): ReturnType<typeof mount> {
    return mount(PublishNoticeDialog, {
      props: { modelValue: true, noticeId: '7' },
      global: { plugins: [i18n] },
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    i18n.global.locale.value = 'zh-CN'
    document.body.innerHTML = ''

    vi.mocked(fetchRoles).mockResolvedValue([
      {
        id: '1',
        code: 'r1',
        name: '测试角色',
        description: null,
        dataScope: 'ALL',
        sort: 0,
        enabled: true,
      },
    ])
    vi.mocked(fetchPosts).mockResolvedValue([
      {
        id: '2',
        code: 'p2',
        name: '测试岗位',
        sort: 0,
        enabled: true,
        description: null,
        createdAt: '2026-08-18T00:00:00.000Z',
        updatedAt: '2026-08-18T00:00:00.000Z',
      },
    ])
    vi.mocked(fetchDeptTree).mockResolvedValue([])
    vi.mocked(fetchUserList).mockResolvedValue({
      items: [
        {
          id: '9',
          username: 'user9',
          nickname: null,
          email: null,
          phone: null,
          avatar: null,
          deptId: null,
          deptName: null,
          enabled: true,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 100,
      totalPages: 1,
    })
  })

  afterEach(() => {
    wrapper?.unmount()
    document.body.innerHTML = ''
  })

  it('loads audience options and renders the five scope choices', async () => {
    wrapper = mountDialog()
    await flushPromises()

    expect(fetchRoles).toHaveBeenCalled()
    expect(fetchPosts).toHaveBeenCalled()
    expect(fetchDeptTree).toHaveBeenCalled()
    expect(fetchUserList).toHaveBeenCalled()
    expect(wrapper.findAll('.ant-radio-wrapper')).toHaveLength(5)
  })

  it('publishes to everyone by default and emits success', async () => {
    vi.mocked(publishNotice).mockResolvedValue({
      id: '7',
      title: '公告',
      content: '内容',
      status: 'PUBLISHED',
      targetScope: 'ALL',
      publishedAt: '2026-08-18T00:00:00.000Z',
      createdAt: '2026-08-18T00:00:00.000Z',
      updatedAt: '2026-08-18T00:00:00.000Z',
    })
    wrapper = mountDialog()
    await flushPromises()

    await wrapper.find('button.ant-btn-primary').trigger('click')
    await flushPromises()

    expect(publishNotice).toHaveBeenCalledWith('7', { targetScope: 'ALL' })
    expect(wrapper.emitted('success')).toBeTruthy()
  })

  it('blocks publishing a scoped notice without a selection', async () => {
    wrapper = mountDialog()
    await flushPromises()

    // 选择「按角色」但未选任何角色
    await wrapper.findAll<HTMLInputElement>('input[type="radio"]')[2]!.setValue()
    await flushPromises()

    await wrapper.find('button.ant-btn-primary').trigger('click')
    await flushPromises()

    expect(publishNotice).not.toHaveBeenCalled()
  })

  it('shows the matching picker when switching the scope to users', async () => {
    wrapper = mountDialog()
    await flushPromises()

    await wrapper.findAll<HTMLInputElement>('input[type="radio"]')[1]!.setValue()
    await flushPromises()

    expect(wrapper.find('.notice-publish__picker .ant-select').exists()).toBe(true)
  })
})
