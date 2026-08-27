export interface ImportTemplate {
  id: string
  businessKey: string
  version: number
  name: string
  description: string | null
  enabled: boolean
  fileName: string
  fileSize: string
  createdAt: string
  updatedAt: string
}

export interface ImportTemplatePayload {
  businessKey: string
  name: string
  description?: string
}

export interface UpdateImportTemplatePayload {
  name?: string
  description?: string
  enabled?: boolean
}
