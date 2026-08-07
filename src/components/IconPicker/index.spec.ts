import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ElementPlus from 'element-plus'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { i18n } from '@/i18n'
import { CUSTOM_ICON_PREFIX } from '@/utils/icons'
import IconPicker from './index.vue'

describe('IconPicker', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    i18n.global.locale.value = 'zh-CN'
  })

  function mountPicker(modelValue: string | null = null) {
    return mount(IconPicker, {
      props: {
        modelValue,
        teleported: false,
      },
      global: {
        plugins: [i18n, ElementPlus],
      },
    })
  }

  it('renders tabs for Element Plus and custom icons', async () => {
    const wrapper = mountPicker()
    await wrapper.find('.icon-picker__trigger').trigger('click')
    await nextTick()

    expect(wrapper.text()).toContain('Element Plus')
    expect(wrapper.text()).toContain('自定义')
  })

  it('emits Element Plus icon name on select', async () => {
    const wrapper = mountPicker()
    await wrapper.find('.icon-picker__trigger').trigger('click')
    await nextTick()

    const item = wrapper.findAll('.icon-picker__item').find((node) => node.attributes('title') === 'Aim')
    expect(item).toBeTruthy()
    await item!.trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['Aim'])
  })

  it('emits custom: prefixed value from custom tab', async () => {
    const wrapper = mountPicker()
    await wrapper.find('.icon-picker__trigger').trigger('click')
    await nextTick()

    const customTab = wrapper.findAll('.el-tabs__item').find((node) => node.text().includes('自定义'))
    expect(customTab).toBeTruthy()
    await customTab!.trigger('click')
    await nextTick()

    const item = wrapper
      .findAll('.icon-picker__item')
      .find((node) => node.attributes('title')?.startsWith(CUSTOM_ICON_PREFIX))
    expect(item).toBeTruthy()
    await item!.trigger('click')

    const emitted = wrapper.emitted('update:modelValue')?.[0]?.[0]
    expect(typeof emitted).toBe('string')
    expect(String(emitted).startsWith(CUSTOM_ICON_PREFIX)).toBe(true)
  })
})
