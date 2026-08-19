import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import { pinia } from '@/stores'
import { useAuthStore } from '@/stores/auth'
import MetricsPage from './index.vue'

vi.mock('@/api/metrics', () => ({
  fetchMetricsText: vi.fn<() => Promise<string>>(),
}))

vi.mock('@/utils/request', () => ({
  ApiRequestError: class ApiRequestError extends Error {},
}))

import { fetchMetricsText } from '@/api/metrics'

const SAMPLE_PROMETHEUS = `
# HELP process_cpu_seconds_total Total user and system CPU time spent in seconds.
# TYPE process_cpu_seconds_total counter
process_cpu_seconds_total 120.5
# HELP process_resident_memory_bytes Resident memory size in bytes.
# TYPE process_resident_memory_bytes gauge
process_resident_memory_bytes 104857600
nodejs_eventloop_lag_seconds{quantile="0.5"} 0.005
http_requests_total{method="GET",route="/api/user/list",status_code="200"} 42
process_start_time_seconds 1700000000
nodejs_heap_size_used_bytes 33554432
nodejs_heap_size_total_bytes 67108864
nodejs_external_memory_bytes 1048576
nodejs_active_handles 12
nodejs_active_requests 3
`

describe('MetricsPage (index.vue)', () => {
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
    useAuthStore(pinia).setAccess([], ['system:metrics:query'])
  })

  it('renders parsed metrics from Prometheus exposition text', async () => {
    vi.mocked(fetchMetricsText).mockResolvedValue(SAMPLE_PROMETHEUS)

    const wrapper = mount(MetricsPage, { global: { plugins: [i18n] } })
    await flushPromises()

    expect(fetchMetricsText).toHaveBeenCalledTimes(1)
    const text = wrapper.text()
    expect(text).toContain('系统运行指标')
    expect(text).toContain('120.50s') // CPU time
    expect(text).toContain('5.0ms') // Event loop lag
    expect(text).toContain('12') // Active handles
    expect(text).toContain('3') // Active requests
  })

  it('skips loading metrics when user has no query permission', async () => {
    useAuthStore(pinia).setAccess([], [])

    mount(MetricsPage, { global: { plugins: [i18n] } })
    await flushPromises()

    expect(fetchMetricsText).not.toHaveBeenCalled()
  })
})
