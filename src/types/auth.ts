export interface AuthUser {
  id: string
  username: string
  nickname: string | null
  email: string | null
  phone: string | null
  avatar: string | null
  enabled: boolean
}

export interface LoginParams {
  username: string
  password: string
}

export interface AuthTokenData {
  accessToken: string
  tokenType: 'Bearer'
  expiresIn: number
  user: AuthUser
}

export interface ApiResponse<T> {
  code: number
  message: string
  data: T
  errors?: unknown
}

export interface AuthTokenState {
  accessToken: string
  expiresAt: number
}

export interface ApiErrorDetails {
  status?: number
  code?: number
  errors?: unknown
}
