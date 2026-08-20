import { describe, expect, it } from 'vitest'
import type { ProTableRequestParams } from '@/types/pro-table'
import {
  formatJobDuration,
  formatTriggerSource,
  jobLogStatusColor,
  mapDateRange,
  mapJobLogQuery,
} from './utils'

describe('scheduler log utilities', () => {
  it('maps ProTable params to JobLogQuery', () => {
    const params: ProTableRequestParams = {
      page: 2,
      pageSize: 15,
      jobId: '10',
      jobName: '  retention  ',
      jobGroup: 'SYSTEM',
      status: 'SUCCESS',
      dateRange: ['2026-08-01T00:00:00.000Z', '2026-08-31T00:00:00.000Z'],
    }

    expect(mapJobLogQuery(params)).toEqual({
      page: 2,
      pageSize: 15,
      jobId: '10',
      jobName: 'retention',
      jobGroup: 'SYSTEM',
      status: 'SUCCESS',
      startTime: '2026-08-01T00:00:00.000Z',
      endTime: '2026-08-31T00:00:00.000Z',
    })
  })

  it('handles empty query params', () => {
    const params: ProTableRequestParams = {
      page: 1,
      pageSize: 10,
      jobName: '',
      jobGroup: '',
      status: null,
      dateRange: null,
    }

    expect(mapJobLogQuery(params)).toEqual({ page: 1, pageSize: 10 })
  })

  it('converts Date and dayjs-like objects to ISO range', () => {
    const start = new Date('2026-09-01T00:00:00.000Z')
    const end = { toISOString: () => '2026-09-30T23:59:59.999Z' }

    expect(mapDateRange([start, end])).toEqual([
      '2026-09-01T00:00:00.000Z',
      '2026-09-30T23:59:59.999Z',
    ])
  })

  it('maps jobLog status to colors', () => {
    expect(jobLogStatusColor('SUCCESS')).toBe('green')
    expect(jobLogStatusColor('RUNNING')).toBe('blue')
    expect(jobLogStatusColor('FAILED')).toBe('red')
    expect(jobLogStatusColor('SKIPPED')).toBe('orange')
    expect(jobLogStatusColor(null)).toBe('default')
  })

  it('formats duration', () => {
    expect(formatJobDuration(50)).toBe('50ms')
    expect(formatJobDuration(1200)).toBe('1.20s')
    expect(formatJobDuration(null)).toBe('-')
  })

  it('formats trigger source', () => {
    const mockT = (key: string, values?: Record<string, unknown>) => {
      if (key === 'scheduler.log.triggeredByScheduler') return '定时调度'
      if (key === 'scheduler.log.triggeredByManual') return `手动触发 (${values?.user})`
      return key
    }

    expect(formatTriggerSource('scheduler', mockT)).toBe('定时调度')
    expect(formatTriggerSource('manual:admin', mockT)).toBe('手动触发 (admin)')
    expect(formatTriggerSource(null, mockT)).toBe('-')
  })
})
