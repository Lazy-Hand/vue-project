import { describe, expect, it } from 'vitest'

import { menusToRoutes } from './dynamic'
import type { PermissionTreeNode } from '@/types/permission'

const menus: PermissionTreeNode[] = [
  {
    id: '1',
    type: 'DIRECTORY',
    code: 'system',
    name: '系统管理',
    parentId: null,
    path: '/system',
    component: null,
    icon: 'setting',
    sort: 1,
    enabled: true,
    children: [
      {
        id: '2',
        type: 'MENU',
        code: 'system:user',
        name: '用户管理',
        parentId: '1',
        path: '/system/user',
        component: 'system/user/index',
        icon: 'user',
        sort: 1,
        enabled: true,
        children: [],
      },
      {
        id: '3',
        type: 'MENU',
        code: 'system:missing',
        name: '缺失组件',
        parentId: '1',
        path: '/system/missing',
        component: 'system/missing/index',
        icon: null,
        sort: 2,
        enabled: true,
        children: [],
      },
      {
        id: '4',
        type: 'MENU',
        code: 'system:disabled',
        name: '已禁用',
        parentId: '1',
        path: '/system/disabled',
        component: 'system/user/index',
        icon: null,
        sort: 3,
        enabled: false,
        children: [],
      },
    ],
  },
]

describe('menusToRoutes', () => {
  it('maps enabled MENU nodes and skips DIRECTORY / disabled nodes', () => {
    const routes = menusToRoutes(menus)

    expect(routes).toHaveLength(2)
    expect(routes[0]).toMatchObject({
      path: '/system/user',
      name: 'system:user',
      meta: {
        title: '用户管理',
        icon: 'user',
        permission: 'system:user',
      },
    })
    expect(routes[1]).toMatchObject({
      path: '/system/missing',
      name: 'system:missing',
    })
    expect(typeof routes[0]?.component).toBe('function')
    expect(typeof routes[1]?.component).toBe('function')
  })
})
