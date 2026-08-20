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
    store.reset()
    await flushPromises()

    expect(store.locale).toBe('zh-CN')
    expect(store.primaryColor).toBe('#409EFF')
    expect(i18n.global.locale.value).toBe('zh-CN')
  })
})
