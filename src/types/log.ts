export interface OperationLog {
  id: string
  userId: string | null
  username: string | null
  module: string
  action: string
  method: string
  path: string
  statusCode: number | null
  success: boolean
  errorMessage: string | null
  durationMs: number | null
  ip: string | null
  userAgent: string | null
  /** 已脱敏的请求参数 JSON 字符串 */
  params: string | null
  createdAt: string
}

export interface OperationLogQuery {
  page?: number
  pageSize?: number
  module?: string
  action?: string
  success?: boolean
  keyword?: string
  startTime?: string
  endTime?: string
  userId?: string
}

export interface CleanOperationLogResult {
  count: number
}

export type LoginType = 'PASSWORD' | 'REFRESH' | 'REGISTER'

export interface LoginLog {
  id: string
  userId: string | null
  username: string
  loginType: LoginType
  success: boolean
  failReason: string | null
  ip: string | null
  userAgent: string | null
  createdAt: string
}

export interface LoginLogQuery {
  page?: number
  pageSize?: number
  username?: string
  loginType?: LoginType
  success?: boolean
  ip?: string
  startTime?: string
  endTime?: string
  userId?: string
}

export interface CleanLoginLogResult {
  count: number
}
