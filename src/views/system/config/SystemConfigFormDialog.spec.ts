import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { beforeEach, describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'
import type { SystemConfig } from '@/types/system-config'
import SystemConfigFormDialog from './SystemConfigFormDialog.vue'

describe('SystemConfigFormDialog', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'zh-CN'
  })

  function mountDialog(props: {
    modelValue: boolean
    mode: 'create' | 'edit'
    editing?: SystemConfig | null
  }) {
    return mount(SystemConfigFormDialog, {
      props,
      global: {
        plugins: [i18n, ElementPlus],
      },
    })
  }

  async function submit(wrapper: ReturnType<typeof mountDialog>): Promise<void> {
    await wrapper.find('.el-dialog__footer .el-button--primary').trigger('click')
    await flushPromises()
  }

  it('emits the complete create payload after validation', async () => {
    const wrapper = mountDialog({ modelValue: true, mode: 'create' })
    await flushPromises()

    const inputs = wrapper.findAll('input.el-input__inner')
    const textareas = wrapper.findAll('textarea.el-textarea__inner')
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
      enabled: false,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    }
    const wrapper = mountDialog({ modelValue: true, mode: 'edit', editing })
    await flushPromises()

    const inputs = wrapper.findAll('input.el-input__inner')
    expect(inputs[0]!.attributes('disabled')).toBeDefined()
    await inputs[1]!.setValue('Updated title')
    await wrapper.findAll('textarea.el-textarea__inner')[1]!.setValue('')

    await submit(wrapper)

    const payload = wrapper.emitted('submit')?.[0]?.[0]
    expect(payload).toEqual({
      name: 'Updated title',
      value: null,
      description: null,
      enabled: false,
    })
    expect(payload).not.toHaveProperty('key')
  })

  it('uses i18n translations for dialog title and fields', async () => {
    const wrapper = mountDialog({ modelValue: true, mode: 'create' })
    await flushPromises()

    expect(wrapper.find('.el-dialog__title').text()).toBe(i18n.global.t('config.createTitle'))
    expect(wrapper.text()).toContain(i18n.global.t('config.key'))

    i18n.global.locale.value = 'en-US'
    await flushPromises()

    expect(wrapper.find('.el-dialog__title').text()).toBe(i18n.global.t('config.createTitle'))
    expect(wrapper.text()).toContain(i18n.global.t('config.key'))
  })

  it('does not submit a create form with a whitespace-only name', async () => {
    const wrapper = mountDialog({ modelValue: true, mode: 'create' })
    await flushPromises()

    const inputs = wrapper.findAll('input.el-input__inner')
    await inputs[0]!.setValue('site.title')
    await inputs[1]!.setValue('   ')

    await submit(wrapper)

    expect(wrapper.emitted('submit')).toBeUndefined()
  })
})
