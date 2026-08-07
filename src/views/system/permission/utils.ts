import type { PermissionTreeNode } from '@/types/permission'

/** Collect id + all descendant ids (used to exclude invalid parents when editing). */
export function collectDescendantIds(node: PermissionTreeNode): string[] {
  const ids = [node.id]
  for (const child of node.children ?? []) {
    ids.push(...collectDescendantIds(child))
  }
  return ids
}

export function findPermissionNode(
  nodes: PermissionTreeNode[],
  id: string,
): PermissionTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    const nested = findPermissionNode(node.children ?? [], id)
    if (nested) return nested
  }
  return null
}

export function filterTreeByKeyword(
  nodes: PermissionTreeNode[],
  keyword: string,
): PermissionTreeNode[] {
  const q = keyword.trim().toLowerCase()
  if (!q) return nodes

  const walk = (list: PermissionTreeNode[]): PermissionTreeNode[] => {
    const result: PermissionTreeNode[] = []
    for (const node of list) {
      const children = walk(node.children ?? [])
      const matched =
        node.name.toLowerCase().includes(q) ||
        node.code.toLowerCase().includes(q) ||
        children.length > 0
      if (matched) {
        result.push({ ...node, children })
      }
    }
    return result
  }

  return walk(nodes)
}
