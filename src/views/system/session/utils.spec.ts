import { describe, expect, it } from 'vitest'

import type { ProTableRequestParams } from '@/types/pro-table'
import { mapSessionQuery } from './utils'

describe('session page utilities', () => {
  it('maps search values to the paginated session query', () => {
    const params: ProTableRequestParams = {
      page: 2,
      pageSize: 20,
      keyword: '  admin  ',
    }

    expect(mapSessionQuery(params)).toEqual({
      page: 2,
      pageSize: 20,
      keyword: 'admin',
    })
  })

  it('omits empty keyword from the query', () => {
    const params: ProTableRequestParams = {
      page: 1,
      pageSize: 10,
      keyword: '',
    }

    expect(mapSessionQuery(params)).toEqual({ page: 1, pageSize: 10 })
  })

  it('omits whitespace-only keyword from the query', () => {
    const params: ProTableRequestParams = {
      page: 3,
      pageSize: 10,
      keyword: '   ',
    }

    expect(mapSessionQuery(params)).toEqual({ page: 3, pageSize: 10 })
  })
})
