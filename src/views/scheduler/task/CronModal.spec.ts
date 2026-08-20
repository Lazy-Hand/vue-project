import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'
import CronModal from './CronModal.vue'

describe('CronModal.vue', () => {
  beforeEach(() => {
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
    i18n.global.locale.value = 'zh-CN'
  })

  it('renders cron generator modal and parses initial value', async () => {
    const wrapper = mount(CronModal, {
      props: {
        open: true,
        modelValue: '0 0 12 * * ?',
      },
      global: { plugins: [i18n] },
    })
    await flushPromises()

    const text = wrapper.text() || document.body.textContent || ''
    expect(text).toContain('Cron 表达式生成器')
    expect(text).toContain('秒')
    expect(text).toContain('分')
    expect(text).toContain('时')
  })

  it('emits applied cron expression on confirm', async () => {
    const wrapper = mount(CronModal, {
      props: {
        open: true,
        modelValue: '0 */5 * * * *',
      },
      global: { plugins: [i18n] },
    })
    await flushPromises()

    const okButtons = wrapper.findAll('.ant-btn-primary')
    expect(okButtons.length).toBeGreaterThan(0)
    await okButtons[okButtons.length - 1]!.trigger('click')
    await flushPromises()
    expect(wrapper.emitted('ok')).toBeDefined()
  })
})
