import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RouteLocationNormalized, Router } from 'vue-router'

import { useTabsStore } from './tabs'

describe('useTabsStore', () => {
  let router: Router

  beforeEach(() => {
    setActivePinia(createPinia())
    router = {
      push: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    } as unknown as Router
  })

  it('initializes with home tab', () => {
    const store = useTabsStore()
    expect(store.tabs.length).toBe(1)
    expect(store.tabs[0]?.path).toBe('/')
    expect(store.tabs[0]?.closable).toBe(false)
  })

  it('adds a new tab when navigating to a new route', () => {
    const store = useTabsStore()
    const route = {
      path: '/system/user',
      fullPath: '/system/user',
      name: 'system-user',
      meta: { title: '用户管理', icon: 'UserOutlined' },
    } as unknown as RouteLocationNormalized

    store.addTab(route)

    expect(store.tabs.length).toBe(2)
    expect(store.tabs[1]?.path).toBe('/system/user')
    expect(store.tabs[1]?.title).toBe('用户管理')
    expect(store.activeTabKey).toBe('/system/user')
    expect(store.cachedViews).toContain('system-user')
  })

  it('closes a tab and switches active tab to previous when closing active', () => {
    const store = useTabsStore()
    const route1 = {
      path: '/system/user',
      fullPath: '/system/user',
      name: 'system-user',
      meta: { title: '用户管理' },
    } as unknown as RouteLocationNormalized
    const route2 = {
      path: '/system/role',
      fullPath: '/system/role',
      name: 'system-role',
      meta: { title: '角色管理' },
    } as unknown as RouteLocationNormalized

    store.addTab(route1)
    store.addTab(route2)

    expect(store.tabs.length).toBe(3)
    expect(store.activeTabKey).toBe('/system/role')

    store.closeTab('/system/role', router)

    expect(store.tabs.length).toBe(2)
    expect(store.activeTabKey).toBe('/system/user')
    expect(router.push).toHaveBeenCalledWith('/system/user')
  })

  it('closes other tabs leaving home and active tab', () => {
    const store = useTabsStore()
    const route1 = {
      path: '/system/user',
      fullPath: '/system/user',
      meta: { title: '用户管理' },
    } as unknown as RouteLocationNormalized
    const route2 = {
      path: '/system/role',
      fullPath: '/system/role',
      meta: { title: '角色管理' },
    } as unknown as RouteLocationNormalized

    store.addTab(route1)
    store.addTab(route2)

    store.closeOtherTabs('/system/user', router)

    expect(store.tabs.length).toBe(2)
    expect(store.tabs.map((t) => t.path)).toEqual(['/', '/system/user'])
  })

  it('closes all tabs and navigates to home', () => {
    const store = useTabsStore()
    const route1 = {
      path: '/system/user',
      fullPath: '/system/user',
      meta: { title: '用户管理' },
    } as unknown as RouteLocationNormalized

    store.addTab(route1)
    store.closeAllTabs(router)

    expect(store.tabs.length).toBe(1)
    expect(store.tabs[0]?.path).toBe('/')
    expect(router.push).toHaveBeenCalledWith('/')
  })

  it('toggles content maximize state', () => {
    const store = useTabsStore()
    expect(store.isContentMaximized).toBe(false)
    store.toggleContentMaximize()
    expect(store.isContentMaximized).toBe(true)
    store.toggleContentMaximize(false)
    expect(store.isContentMaximized).toBe(false)
  })
})
