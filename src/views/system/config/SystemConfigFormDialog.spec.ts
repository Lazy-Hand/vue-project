import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('antdv-next', async () => {
  const [
    { default: Button },
    { default: Form, FormItem },
    { default: Input, TextArea },
    { default: Modal },
    { default: Switch },
  ] = await Promise.all([
    import('antdv-next/dist/button/index'),
    import('antdv-next/dist/form/index'),
    import('antdv-next/dist/input/index'),
    import('antdv-next/dist/modal/index'),
    import('antdv-next/dist/switch/index'),
  ])
  return { Button, Form, FormItem, Input, Modal, Switch, TextArea }
})

import { i18n } from '@/i18n'
import type { SystemConfig } from '@/types/system-config'
import SystemConfigFormDialog from './SystemConfigFormDialog.vue'

describe('SystemConfigFormDialog', () => {
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
    editing?: SystemConfig | null
  }) {
    return mount(SystemConfigFormDialog, {
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

  it('emits the complete create payload after validation', async () => {
    const wrapper = mountDialog({ modelValue: true, mode: 'create' })
    await flushPromises()

    const inputs = wrapper.findAll('.ant-input')
    const textareas = wrapper.findAll('textarea.ant-input')
    await inputs[0]!.setValue('site.title')
    await inputs[1]!.setValue('Site title')
    await textareas[0]!.setValue('Welcome')
    await textareas[1]!.setValue('Shown on the home page')

    await submit(wrapper)

    expect(wrapper.emitted('submit')).toEqual([
      [
        {
          key: 'site.title',
          name: 'Site title',
          value: 'Welcome',
          description: 'Shown on the home page',
          group: 'general',
          enabled: true,
        },
      ],
    ])
  })

  it('disables key in edit mode and omits it from the update payload', async () => {
    const editing: SystemConfig = {
      id: 'config-1',
      key: 'site.title',
      name: 'Site title',
      value: null,
      description: 'Shown on the home page',
      group: 'site',
      enabled: false,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    }
    const wrapper = mountDialog({ modelValue: true, mode: 'edit', editing })
    await flushPromises()

    const inputs = wrapper.findAll('input.ant-input')
    expect(inputs[0]!.attributes('disabled')).toBeDefined()
    await inputs[1]!.setValue('Updated title')
    await wrapper.findAll('textarea.ant-input')[1]!.setValue('')

    await submit(wrapper)

    const payload = wrapper.emitted('submit')?.[0]?.[0]
    expect(payload).toEqual({
      name: 'Updated title',
      value: null,
      description: null,
      group: 'site',
      enabled: false,
    })
    expect(payload).not.toHaveProperty('key')
  })

  it('uses i18n translations for dialog title and fields', async () => {
    const wrapper = mountDialog({ modelValue: true, mode: 'create' })
    await flushPromises()

    expect(wrapper.find('.ant-modal-title').text()).toBe(i18n.global.t('config.createTitle'))
    expect(wrapper.text()).toContain(i18n.global.t('config.key'))

    i18n.global.locale.value = 'en-US'
    await flushPromises()

    expect(wrapper.find('.ant-modal-title').text()).toBe(i18n.global.t('config.createTitle'))
    expect(wrapper.text()).toContain(i18n.global.t('config.key'))
  })

  it('does not submit a create form with a whitespace-only name', async () => {
    const wrapper = mountDialog({ modelValue: true, mode: 'create' })
    await flushPromises()

    const inputs = wrapper.findAll('input.ant-input')
    await inputs[0]!.setValue('site.title')
    await inputs[1]!.setValue('   ')

    await submit(wrapper)

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(nameRequiredMessages(wrapper)).toHaveLength(1)
  })

  it('shows a single required message and blocks submit for an empty name', async () => {
    const wrapper = mountDialog({ modelValue: true, mode: 'create' })
    await flushPromises()

    const inputs = wrapper.findAll('input.ant-input')
    await inputs[0]!.setValue('site.title')

    await submit(wrapper)

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(nameRequiredMessages(wrapper)).toHaveLength(1)
  })

  function nameRequiredMessages(wrapper: ReturnType<typeof mountDialog>): unknown[] {
    return wrapper
      .findAll('.ant-form-item-explain-error')
      .filter((element) => element.text() === i18n.global.t('config.nameRequired'))
  }
})
