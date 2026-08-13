export interface AccountSet {
  id: string
  code: string
  name: string
  sort: number
  enabled: boolean
  description: string | null
  createdAt: string
  updatedAt: string
}

export type AccountSetSummary = Pick<AccountSet, 'id' | 'code' | 'name' | 'enabled'> & {
  isDefault: boolean
}

export interface AccountSetPayload {
  code: string
  name: string
  sort?: number
  enabled?: boolean
  description?: string
}

export interface UpdateAccountSetPayload {
  name?: string
  sort?: number
  enabled?: boolean
  description?: string
}

export interface AccountSetMember {
  id: string
  username: string
  nickname: string | null
  isDefault: boolean
}

export interface AccountSetUserAssignment {
  userIds: string[]
  defaultUserId?: string
}
