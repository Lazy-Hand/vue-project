export type DataScope = 'ALL' | 'CUSTOM' | 'DEPT' | 'DEPT_CHILD' | 'SELF'

export const DATA_SCOPES: DataScope[] = ['ALL', 'CUSTOM', 'DEPT', 'DEPT_CHILD', 'SELF']

export const SUPER_ADMIN_ROLE_CODE = 'super_admin'

export interface Role {
  id: string
  code: string
  name: string
  description: string | null
  dataScope: DataScope
  sort: number
  enabled: boolean
  createdAt?: string
  updatedAt?: string
}

export interface RolePayload {
  code: string
  name: string
  description?: string
  dataScope?: DataScope
  deptIds?: string[]
  sort?: number
  enabled?: boolean
}

export type UpdateRolePayload = Partial<RolePayload>
