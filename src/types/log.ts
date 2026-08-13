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
