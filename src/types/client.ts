export interface Client {
  id: string
  code: string
  name: string
  contactName: string | null
  contactPhone: string | null
  contactEmail: string | null
  address: string | null
  description: string | null
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface ClientPayload {
  code: string
  name: string
  contactName?: string
  contactPhone?: string
  contactEmail?: string
  address?: string
  description?: string
  enabled?: boolean
}

export type UpdateClientPayload = Partial<ClientPayload>
