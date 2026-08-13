export interface Dept {
  id: string
  name: string
  code: string | null
  parentId: string | null
  sort: number
  enabled: boolean
  leader: string | null
  phone: string | null
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface DeptTreeNode extends Dept {
  children: DeptTreeNode[]
}

export interface DeptPayload {
  name: string
  code?: string
  parentId?: string | null
  sort?: number
  enabled?: boolean
  leader?: string
  phone?: string
  description?: string
}

export type UpdateDeptPayload = Partial<DeptPayload>
