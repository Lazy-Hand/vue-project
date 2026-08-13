import type { DeptTreeNode } from '@/types/dept'

/** Collect an item id and all descendant ids for parent selection guards. */
export function collectDescendantIds(node: DeptTreeNode): string[] {
  const ids = [node.id]
  for (const child of node.children ?? []) ids.push(...collectDescendantIds(child))
  return ids
}

export function findDeptNode(nodes: DeptTreeNode[], id: string): DeptTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    const nested = findDeptNode(node.children ?? [], id)
    if (nested) return nested
  }
  return null
}

/** Keep matching departments and their ancestors while preserving tree shape. */
export function filterTreeByKeyword(nodes: DeptTreeNode[], keyword: string): DeptTreeNode[] {
  const query = keyword.trim().toLowerCase()
  if (!query) return nodes

  const walk = (items: DeptTreeNode[]): DeptTreeNode[] => {
    const result: DeptTreeNode[] = []
    for (const node of items) {
      const children = walk(node.children ?? [])
      const matched =
        node.name.toLowerCase().includes(query) ||
        (node.code ?? '').toLowerCase().includes(query) ||
        children.length > 0
      if (matched) result.push({ ...node, children })
    }
    return result
  }

  return walk(nodes)
}
