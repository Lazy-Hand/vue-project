import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'
import KnowledgeFormDialog from './KnowledgeFormDialog.vue'

describe('KnowledgeFormDialog', () => {
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

  it('emits a cloned form payload without exposing origin controls', async () => {
    const wrapper = mount(KnowledgeFormDialog, {
      props: {
        open: true,
        title: 'Material',
        fields: [
          {
            key: 'title',
            label: 'Title',
            placeholder: 'Title',
          },
        ],
        modelValue: { title: 'Source' },
      },
      global: { plugins: [i18n] },
    })

    await wrapper.find('input').setValue('Updated source')
    await wrapper.findAll('button').at(-1)?.trigger('click')

    expect(wrapper.emitted('submit')?.[0]).toEqual([{ title: 'Updated source' }])
    expect(wrapper.text()).not.toContain('AI')
  })
})
