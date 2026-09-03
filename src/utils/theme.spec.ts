import { describe, expect, it } from 'vitest'

import { buildPrimaryColorVars, getAntdThemeConfig } from './theme'

describe('buildPrimaryColorVars', () => {
  it('builds application primary color variants', () => {
    const vars = buildPrimaryColorVars('#409EFF')

    expect(vars).toMatchObject({
      '--app-color-primary': '#409EFF',
      '--app-color-primary-light-3': expect.stringMatching(/^#[0-9a-f]{6}$/i),
      '--app-color-primary-dark-2': expect.stringMatching(/^#[0-9a-f]{6}$/i),
    })
  })

  it('rejects invalid colors', () => {
    expect(buildPrimaryColorVars('blue')).toBeNull()
    expect(buildPrimaryColorVars('#fff')).toBeNull()
  })
})

describe('getAntdThemeConfig', () => {
  it('returns unified dark theme tokens when dark mode is true', () => {
    const config = getAntdThemeConfig(true, '#409EFF')
    expect(config.token?.colorPrimary).toBe('#409EFF')
    expect(config.token?.colorBgBase).toBe('#16171a')
    expect(config.token?.colorBgContainer).toBe('#1c1d22')
    expect(config.token?.colorBgElevated).toBe('#222429')
    expect(config.components?.Card?.colorBgContainer).toBe('#222429')
    expect(config.components?.Table?.colorBgContainer).toBe('#1c1d22')
  })

  it('returns default algorithm when dark mode is false', () => {
    const config = getAntdThemeConfig(false, '#409EFF')
    expect(config.token?.colorPrimary).toBe('#409EFF')
    expect(config.token?.colorBgBase).toBeUndefined()
  })
})
