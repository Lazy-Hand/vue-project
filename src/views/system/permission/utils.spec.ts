import { describe, expect, it } from 'vitest'

import type { PermissionTreeNode } from '@/types/permission'
import { collectDescendantIds, filterTreeByKeyword, findPermissionNode } from './utils'

function node(
  id: string,
  name: string,
  code: string,
  children: PermissionTreeNode[] = [],
): PermissionTreeNode {
  return {
    id,
    type: 'MENU',
    code,
    name,
    parentId: null,
    path: null,
    component: null,
    icon: null,
    sort: 0,
    enabled: true,
    createdAt: '',
    updatedAt: '',
    children,
  }
}

describe('permission page utils', () => {
  const tree = [
    node('1', '系统管理', 'system', [
      node('2', '用户管理', 'system:user', [node('3', '新增用户', 'system:user:create')]),
    ]),
  ]

  it('finds nodes and collects descendants', () => {
    expect(findPermissionNode(tree, '2')?.code).toBe('system:user')
    expect(collectDescendantIds(tree[0]!)).toEqual(['1', '2', '3'])
  })

  it('filters tree by keyword while keeping ancestors', () => {
    const filtered = filterTreeByKeyword(tree, '用户')
    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.children[0]?.code).toBe('system:user')
  })
})
