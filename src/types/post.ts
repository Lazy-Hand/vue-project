export interface Post {
  id: string
  code: string
  name: string
  sort: number
  enabled: boolean
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface PostPayload {
  code: string
  name: string
  sort?: number
  enabled?: boolean
  description?: string
}

export type UpdatePostPayload = Partial<Omit<PostPayload, 'code'>>
