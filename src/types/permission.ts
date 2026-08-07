export type PermissionType = 'DIRECTORY' | 'MENU' | 'BUTTON'

export interface Permission {
  id: string
  type: PermissionType
  code: string
  name: string
  nameI18n?: Partial<Record<'zh-CN' | 'en-US', string>>
  parentId: string | null
  path: string | null
  component: string | null
  icon: string | null
  sort: number
  enabled: boolean
  createdAt?: string
  updatedAt?: string
}

export interface PermissionTreeNode extends Permission {
  children: PermissionTreeNode[]
}

export interface PermissionPayload {
  type: PermissionType
  code: string
  name: string
  nameI18n?: Partial<Record<'zh-CN' | 'en-US', string>>
  parentId?: string
  path?: string
  component?: string
  icon?: string
  sort?: number
  enabled?: boolean
}

export type UpdatePermissionPayload = Partial<PermissionPayload>
