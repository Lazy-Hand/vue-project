import { mount } from '@vue/test-utils'
import { Select } from 'antdv-next'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import AppConfigControls from './AppConfigControls.vue'
import AccountSetSwitcher from './AccountSetSwitcher.vue'

describe('main layout selects', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    i18n.global.locale.value = 'zh-CN'
  })

  it('renders locale option labels instead of raw values', () => {
    const wrapper = mount(AppConfigControls, {
      global: {
        plugins: [i18n],
      },
    })

    expect(wrapper.findComponent(Select).props('options')).toEqual([
      { label: '中文', value: 'zh-CN' },
      { label: 'English', value: 'en-US' },
    ])
    expect(wrapper.find('.ant-select-content').text()).toBe('中文')
  })

  it('renders account-set names instead of raw IDs', () => {
    useAuthStore().setAccountSets([
      {
        id: '1',
        code: 'system',
        name: '系统管理',
        isDefault: true,
        enabled: true,
      },
      {
        id: '2',
        code: 'demo',
        name: '演示账套',
        isDefault: false,
        enabled: true,
      },
    ])

    const wrapper = mount(AccountSetSwitcher, {
      global: {
        plugins: [i18n],
      },
    })

    expect(wrapper.findComponent(Select).props('options')).toEqual([
      { label: '系统管理', value: '1' },
      { label: '演示账套', value: '2' },
    ])
    expect(wrapper.find('.ant-select-content').text()).toBe('系统管理')
  })
})
