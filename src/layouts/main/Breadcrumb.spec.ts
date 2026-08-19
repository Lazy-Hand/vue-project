import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRouter, createMemoryHistory } from 'vue-router'

import { i18n } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import type { PermissionTreeNode } from '@/types/permission'
import Breadcrumb from './Breadcrumb.vue'

const mockMenus: PermissionTreeNode[] = [
  {
    id: '1',
    code: 'system',
    name: '系统管理',
    type: 'DIRECTORY',
    parentId: null,
    path: null,
    component: null,
    icon: 'SettingOutlined',
    sort: 1,
    enabled: true,
    children: [
      {
        id: '2',
        code: 'system:user',
        name: '用户管理',
        type: 'MENU',
        parentId: '1',
        path: '/system/user',
        component: 'system/user/index',
        icon: 'UserOutlined',
        sort: 1,
        enabled: true,
        children: [],
      },
      {
        id: '3',
        code: 'system:role',
        name: '角色管理',
        type: 'MENU',
        parentId: '1',
        path: '/system/role',
        component: 'system/role/index',
        icon: 'TeamOutlined',
        sort: 2,
        enabled: true,
        children: [],
      },
    ],
  },
]

describe('Breadcrumb.vue', () => {
  let router: ReturnType<typeof createRouter>

  beforeEach(async () => {
    setActivePinia(createPinia())
    i18n.global.locale.value = 'zh-CN'

    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'home', component: { template: '<div>Home</div>' } },
        { path: '/system/user', name: 'user', component: { template: '<div>User</div>' } },
        { path: '/system/role', name: 'role', component: { template: '<div>Role</div>' } },
      ],
    })

    await router.push('/')
    await router.isReady()
  })

  it('renders home link when at root route', () => {
    const wrapper = mount(Breadcrumb, {
      global: {
        plugins: [i18n, router],
      },
    })

    expect(wrapper.text()).toContain('首页')
  })

  it('renders complete hierarchy when navigating to a submenu', async () => {
    useAuthStore().setAccess(mockMenus, [])
    await router.push('/system/user')

    const wrapper = mount(Breadcrumb, {
      global: {
        plugins: [i18n, router],
      },
    })

    expect(wrapper.text()).toContain('首页')
    expect(wrapper.text()).toContain('系统管理')
    expect(wrapper.text()).toContain('用户管理')
  })

  it('navigates to home when home breadcrumb is clicked', async () => {
    useAuthStore().setAccess(mockMenus, [])
    await router.push('/system/user')

    const pushSpy = vi.spyOn(router, 'push')
    const wrapper = mount(Breadcrumb, {
      global: {
        plugins: [i18n, router],
      },
    })

    const homeLink = wrapper.find('.breadcrumb-link--home')
    expect(homeLink.exists()).toBe(true)
    await homeLink.trigger('click')

    expect(pushSpy).toHaveBeenCalledWith('/')
  })
})
