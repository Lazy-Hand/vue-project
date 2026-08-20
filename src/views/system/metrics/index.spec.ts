import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import { pinia } from '@/stores'
import { useAuthStore } from '@/stores/auth'
import MetricsPage from './index.vue'

import type { DetailedHealthStatus } from '@/types/health'

vi.mock('@/api/metrics', () => ({
  fetchMetricsText: vi.fn<() => Promise<string>>(),
  fetchDetailedHealthStatus: vi.fn<() => Promise<DetailedHealthStatus>>(),
}))

vi.mock('@/utils/request', () => ({
  ApiRequestError: class ApiRequestError extends Error {},
}))

import { fetchDetailedHealthStatus, fetchMetricsText } from '@/api/metrics'

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

  it('renders parsed metrics from Prometheus exposition text and health detail', async () => {
    vi.mocked(fetchMetricsText).mockResolvedValue(SAMPLE_PROMETHEUS)
    vi.mocked(fetchDetailedHealthStatus).mockResolvedValue({
      status: 'ok',
      uptimeSeconds: 1200,
      database: {
        status: 'up',
        latencyMs: 12,
        version: 'PostgreSQL 16.2',
      },
      redis: {
        status: 'up',
        latencyMs: 3,
        usedMemoryHuman: '15.2M',
        connectedClients: 8,
      },
      process: {
        nodeVersion: 'v22.12.0',
        memoryRssBytes: 104857600,
        memoryHeapUsedBytes: 33554432,
        memoryHeapTotalBytes: 67108864,
      },
    })

    const wrapper = mount(MetricsPage, { global: { plugins: [i18n] } })
    await flushPromises()

    expect(fetchMetricsText).toHaveBeenCalledTimes(1)
    expect(fetchDetailedHealthStatus).toHaveBeenCalledTimes(1)
    const text = wrapper.text()
    expect(text).toContain('系统运行指标')
    expect(text).toContain('120.50s') // CPU time
    expect(text).toContain('5.0ms') // Event loop lag
    expect(text).toContain('12') // Active handles
    expect(text).toContain('3') // Active requests
    expect(text).toContain('PostgreSQL 数据库')
    expect(text).toContain('12ms')
    expect(text).toContain('PostgreSQL 16.2')
    expect(text).toContain('Redis 缓存服务')
    expect(text).toContain('3ms')
    expect(text).toContain('15.2M')
  })

  it('skips loading metrics when user has no query permission', async () => {
    useAuthStore(pinia).setAccess([], [])

    mount(MetricsPage, { global: { plugins: [i18n] } })
    await flushPromises()

    expect(fetchMetricsText).not.toHaveBeenCalled()
  })
})
