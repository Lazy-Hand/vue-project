export interface Dept {
  id: string
  name: string
  code: string | null
  parentId: string | null
  sort: number
  enabled: boolean
}

export interface DeptTreeNode extends Dept {
  children: DeptTreeNode[]
}
