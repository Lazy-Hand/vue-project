import { describe, expect, it } from 'vitest'

import type { ProTableRequestParams } from '@/types/pro-table'
import {
  formatDuration,
  loginTypeColor,
  mapDateRange,
  mapLogQuery,
  mapLoginLogQuery,
  methodColor,
  statusColor,
} from './utils'

describe('log page utilities', () => {
  it('maps search values to the paginated log query', () => {
    const params: ProTableRequestParams = {
      page: 2,
      pageSize: 20,
      keyword: '  admin  ',
      module: 'user',
      action: 'create',
      success: false,
      dateRange: ['2026-08-01T00:00:00.000Z', '2026-08-31T00:00:00.000Z'],
    }

    expect(mapLogQuery(params)).toEqual({
      page: 2,
      pageSize: 20,
      keyword: 'admin',
      module: 'user',
      action: 'create',
      success: false,
      startTime: '2026-08-01T00:00:00.000Z',
      endTime: '2026-08-31T00:00:00.000Z',
    })
  })

  it('omits empty search values from the query', () => {
    const params: ProTableRequestParams = {
      page: 1,
      pageSize: 10,
      keyword: '',
      module: '  ',
      action: '',
      success: null,
      dateRange: null,
    }

    expect(mapLogQuery(params)).toEqual({ page: 1, pageSize: 10 })
  })

  it('converts Date and dayjs-like values to an ISO range', () => {
    const start = new Date('2026-09-01T00:00:00.000Z')
    const end = { toISOString: () => '2026-09-30T23:59:59.999Z' }

    expect(mapDateRange([start, end])).toEqual([
      '2026-09-01T00:00:00.000Z',
      '2026-09-30T23:59:59.999Z',
    ])
    expect(mapDateRange(null)).toBeUndefined()
    expect(mapDateRange([])).toBeUndefined()
  })

  it('formats durations compactly', () => {
    expect(formatDuration(0)).toBe('0ms')
    expect(formatDuration(999)).toBe('999ms')
    expect(formatDuration(1500)).toBe('1.50s')
    expect(formatDuration(null)).toBe('-')
    expect(formatDuration(undefined)).toBe('-')
  })

  it('maps HTTP methods and status codes to Tag colors', () => {
    expect(methodColor('GET')).toBe('green')
    expect(methodColor('post')).toBe('blue')
    expect(methodColor('DELETE')).toBe('red')
    expect(methodColor('UNKNOWN')).toBe('default')
    expect(methodColor(null)).toBe('default')

    expect(statusColor(200)).toBe('green')
    expect(statusColor(404)).toBe('orange')
    expect(statusColor(500)).toBe('red')
    expect(statusColor(null)).toBe('default')
  })

  it('maps login types to Tag colors', () => {
    expect(loginTypeColor('PASSWORD')).toBe('blue')
    expect(loginTypeColor('REFRESH')).toBe('cyan')
    expect(loginTypeColor('REGISTER')).toBe('purple')
    expect(loginTypeColor('UNKNOWN')).toBe('default')
    expect(loginTypeColor(null)).toBe('default')
  })

  it('maps search values to the login log query', () => {
    const params: ProTableRequestParams = {
      page: 1,
      pageSize: 20,
      username: '  test_user  ',
      loginType: 'PASSWORD',
      success: true,
      ip: ' 127.0.0.1 ',
      dateRange: ['2026-08-01T00:00:00.000Z', '2026-08-31T00:00:00.000Z'],
    }

    expect(mapLoginLogQuery(params)).toEqual({
      page: 1,
      pageSize: 20,
      username: 'test_user',
      loginType: 'PASSWORD',
      success: true,
      ip: '127.0.0.1',
      startTime: '2026-08-01T00:00:00.000Z',
      endTime: '2026-08-31T00:00:00.000Z',
    })
  })
})
