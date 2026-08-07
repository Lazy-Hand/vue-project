export interface SystemConfig {
  id: string
  key: string
  name: string
  value: string | null
  description: string | null
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface SystemConfigPayload {
  key: string
  name: string
  value?: string | null
  description?: string | null
  enabled?: boolean
}

export type UpdateSystemConfigPayload = Partial<Omit<SystemConfigPayload, 'key'>>
