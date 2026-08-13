import { describe, expect, it } from 'vitest'

import type { DeptTreeNode } from '@/types/dept'
import { collectDescendantIds, filterTreeByKeyword, findDeptNode } from './utils'

function node(
  id: string,
  name: string,
  code: string | null,
  children: DeptTreeNode[] = [],
): DeptTreeNode {
  return {
    id,
    name,
    code,
    parentId: null,
    sort: 0,
    enabled: true,
    leader: null,
    phone: null,
    description: null,
    createdAt: '',
    updatedAt: '',
    children,
  }
}

describe('department page utils', () => {
  const tree = [
    node('1', '总部', 'hq', [
      node('2', '研发部', 'engineering', [node('3', '平台组', 'platform')]),
      node('4', '财务部', 'finance'),
    ]),
  ]

  it('collects a node and every descendant id for parent exclusion', () => {
    expect(collectDescendantIds(tree[0]!)).toEqual(['1', '2', '3', '4'])
    expect(findDeptNode(tree, '3')?.name).toBe('平台组')
    expect(findDeptNode(tree, 'missing')).toBeNull()
  })

  it('filters by name or code while retaining matching ancestors', () => {
    const filtered = filterTreeByKeyword(tree, 'platform')
    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.children[0]?.children[0]?.id).toBe('3')
    expect(filtered[0]?.children[1]).toBeUndefined()

    expect(filterTreeByKeyword(tree, 'finance')[0]?.children[0]?.id).toBe('4')
    expect(filterTreeByKeyword(tree, 'missing')).toEqual([])
  })
})
