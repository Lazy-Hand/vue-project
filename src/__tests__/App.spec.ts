import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { ConfigProvider } from 'antdv-next'
import { beforeEach, describe, expect, it } from 'vitest'

import App from '../App.vue'
import { i18n } from '@/i18n'
import { useAppConfigStore } from '@/stores/app-config'

describe('App', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    i18n.global.locale.value = 'zh-CN'
  })

  it('renders the current route with Antdv locale and theme from app config', () => {
    useAppConfigStore().setLocale('en-US')

    const wrapper = mount(App, {
      global: {
        plugins: [i18n],
        stubs: ['RouterView'],
      },
    })

    expect(wrapper.find('router-view-stub').exists()).toBe(true)
    expect(wrapper.findComponent(ConfigProvider).props('locale')).toMatchObject({ locale: 'en' })
    expect(wrapper.findComponent(ConfigProvider).props('theme')).toMatchObject({
      token: { colorPrimary: '#409EFF' },
    })
    expect(i18n.global.locale.value).toBe('en-US')
  })
})
