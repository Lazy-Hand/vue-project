import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import { pinia } from '@/stores'
import { useAuthStore } from '@/stores/auth'
import DashboardPage from './index.vue'

vi.mock('@/api/dashboard', () => ({
  fetchDashboardOverview: vi.fn<() => Promise<DashboardOverview>>(),
}))

vi.mock('@/utils/request', () => ({
  ApiRequestError: class ApiRequestError extends Error {},
}))

import { fetchDashboardOverview } from '@/api/dashboard'
import type { DashboardOverview } from '@/types/dashboard'

const OVERVIEW: DashboardOverview = {
  userCount: 24,
  enabledUserCount: 20,
  roleCount: 6,
  deptCount: 8,
  fileCount: 128,
  todayOperationCount: 100,
  todayFailedOperationCount: 4,
  periodStart: '2026-08-17T00:00:00.000Z',
  periodEnd: '2026-08-18T00:00:00.000Z',
}

import { createRouter, createMemoryHistory } from 'vue-router'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/', component: { template: '<div />' } }],
})

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
    i18n.global.locale.value = 'zh-CN'
    useAuthStore(pinia).setAccess([], ['system:dashboard:query'])
  })

  it('renders overview numbers from the API', async () => {
    vi.mocked(fetchDashboardOverview).mockResolvedValue(OVERVIEW)

    const wrapper = mount(DashboardPage, { global: { plugins: [i18n, router] } })
    await flushPromises()

    expect(fetchDashboardOverview).toHaveBeenCalledTimes(1)
    const texts = wrapper.text()
    expect(texts).toContain('24')
    expect(texts).toContain('20')
    expect(texts).toContain('6')
    expect(texts).toContain('8')
    expect(texts).toContain('128')
    expect(texts).toContain('100')
    expect(texts).toContain('4')
  })

  it('computes the success rate as a percentage', async () => {
    vi.mocked(fetchDashboardOverview).mockResolvedValue(OVERVIEW)

    const wrapper = mount(DashboardPage, { global: { plugins: [i18n, router] } })
    await flushPromises()

    // (100 - 4) / 100 = 96.0%
    expect(wrapper.text()).toContain('96.0')
  })

  it('shows a dash for the success rate when there are no operations', async () => {
    vi.mocked(fetchDashboardOverview).mockResolvedValue({
      ...OVERVIEW,
      todayOperationCount: 0,
      todayFailedOperationCount: 0,
    })

    const wrapper = mount(DashboardPage, { global: { plugins: [i18n, router] } })
    await flushPromises()

    const rateCard = wrapper.findAll('.ant-card').find((card) => card.text().includes('成功率'))
    expect(rateCard).toBeDefined()
    expect(rateCard?.find('.ant-statistic-content-value').text()).toBe('-')
  })

  it('skips the request without the dashboard query permission', async () => {
    useAuthStore(pinia).setAccess([], [])

    const wrapper = mount(DashboardPage, { global: { plugins: [i18n, router] } })
    await flushPromises()

    expect(fetchDashboardOverview).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('-')
  })
})
