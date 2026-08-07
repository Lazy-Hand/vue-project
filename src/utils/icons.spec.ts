import { Menu, Setting, User } from '@element-plus/icons-vue'
import { describe, expect, it } from 'vitest'

import {
  CUSTOM_ICON_PREFIX,
  isCustomMenuIcon,
  listCustomMenuIconNames,
  listElementPlusIconNames,
  resolveMenuIcon,
  toCustomIconValue,
} from './icons'

describe('resolveMenuIcon', () => {
  it('resolves Element Plus icons by PascalCase or kebab-case', () => {
    expect(resolveMenuIcon('Setting')).toBe(Setting)
    expect(resolveMenuIcon('user')).toBe(User)
  })

  it('falls back to Menu when unknown', () => {
    expect(resolveMenuIcon(null)).toBe(Menu)
    expect(resolveMenuIcon('definitely-missing-icon-xyz')).toBe(Menu)
  })

  it('resolves custom svg icons from assets/icons', () => {
    expect(listCustomMenuIconNames()).toContain('app-grid')
    expect(isCustomMenuIcon(`${CUSTOM_ICON_PREFIX}app-grid`)).toBe(true)
    expect(isCustomMenuIcon('app-grid')).toBe(true)
    expect(isCustomMenuIcon('Setting')).toBe(false)

    const custom = resolveMenuIcon(`${CUSTOM_ICON_PREFIX}app-grid`)
    expect(custom).not.toBe(Menu)
    expect(custom).toBe(resolveMenuIcon('app-grid'))
  })

  it('prefers Element Plus when the name collides with a custom file', () => {
    // Without custom: prefix, PascalCase EP icons win over same-named SVGs.
    expect(isCustomMenuIcon('Menu')).toBe(false)
    expect(resolveMenuIcon('Menu')).toBe(Menu)
  })

  it('lists Element Plus icons and builds custom values', () => {
    expect(listElementPlusIconNames()).toContain('Setting')
    expect(toCustomIconValue('app-grid')).toBe(`${CUSTOM_ICON_PREFIX}app-grid`)
    expect(toCustomIconValue(`${CUSTOM_ICON_PREFIX}app-grid`)).toBe(
      `${CUSTOM_ICON_PREFIX}app-grid`,
    )
  })
})
