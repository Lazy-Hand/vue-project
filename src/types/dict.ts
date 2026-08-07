export interface DictType {
  id: string
  code: string
  name: string
  description: string | null
  enabled: boolean
  createdAt?: string
  updatedAt?: string
}

export interface DictItem {
  id: string
  dictTypeId: string
  code: string
  label: string
  value: string
  sort: number
  enabled: boolean
  createdAt?: string
  updatedAt?: string
}

export interface DictTypeWithItems extends DictType {
  items: DictItem[]
}

export interface DictTypePayload {
  code: string
  name: string
  description?: string
  enabled?: boolean
}

export type UpdateDictTypePayload = Partial<Omit<DictTypePayload, 'code'>>

export interface DictItemPayload {
  dictTypeId: string
  code: string
  label: string
  value: string
  sort?: number
  enabled?: boolean
}

export type UpdateDictItemPayload = Partial<Omit<DictItemPayload, 'dictTypeId' | 'code'>>

export interface DictOption {
  label: string
  value: string
  code: string
  disabled?: boolean
}

/** Known dictionary type codes used by the app. */
export const DICT_CODES = {
  COMMON_STATUS: 'sys_common_status',
} as const
