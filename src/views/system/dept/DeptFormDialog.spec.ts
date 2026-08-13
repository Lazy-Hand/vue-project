import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('antdv-next', async () => {
  const [
    { default: Button },
    { default: Form, FormItem },
    { default: Input, TextArea },
    { default: InputNumber },
    { default: Modal },
    { default: Switch },
    { default: TreeSelect },
  ] = await Promise.all([
    import('antdv-next/dist/button/index'),
    import('antdv-next/dist/form/index'),
    import('antdv-next/dist/input/index'),
    import('antdv-next/dist/input-number/index'),
    import('antdv-next/dist/modal/index'),
    import('antdv-next/dist/switch/index'),
    import('antdv-next/dist/tree-select/index'),
  ])
  return { Button, Form, FormItem, Input, InputNumber, Modal, Switch, TextArea, TreeSelect }
})

import { i18n } from '@/i18n'
import DeptFormDialog from './DeptFormDialog.vue'

describe('DeptFormDialog', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'zh-CN'
    window.matchMedia ??= (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    })
  })

  it('does not submit a create form with a whitespace-only name', async () => {
    const wrapper = mount(DeptFormDialog, {
      props: { modelValue: true, mode: 'create', tree: [] },
      global: { plugins: [i18n] },
    })
    await flushPromises()

    const nameInput = wrapper.findAll('input')[0]
    expect(nameInput).toBeDefined()
    if (!nameInput) throw new Error('expected department name input')
    await nameInput.setValue('   ')
    await wrapper.find('.ant-modal-footer .ant-btn-primary').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('submit')).toBeUndefined()
  })
})
