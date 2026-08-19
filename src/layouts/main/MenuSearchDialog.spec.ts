import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRouter, createMemoryHistory } from 'vue-router'

import { i18n } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import type { PermissionTreeNode } from '@/types/permission'
import MenuSearchDialog from './MenuSearchDialog.vue'

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
    ],
  },
]

describe('MenuSearchDialog.vue', () => {
  let router: ReturnType<typeof createRouter>

  beforeEach(async () => {
    setActivePinia(createPinia())
    i18n.global.locale.value = 'zh-CN'
    document.body.innerHTML = ''

    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'home', component: { template: '<div>Home</div>' } },
        { path: '/system/user', name: 'user', component: { template: '<div>User</div>' } },
      ],
    })

    await router.push('/')
    await router.isReady()
  })

  it('renders menu list when open', async () => {
    useAuthStore().setAccess(mockMenus, [])

    mount(MenuSearchDialog, {
      props: { open: true },
      global: {
        plugins: [i18n, router],
      },
    })
    await flushPromises()

    expect(document.body.textContent).toContain('首页')
    expect(document.body.textContent).toContain('用户管理')
  })

  it('filters menus based on input keyword', async () => {
    useAuthStore().setAccess(mockMenus, [])

    mount(MenuSearchDialog, {
      props: { open: true },
      global: {
        plugins: [i18n, router],
      },
    })
    await flushPromises()

    const input = document.body.querySelector('input')
    expect(input).not.toBeNull()
    if (input) {
      input.value = '用户'
      input.dispatchEvent(new Event('input'))
      await flushPromises()
    }

    expect(document.body.textContent).toContain('用户管理')
    expect(document.body.textContent).not.toContain('首页')
  })

  it('navigates and emits update:open false when item is selected', async () => {
    useAuthStore().setAccess(mockMenus, [])
    const pushSpy = vi.spyOn(router, 'push')

    const wrapper = mount(MenuSearchDialog, {
      props: { open: true },
      global: {
        plugins: [i18n, router],
      },
    })
    await flushPromises()

    const items = Array.from(document.body.querySelectorAll('.menu-search-item'))
    const userItem = items.find((el) => el.textContent?.includes('用户管理'))
    expect(userItem).toBeDefined()
    userItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(pushSpy).toHaveBeenCalledWith('/system/user')
    expect(wrapper.emitted('update:open')?.[0]).toEqual([false])
  })
})
