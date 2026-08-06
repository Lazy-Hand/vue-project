export type PermissionType = 'DIRECTORY' | 'MENU' | 'BUTTON'

export interface PermissionTreeNode {
  id: string
  type: PermissionType
  code: string
  name: string
  parentId: string | null
  path: string | null
  component: string | null
  icon: string | null
  sort: number
  enabled: boolean
  children: PermissionTreeNode[]
}
