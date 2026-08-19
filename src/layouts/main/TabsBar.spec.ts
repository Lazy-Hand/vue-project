import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRouter, createMemoryHistory } from 'vue-router'

import { i18n } from '@/i18n'
import TabsBar from './TabsBar.vue'

describe('TabsBar.vue', () => {
  let router: ReturnType<typeof createRouter>

  beforeEach(async () => {
    setActivePinia(createPinia())
    i18n.global.locale.value = 'zh-CN'

    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'home', component: { template: '<div>Home</div>' } },
        {
          path: '/system/user',
          name: 'user',
          component: { template: '<div>User</div>' },
          meta: { title: '用户管理' },
        },
      ],
    })

    await router.push('/')
    await router.isReady()
  })

  it('renders default home tab', () => {
    const wrapper = mount(TabsBar, {
      global: {
        plugins: [i18n, router],
      },
    })

    expect(wrapper.text()).toContain('首页')
  })

  it('adds and renders active tab on route navigation', async () => {
    const wrapper = mount(TabsBar, {
      global: {
        plugins: [i18n, router],
      },
    })

    await router.push('/system/user')
    await flushPromises()

    expect(wrapper.text()).toContain('首页')
    expect(wrapper.text()).toContain('用户管理')
  })

  it('emits refresh when refresh tool button is clicked', async () => {
    const wrapper = mount(TabsBar, {
      global: {
        plugins: [i18n, router],
      },
    })

    const refreshBtn = wrapper.find('.tab-tool-btn')
    expect(refreshBtn.exists()).toBe(true)
    await refreshBtn.trigger('click')

    expect(wrapper.emitted('refresh')).toBeDefined()
  })

  it('navigates to tab route when tab item is clicked', async () => {
    const pushSpy = vi.spyOn(router, 'push')

    const wrapper = mount(TabsBar, {
      global: {
        plugins: [i18n, router],
      },
    })

    await router.push('/system/user')
    await flushPromises()

    const tabItems = wrapper.findAll('.layout-tab-item')
    const homeTab = tabItems[0]
    expect(homeTab).toBeDefined()
    await homeTab?.trigger('click')

    expect(pushSpy).toHaveBeenCalledWith('/')
  })
})
