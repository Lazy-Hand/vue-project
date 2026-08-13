import { describe, expect, it } from 'vitest'

import { toStoredAvatarPath } from './utils'

describe('user page utilities', () => {
  it('prefixes upload paths with the api base path', () => {
    expect(toStoredAvatarPath('uploads/images/2026-08/avatar.png')).toBe(
      '/api/uploads/images/2026-08/avatar.png',
    )
  })

  it('keeps already-prefixed and absolute values unchanged', () => {
    expect(toStoredAvatarPath('/api/uploads/2026-08/avatar.png')).toBe(
      '/api/uploads/2026-08/avatar.png',
    )
    expect(toStoredAvatarPath('https://cdn.example.com/avatar.png')).toBe(
      'https://cdn.example.com/avatar.png',
    )
    expect(toStoredAvatarPath('http://cdn.example.com/avatar.png')).toBe(
      'http://cdn.example.com/avatar.png',
    )
  })

  it('returns null for empty values', () => {
    expect(toStoredAvatarPath(null)).toBeNull()
    expect(toStoredAvatarPath(undefined)).toBeNull()
    expect(toStoredAvatarPath('')).toBeNull()
    expect(toStoredAvatarPath('   ')).toBeNull()
  })
})
