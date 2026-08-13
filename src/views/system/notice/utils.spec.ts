import { describe, expect, it } from 'vitest'

import type { ProTableRequestParams } from '@/types/pro-table'
import { mapNoticeQuery } from './utils'

describe('notice page utilities', () => {
  it('maps search values to the paginated notice query', () => {
    const params: ProTableRequestParams = {
      page: 2,
      pageSize: 20,
      keyword: '  维护  ',
      status: 'PUBLISHED',
    }

    expect(mapNoticeQuery(params)).toEqual({
      page: 2,
      pageSize: 20,
      keyword: '维护',
      status: 'PUBLISHED',
    })
  })

  it('omits empty search values from the query', () => {
    const params: ProTableRequestParams = {
      page: 1,
      pageSize: 10,
      keyword: '',
      status: null,
    }

    expect(mapNoticeQuery(params)).toEqual({ page: 1, pageSize: 10 })
  })

  it('ignores unknown status values', () => {
    const params: ProTableRequestParams = {
      page: 1,
      pageSize: 10,
      keyword: '  ',
      status: 'ARCHIVED',
    }

    expect(mapNoticeQuery(params)).toEqual({ page: 1, pageSize: 10 })
  })
})
