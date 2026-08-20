import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { createRouter, createWebHistory } from 'vue-router'

import { i18n } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import LayoutMenu from './Menu.vue'

describe('LayoutMenu', () => {
  const router = createRouter({
    history: createWebHistory(),
    routes: [{ path: '/', component: { template: '<div>Home</div>' } }],
  })

  beforeEach(() => {
    setActivePinia(createPinia())
    i18n.global.locale.value = 'zh-CN'
  })

  it('renders menu items and submenus when expanded', async () => {
    const authStore = useAuthStore()
    authStore.menus = [
      {
        id: '1',
        code: 'system',
        name: '系统管理',
        type: 'DIRECTORY',
        icon: 'SettingOutlined',
        parentId: null,
        path: '/system',
        component: null,
        sort: 1,
        enabled: true,
        children: [
          {
            id: '2',
            code: 'system:user',
            name: '用户管理',
            type: 'MENU',
            icon: 'UserOutlined',
            parentId: '1',
            path: '/system/user',
            component: 'system/user/index',
            sort: 1,
            enabled: true,
            children: [],
          },
        ],
      },
    ]

    const wrapper = mount(LayoutMenu, {
      props: { collapsed: false },
      global: {
        plugins: [router, i18n],
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('首页')
    expect(wrapper.text()).toContain('系统管理')
  })

  it('renders properly in collapsed mode with #icon slot', async () => {
    const wrapper = mount(LayoutMenu, {
      props: { collapsed: true },
      global: {
        plugins: [router, i18n],
      },
    })
    await flushPromises()

    expect(wrapper.find('.aside-menu').exists()).toBe(true)
  })
})
