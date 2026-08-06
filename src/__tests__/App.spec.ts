import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import App from '../App.vue'
import { i18n } from '@/i18n'
import { useAppConfigStore } from '@/stores/app-config'

describe('App', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    i18n.global.locale.value = 'zh-CN'
  })

  it('renders the current route with Element Plus locale from app config', () => {
    useAppConfigStore().setLocale('en-US')

    const wrapper = mount(App, {
      global: {
        plugins: [i18n],
        stubs: ['RouterView'],
      },
    })

    expect(wrapper.find('router-view-stub').exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'ElConfigProvider' }).props('locale')).toMatchObject({
      name: 'en',
    })
    expect(i18n.global.locale.value).toBe('en-US')
  })
})
