import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { i18n } from '@/i18n'
import { CUSTOM_ICON_PREFIX } from '@/utils/icons'
import IconPicker from './index.vue'

describe('IconPicker', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    i18n.global.locale.value = 'zh-CN'
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  function popup(wrapper: ReturnType<typeof mountPicker>): DOMWrapper<HTMLElement> {
    return new DOMWrapper((wrapper.element.parentElement ?? document.body) as HTMLElement)
  }

  function mountPicker(modelValue: string | null = null) {
    return mount(IconPicker, {
      props: {
        modelValue,
        teleported: false,
      },
      global: {
        plugins: [i18n],
      },
    })
  }

  it('renders tabs for Antdv Next and custom icons', async () => {
    const wrapper = mountPicker()
    await wrapper.find('.icon-picker__trigger').trigger('click')
    await nextTick()
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(popup(wrapper).text()).toContain('Antdv Next')
    expect(popup(wrapper).text()).toContain('自定义')
  })

  it('emits Antdv icon name on select', async () => {
    const wrapper = mountPicker()
    await wrapper.find('.icon-picker__trigger').trigger('click')
    await nextTick()

    const item = popup(wrapper)
      .findAll('.icon-picker__item')
      .find((node) => node.attributes('title') === 'AimOutlined')
    expect(item).toBeTruthy()
    await item!.trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['AimOutlined'])
  })

  it('emits custom: prefixed value from custom tab', async () => {
    const wrapper = mountPicker()
    await wrapper.find('.icon-picker__trigger').trigger('click')
    await nextTick()

    const customTab = popup(wrapper)
      .findAll('.ant-tabs-tab')
      .find((node) => node.text().includes('自定义'))
    expect(customTab).toBeTruthy()
    await customTab!.trigger('click')
    await nextTick()

    const item = popup(wrapper)
      .findAll('.icon-picker__item')
      .find((node) => node.attributes('title')?.startsWith(CUSTOM_ICON_PREFIX))
    expect(item).toBeTruthy()
    await item!.trigger('click')

    const emitted = wrapper.emitted('update:modelValue')?.[0]?.[0]
    expect(typeof emitted).toBe('string')
    expect(String(emitted).startsWith(CUSTOM_ICON_PREFIX)).toBe(true)
  })
})
