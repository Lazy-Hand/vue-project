import { describe, expect, it } from 'vitest'

import type { ProTableRequestParams } from '@/types/pro-table'
import { formatFileSize, mapDateRange, mapFileListQuery } from './utils'

describe('file page utilities', () => {
  it('maps search values to the paginated file query', () => {
    const params: ProTableRequestParams = {
      page: 2,
      pageSize: 20,
      keyword: '  invoice  ',
      category: 'IMAGE',
      businessType: '  order ',
      businessId: ' order-1 ',
      dateRange: ['2026-01-01T00:00:00.000Z', '2026-01-31T00:00:00.000Z'],
    }

    expect(mapFileListQuery(params)).toEqual({
      page: 2,
      pageSize: 20,
      keyword: 'invoice',
      category: 'IMAGE',
      businessType: 'order',
      businessId: 'order-1',
      startTime: '2026-01-01T00:00:00.000Z',
      endTime: '2026-01-31T00:00:00.000Z',
    })
  })

  it('formats byte counts with compact units', () => {
    expect(formatFileSize(0)).toBe('0 B')
    expect(formatFileSize(1024)).toBe('1 KB')
    expect(formatFileSize(1536)).toBe('1.5 KB')
    expect(formatFileSize(2 * 1024 * 1024)).toBe('2 MB')
  })

  it('converts Date and dayjs-like values to an ISO range', () => {
    const start = new Date('2026-02-01T00:00:00.000Z')
    const end = { toISOString: () => '2026-02-28T23:59:59.999Z' }

    expect(mapDateRange([start, end])).toEqual([
      '2026-02-01T00:00:00.000Z',
      '2026-02-28T23:59:59.999Z',
    ])
  })
})
