import { DashboardOutlined, MenuOutlined, SettingOutlined, UserOutlined } from '@antdv-next/icons'
import { describe, expect, it } from 'vitest'

import {
  CUSTOM_ICON_PREFIX,
  isCustomMenuIcon,
  listCustomMenuIconNames,
  listAntdvIconNames,
  resolveMenuIcon,
  toCustomIconValue,
} from './icons'

describe('resolveMenuIcon', () => {
  it('resolves Antdv icons and legacy backend names', () => {
    expect(resolveMenuIcon('Setting')).toBe(SettingOutlined)
    expect(resolveMenuIcon('user')).toBe(UserOutlined)
    expect(resolveMenuIcon('Odometer')).toBe(DashboardOutlined)
    expect(resolveMenuIcon('UserFilled')).toBe(UserOutlined)
  })

  it('falls back to Menu when unknown', () => {
    expect(resolveMenuIcon(null)).toBe(MenuOutlined)
    expect(resolveMenuIcon('definitely-missing-icon-xyz')).toBe(MenuOutlined)
  })

  it('resolves custom svg icons from assets/icons', () => {
    expect(listCustomMenuIconNames()).toContain('app-grid')
    expect(isCustomMenuIcon(`${CUSTOM_ICON_PREFIX}app-grid`)).toBe(true)
    expect(isCustomMenuIcon('app-grid')).toBe(true)
    expect(isCustomMenuIcon('Setting')).toBe(false)

    const custom = resolveMenuIcon(`${CUSTOM_ICON_PREFIX}app-grid`)
    expect(custom).not.toBe(MenuOutlined)
    expect(custom).toBe(resolveMenuIcon('app-grid'))
  })

  it('prefers Antdv icons when the name collides with a custom file', () => {
    // Without custom: prefix, Antdv icons win over same-named SVGs.
    expect(isCustomMenuIcon('Menu')).toBe(false)
    expect(resolveMenuIcon('Menu')).toBe(MenuOutlined)
  })

  it('lists Antdv icons and builds custom values', () => {
    expect(listAntdvIconNames()).toContain('SettingOutlined')
    expect(toCustomIconValue('app-grid')).toBe(`${CUSTOM_ICON_PREFIX}app-grid`)
    expect(toCustomIconValue(`${CUSTOM_ICON_PREFIX}app-grid`)).toBe(`${CUSTOM_ICON_PREFIX}app-grid`)
  })
})
