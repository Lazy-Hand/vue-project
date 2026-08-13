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
  ] = await Promise.all([
    import('antdv-next/dist/button/index'),
    import('antdv-next/dist/form/index'),
    import('antdv-next/dist/input/index'),
    import('antdv-next/dist/input-number/index'),
    import('antdv-next/dist/modal/index'),
    import('antdv-next/dist/switch/index'),
  ])
  return { Button, Form, FormItem, Input, InputNumber, Modal, Switch, TextArea }
})

import { i18n } from '@/i18n'
import type { Post } from '@/types/post'
import PostFormDialog from './PostFormDialog.vue'

describe('PostFormDialog', () => {
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

  function mountDialog(props: {
    modelValue: boolean
    mode: 'create' | 'edit'
    editing?: Post | null
  }) {
    return mount(PostFormDialog, {
      props,
      global: {
        plugins: [i18n],
      },
    })
  }

  async function submit(wrapper: ReturnType<typeof mountDialog>): Promise<void> {
    await wrapper.find('.ant-modal-footer .ant-btn-primary').trigger('click')
    await flushPromises()
  }

  it('emits the complete create payload', async () => {
    const wrapper = mountDialog({ modelValue: true, mode: 'create' })
    await flushPromises()

    const inputs = wrapper.findAll('input')
    await inputs[0]!.setValue('engineer')
    await inputs[1]!.setValue('Engineer')
    await wrapper.find('textarea.ant-input').setValue('Platform engineering')

    await submit(wrapper)

    expect(wrapper.emitted('submit')).toEqual([
      [
        {
          code: 'engineer',
          name: 'Engineer',
          sort: 0,
          enabled: true,
          description: 'Platform engineering',
        },
      ],
    ])
  })

  it('disables code in edit mode and omits it from the update payload', async () => {
    const editing: Post = {
      id: 'post-1',
      code: 'engineer',
      name: 'Engineer',
      sort: 2,
      enabled: false,
      description: 'Platform engineering',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    }
    const wrapper = mountDialog({ modelValue: true, mode: 'edit', editing })
    await flushPromises()

    const inputs = wrapper.findAll('input')
    expect(inputs[0]!.attributes('disabled')).toBeDefined()
    await inputs[1]!.setValue('Senior Engineer')

    await submit(wrapper)

    const payload = wrapper.emitted('submit')?.[0]?.[0]
    expect(payload).toEqual({
      name: 'Senior Engineer',
      sort: 2,
      enabled: false,
      description: 'Platform engineering',
    })
    expect(payload).not.toHaveProperty('code')
  })

  it('does not submit whitespace-only required fields', async () => {
    const wrapper = mountDialog({ modelValue: true, mode: 'create' })
    await flushPromises()

    const inputs = wrapper.findAll('input')
    await inputs[0]!.setValue('  ')
    await inputs[1]!.setValue('  ')

    await submit(wrapper)

    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('omits an empty description from the create payload', async () => {
    const wrapper = mountDialog({ modelValue: true, mode: 'create' })
    await flushPromises()

    const inputs = wrapper.findAll('input')
    await inputs[0]!.setValue('engineer')
    await inputs[1]!.setValue('Engineer')

    await submit(wrapper)

    expect(wrapper.emitted('submit')?.[0]?.[0]).toEqual({
      code: 'engineer',
      name: 'Engineer',
      sort: 0,
      enabled: true,
    })
  })
})
