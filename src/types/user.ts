export interface ManagedUser {
  id: string
  username: string
  nickname: string | null
  email: string | null
  phone: string | null
  avatar: string | null
  deptId: string | null
  deptName: string | null
  enabled: boolean
  createdAt?: string
  updatedAt?: string
}

export interface CreateUserPayload {
  username: string
  password: string
  nickname?: string
  email?: string
  phone?: string
  avatar?: string
  deptId?: string | null
  postIds?: string[]
  enabled?: boolean
}

export interface UpdateUserPayload {
  username?: string
  nickname?: string
  email?: string
  phone?: string
  /** 传 null 表示清除头像 */
  avatar?: string | null
  deptId?: string | null
  enabled?: boolean
}
