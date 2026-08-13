import { describe, expect, it } from 'vitest'

import {
  buildAccountSetPayload,
  isAccountSetTextValid,
  isDefaultUserSelected,
  toggleAccountSetUserSelection,
} from './utils'

describe('account set payload helpers', () => {
  const values = {
    code: '  DEFAULT ',
    name: '  Default set ',
    sort: 3,
    enabled: true,
    description: '  Main set ',
  }

  it('builds the complete create payload', () => {
    expect(buildAccountSetPayload(values, 'create')).toEqual({
      code: 'DEFAULT',
      name: 'Default set',
      sort: 3,
      enabled: true,
      description: 'Main set',
    })
  })

  it('omits code from the edit payload and normalizes an empty description', () => {
    expect(buildAccountSetPayload({ ...values, description: '   ' }, 'edit')).toEqual({
      name: 'Default set',
      sort: 3,
      enabled: true,
    })
  })

  it('rejects whitespace-only required fields before submission', () => {
    expect(isAccountSetTextValid('   ')).toBe(false)
    expect(isAccountSetTextValid(' A ', 2, 64)).toBe(false)
    expect(isAccountSetTextValid(' Main set ', 1, 64)).toBe(true)
  })

  it('requires a selected user when a default user is provided', () => {
    expect(isDefaultUserSelected({ userIds: ['1', '2'], defaultUserId: '2' })).toBe(true)
    expect(isDefaultUserSelected({ userIds: ['1'], defaultUserId: '2' })).toBe(false)
    expect(isDefaultUserSelected({ userIds: [], defaultUserId: undefined })).toBe(true)
    expect(isDefaultUserSelected({ userIds: ['1'], defaultUserId: undefined })).toBe(true)
    expect(isDefaultUserSelected({ userIds: [], defaultUserId: '1' })).toBe(false)
  })

  it('clears a stale default when that user is unselected', () => {
    const next = toggleAccountSetUserSelection({ userIds: ['1', '2'], defaultUserId: '1' }, '1')
    expect(next).toEqual({ userIds: ['2'] })
    expect(isDefaultUserSelected(next)).toBe(true)
  })
})
