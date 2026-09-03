import { createPinia, setActivePinia } from 'pinia'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'
import { useAppConfigStore } from './app-config'

describe('app config store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    document.documentElement.removeAttribute('lang')
    document.documentElement.style.cssText = ''
    i18n.global.locale.value = 'zh-CN'
  })

  it('updates locale and primary color', async () => {
    const store = useAppConfigStore()

    store.setLocale('en-US')
    store.setPrimaryColor('#67c23a')
    await flushPromises()

    expect(store.locale).toBe('en-US')
    expect(store.primaryColor).toBe('#67C23A')
    expect(document.documentElement.lang).toBe('en-US')
    expect(i18n.global.locale.value).toBe('en-US')
    expect(document.documentElement.style.getPropertyValue('--app-color-primary')).toBe('#67C23A')
  })

  it('resets to defaults', async () => {
    const store = useAppConfigStore()
    store.setLocale('en-US')
    store.setPrimaryColor('#67C23A')
    store.setThemeMode('dark')
    store.reset()
    await flushPromises()

    expect(store.locale).toBe('zh-CN')
    expect(store.primaryColor).toBe('#409EFF')
    expect(store.themeMode).toBe('light')
    expect(store.darkMode).toBe(false)
    expect(i18n.global.locale.value).toBe('zh-CN')
  })

  it('toggles theme mode and applies dark class', async () => {
    const store = useAppConfigStore()
    expect(store.themeMode).toBe('light')
    expect(store.darkMode).toBe(false)

    store.toggleThemeMode()
    expect(store.themeMode).toBe('dark')
    expect(store.darkMode).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

    store.toggleThemeMode()
    expect(store.themeMode).toBe('light')
    expect(store.darkMode).toBe(false)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })
})
