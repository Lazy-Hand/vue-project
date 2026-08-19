import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import NoticeBell from './NoticeBell.vue'

vi.mock('@/api/notice', () => ({
  fetchPublishedNotices:
    vi.fn<(query?: NoticeQuery) => Promise<PaginatedResult<PublishedNotice>>>(),
  fetchUnreadNoticeCount: vi.fn<() => Promise<NoticeCountResult>>(),
  markNoticeRead: vi.fn<(id: string) => Promise<void>>(),
  markAllNoticesRead: vi.fn<() => Promise<NoticeCountResult>>(),
}))

vi.mock('@/utils/request', () => ({
  ApiRequestError: class ApiRequestError extends Error {},
}))

import {
  fetchPublishedNotices,
  fetchUnreadNoticeCount,
  markAllNoticesRead,
  markNoticeRead,
} from '@/api/notice'
import type { PaginatedResult } from '@/types/common'
import type { NoticeCountResult, NoticeQuery, PublishedNotice } from '@/types/notice'

const PUBLISHED_NOTICES: PublishedNotice[] = [
  {
    id: '1',
    title: '系统维护公告',
    content: '系统将于今晚进行维护。',
    status: 'PUBLISHED',
    targetScope: 'ALL',
    publishedAt: '2026-08-13T00:00:00.000Z',
    createdAt: '2026-08-13T00:00:00.000Z',
    updatedAt: '2026-08-13T00:00:00.000Z',
    read: false,
  },
  {
    id: '2',
    title: '新版本上线通知',
    content: 'v2.0 已上线。',
    status: 'PUBLISHED',
    targetScope: 'ALL',
    publishedAt: '2026-08-12T00:00:00.000Z',
    createdAt: '2026-08-12T00:00:00.000Z',
    updatedAt: '2026-08-12T00:00:00.000Z',
    read: true,
  },
]

function mockPublishedList(items: PublishedNotice[] = PUBLISHED_NOTICES): void {
  // 浅拷贝元素，避免用例间共享引用（点击已读会修改原对象）
  vi.mocked(fetchPublishedNotices).mockResolvedValue({
    items: items.map((item) => ({ ...item })),
    total: items.length,
    page: 1,
    pageSize: 10,
    totalPages: 1,
  })
}

async function openPanel(wrapper: ReturnType<typeof mount>): Promise<void> {
  await wrapper.find('.notice-bell__trigger').trigger('click')
  await new Promise((resolve) => setTimeout(resolve, 50))
  await flushPromises()
}

function panelItems(): NodeListOf<Element> {
  return document.body.querySelectorAll('.notice-bell__item')
}

describe('NoticeBell', () => {
  let wrapper: ReturnType<typeof mount>

  beforeEach(() => {
    vi.clearAllMocks()
    i18n.global.locale.value = 'zh-CN'
    document.body.innerHTML = ''
  })

  afterEach(() => {
    wrapper?.unmount()
    document.body.innerHTML = ''
  })

  it('renders the unread badge count on mount', async () => {
    vi.mocked(fetchUnreadNoticeCount).mockResolvedValue({ count: 3 })

    wrapper = mount(NoticeBell, { global: { plugins: [i18n] } })
    await flushPromises()

    expect(wrapper.find('.ant-badge-count').text()).toBe('3')
  })

  it('loads published notices with unread dots when the panel opens', async () => {
    vi.mocked(fetchUnreadNoticeCount).mockResolvedValue({ count: 1 })
    mockPublishedList()

    wrapper = mount(NoticeBell, { global: { plugins: [i18n] } })
    await flushPromises()
    await openPanel(wrapper)

    expect(fetchPublishedNotices).toHaveBeenCalledWith({ page: 1, pageSize: 10 })
    expect(panelItems()).toHaveLength(2)
    expect(document.body.querySelector('.notice-bell__dot')).toBeTruthy()
  })

  it('marks an unread notice as read when clicked and updates the badge', async () => {
    vi.mocked(fetchUnreadNoticeCount).mockResolvedValue({ count: 1 })
    vi.mocked(markNoticeRead).mockResolvedValue(undefined)
    mockPublishedList()

    wrapper = mount(NoticeBell, { global: { plugins: [i18n] } })
    await flushPromises()
    await openPanel(wrapper)

    const firstItem = document.body.querySelector('.notice-bell__item')
    expect(firstItem).toBeTruthy()
    ;(firstItem as HTMLElement).click()
    await flushPromises()

    expect(markNoticeRead).toHaveBeenCalledWith('1')
    // Badge 在 count 为 0 时隐藏
    expect(wrapper.find('.ant-badge-count').exists()).toBe(false)

    // 关闭详情弹窗与通知面板，避免残留影响后续用例
    const closeButton = wrapper.find('.ant-modal-close')
    if (closeButton.exists()) await closeButton.trigger('click')
    await wrapper.find('.notice-bell__trigger').trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 50))
    await flushPromises()
  })

  it('marks all notices as read and clears the badge', async () => {
    vi.mocked(fetchUnreadNoticeCount).mockResolvedValue({ count: 1 })
    vi.mocked(markAllNoticesRead).mockResolvedValue({ count: 1 })
    mockPublishedList()

    wrapper = mount(NoticeBell, { global: { plugins: [i18n] } })
    await flushPromises()
    await openPanel(wrapper)

    const markAllButton = document.body.querySelector('.notice-bell__mark-all') as HTMLElement
    expect(markAllButton).toBeTruthy()
    markAllButton.click()
    await flushPromises()

    expect(markAllNoticesRead).toHaveBeenCalled()
    expect(document.body.querySelector('.notice-bell__dot')).toBeNull()
    expect(wrapper.find('.ant-badge-count').exists()).toBe(false)
  })

  it('shows an empty state when there are no published notices', async () => {
    vi.mocked(fetchUnreadNoticeCount).mockResolvedValue({ count: 0 })
    mockPublishedList([])

    wrapper = mount(NoticeBell, { global: { plugins: [i18n] } })
    await flushPromises()
    await openPanel(wrapper)

    expect(panelItems()).toHaveLength(0)
    expect(document.body.querySelector('.notice-bell__empty')).toBeTruthy()
  })
})
