import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'
import RichEditor from './index.vue'

describe('RichEditor.vue', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'zh-CN'
  })

  it('renders with initial modelValue', async () => {
    const wrapper = mount(RichEditor, {
      props: {
        modelValue: '<p>Hello Tiptap</p>',
      },
      global: {
        plugins: [i18n],
      },
    })
    await flushPromises()

    expect(wrapper.find('.rich-editor-wrapper').exists()).toBe(true)
    expect(wrapper.find('.rich-editor-toolbar').exists()).toBe(true)
    expect(wrapper.text()).toContain('Hello Tiptap')
  })

  it('renders in disabled/readonly state without toolbar', async () => {
    const wrapper = mount(RichEditor, {
      props: {
        modelValue: '<p>Readonly content</p>',
        disabled: true,
      },
      global: {
        plugins: [i18n],
      },
    })
    await flushPromises()

    expect(wrapper.classes()).toContain('is-disabled')
    expect(wrapper.find('.rich-editor-toolbar').exists()).toBe(false)
    expect(wrapper.text()).toContain('Readonly content')
  })

  it('renders toolbar buttons in full mode', async () => {
    const wrapper = mount(RichEditor, {
      props: {
        modelValue: '<p>Toolbar test</p>',
        toolbarMode: 'full',
      },
      global: {
        plugins: [i18n],
      },
    })
    await flushPromises()

    const toolbar = wrapper.find('.rich-editor-toolbar')
    expect(toolbar.exists()).toBe(true)

    // Heading selector
    expect(wrapper.find('.heading-select').exists()).toBe(true)

    // Toolbar buttons
    const buttons = wrapper.findAll('.toolbar-btn')
    expect(buttons.length).toBeGreaterThan(5)
  })
})
