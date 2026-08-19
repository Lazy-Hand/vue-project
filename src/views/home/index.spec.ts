import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRouter, createMemoryHistory } from 'vue-router'

import { i18n } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import type { DashboardOverview } from '@/types/dashboard'
import type { PaginatedResult } from '@/types/common'
import type { PublishedNotice } from '@/types/notice'
import HomeView from './index.vue'

vi.mock('@/api/dashboard', () => ({
  fetchDashboardOverview: vi.fn<() => Promise<DashboardOverview>>().mockResolvedValue({
    userCount: 100,
    enabledUserCount: 90,
    roleCount: 8,
    deptCount: 12,
    fileCount: 45,
    todayOperationCount: 30,
    todayFailedOperationCount: 0,
    periodStart: '2026-08-19T00:00:00Z',
    periodEnd: '2026-08-19T23:59:59Z',
  }),
}))

vi.mock('@/api/notice', () => ({
  fetchPublishedNotices: vi
    .fn<() => Promise<PaginatedResult<PublishedNotice>>>()
    .mockResolvedValue({
      items: [
        {
          id: '1',
          title: '系统升级通知',
          content: '升级说明',
          status: 'PUBLISHED',
          targetScope: 'ALL',
          createdAt: '2026-08-19T00:00:00Z',
          updatedAt: '2026-08-19T00:00:00Z',
          publishedAt: '2026-08-19T00:00:00Z',
          read: false,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    }),
}))

describe('Home Launchpad (index.vue)', () => {
  let router: ReturnType<typeof createRouter>

  beforeEach(async () => {
    setActivePinia(createPinia())
    i18n.global.locale.value = 'zh-CN'
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

    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'home', component: HomeView },
        { path: '/system/user', name: 'user', component: { template: '<div>User</div>' } },
        { path: '/system/dept', name: 'dept', component: { template: '<div>Dept</div>' } },
        { path: '/system/notice', name: 'notice', component: { template: '<div>Notice</div>' } },
      ],
    })

    await router.push('/')
    await router.isReady()
  })

  it('renders user greeting and account set', async () => {
    const authStore = useAuthStore()
    authStore.user = {
      id: '1',
      username: 'admin',
      nickname: '超级管理员',
      email: 'admin@example.com',
      phone: '13800000000',
      avatar: null,
      enabled: true,
    }
    authStore.setAccountSets([
      { id: '1', code: 'default', name: '标准账套', isDefault: true, enabled: true },
    ])

    const wrapper = mount(HomeView, {
      global: {
        plugins: [i18n, router],
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('超级管理员')
    expect(wrapper.text()).toContain('标准账套')
  })

  it('renders launchpad app cards and handles navigation', async () => {
    const pushSpy = vi.spyOn(router, 'push')

    const wrapper = mount(HomeView, {
      global: {
        plugins: [i18n, router],
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('用户管理')
    expect(wrapper.text()).toContain('角色管理')
    expect(wrapper.text()).toContain('部门架构')

    const userCard = wrapper.findAll('.launchpad-card')[0]
    expect(userCard).toBeDefined()
    await userCard?.trigger('click')

    expect(pushSpy).toHaveBeenCalledWith('/system/user')
  })

  it('renders overview stats from dashboard API', async () => {
    const wrapper = mount(HomeView, {
      global: {
        plugins: [i18n, router],
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('100')
    expect(wrapper.text()).toContain('100.0%')
  })

  it('renders published notices from API', async () => {
    const wrapper = mount(HomeView, {
      global: {
        plugins: [i18n, router],
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('系统升级通知')
  })
})
