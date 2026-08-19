import { describe, expect, it } from 'vitest'

import {
  findSample,
  formatBytes,
  formatSeconds,
  formatUptime,
  getEventLoopStatus,
  getHeapUsagePercentage,
  getMethodTagColor,
  getStatusCodeTagColor,
  httpRequestStats,
  parsePrometheus,
  sumSamples,
} from './utils'

const METRICS_TEXT = `# HELP process_cpu_seconds_total Total user and system CPU time spent in seconds.
# TYPE process_cpu_seconds_total counter
process_cpu_seconds_total 120.5
# HELP process_resident_memory_bytes Resident memory size in bytes.
# TYPE process_resident_memory_bytes gauge
process_resident_memory_bytes 104857600
nodejs_eventloop_lag_seconds{quantile="0.5"} 0.012
nodejs_eventloop_lag_seconds{quantile="0.95"} 0.1
http_requests_total{method="GET",route="/api/user/list",status_code="200"} 42
http_requests_total{method="GET",route="/api/user/list",status_code="500"} 2
http_requests_total{method="POST",route="/api/auth/login",status_code="200"} 100
process_start_time_seconds 1.7e9

# HELP nodejs_heap_size_used_bytes Process heap size from Node.js in bytes.
# TYPE nodejs_heap_size_used_bytes gauge
nodejs_heap_size_used_bytes 33554432
`

describe('metrics page utilities', () => {
  it('parses Prometheus exposition text into samples', () => {
    const samples = parsePrometheus(METRICS_TEXT)

    expect(samples).toHaveLength(9)
    expect(samples[0]).toEqual({ name: 'process_cpu_seconds_total', labels: {}, value: 120.5 })
    expect(samples[1]).toEqual({
      name: 'process_resident_memory_bytes',
      labels: {},
      value: 104857600,
    })
    expect(samples[2]).toEqual({
      name: 'nodejs_eventloop_lag_seconds',
      labels: { quantile: '0.5' },
      value: 0.012,
    })
    // scientific notation
    expect(samples[7]).toEqual({ name: 'process_start_time_seconds', labels: {}, value: 1.7e9 })
  })

  it('ignores comments, blank lines and malformed lines', () => {
    const samples = parsePrometheus('# only a comment\n\nbad line without value\n')
    expect(samples).toEqual([])
  })

  it('finds a sample by name and labels', () => {
    const samples = parsePrometheus(METRICS_TEXT)

    expect(findSample(samples, 'process_cpu_seconds_total')).toBe(120.5)
    expect(findSample(samples, 'nodejs_eventloop_lag_seconds', { quantile: '0.95' })).toBe(0.1)
    expect(
      findSample(samples, 'nodejs_eventloop_lag_seconds', { quantile: '0.99' }),
    ).toBeUndefined()
    expect(findSample(samples, 'missing_metric')).toBeUndefined()
  })

  it('sums all samples of a name', () => {
    const samples = parsePrometheus(METRICS_TEXT)

    expect(sumSamples(samples, 'nodejs_eventloop_lag_seconds')).toBe(0.112)
    expect(sumSamples(samples, 'missing_metric')).toBeUndefined()
  })

  it('aggregates http request counters sorted by count', () => {
    const samples = parsePrometheus(METRICS_TEXT)
    const stats = httpRequestStats(samples)

    expect(stats).toEqual([
      { method: 'POST', route: '/api/auth/login', statusCode: '200', count: 100 },
      { method: 'GET', route: '/api/user/list', statusCode: '200', count: 42 },
      { method: 'GET', route: '/api/user/list', statusCode: '500', count: 2 },
    ])
  })

  it('formats bytes compactly', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1023)).toBe('1023 B')
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB')
    expect(formatBytes(2.25 * 1024 * 1024 * 1024)).toBe('2.25 GB')
    expect(formatBytes(undefined)).toBe('-')
  })

  it('formats uptime and seconds', () => {
    expect(formatUptime(45)).toBe('45s')
    expect(formatUptime(3661)).toBe('1h 1m 1s')
    expect(formatUptime(90061)).toBe('1d 1h 1m')
    expect(formatUptime(undefined)).toBe('-')

    expect(formatSeconds(120.5)).toBe('120.50s')
    expect(formatSeconds(undefined)).toBe('-')
  })

  it('computes heap usage percentage and event loop status', () => {
    expect(getHeapUsagePercentage(50, 100)).toBe(50)
    expect(getHeapUsagePercentage(undefined, 100)).toBe(0)
    expect(getHeapUsagePercentage(50, 0)).toBe(0)

    expect(getEventLoopStatus(0.005)).toBe('healthy')
    expect(getEventLoopStatus(0.025)).toBe('warning')
    expect(getEventLoopStatus(0.08)).toBe('critical')
    expect(getEventLoopStatus(undefined)).toBe('healthy')
  })

  it('resolves method and status code tag colors', () => {
    expect(getMethodTagColor('GET')).toBe('blue')
    expect(getMethodTagColor('POST')).toBe('green')
    expect(getMethodTagColor('PUT')).toBe('orange')
    expect(getMethodTagColor('DELETE')).toBe('red')
    expect(getMethodTagColor('UNKNOWN')).toBe('default')

    expect(getStatusCodeTagColor(200)).toBe('green')
    expect(getStatusCodeTagColor(304)).toBe('blue')
    expect(getStatusCodeTagColor(404)).toBe('orange')
    expect(getStatusCodeTagColor(500)).toBe('red')
  })
})
