import { describe, expect, it } from 'vitest'

import { buildPrimaryColorVars } from './theme'

describe('buildPrimaryColorVars', () => {
  it('builds Element Plus primary color variants', () => {
    const vars = buildPrimaryColorVars('#409EFF')

    expect(vars).toMatchObject({
      '--el-color-primary': '#409EFF',
      '--el-color-primary-light-3': expect.stringMatching(/^#[0-9a-f]{6}$/i),
      '--el-color-primary-dark-2': expect.stringMatching(/^#[0-9a-f]{6}$/i),
    })
  })

  it('rejects invalid colors', () => {
    expect(buildPrimaryColorVars('blue')).toBeNull()
    expect(buildPrimaryColorVars('#fff')).toBeNull()
  })
})
