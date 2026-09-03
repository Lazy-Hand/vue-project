import { blobRequest, request } from '@/utils/request'
import type { PaginatedResult } from '@/types/common'
import type {
  CleanLoginLogResult,
  CleanOperationLogResult,
  LoginLog,
  LoginLogQuery,
  OperationLog,
  OperationLogQuery,
} from '@/types/log'

function appendQueryParam(
  params: Record<string, string | number | boolean>,
  key: string,
  value: string | number | boolean | undefined,
): void {
  if (value !== undefined && value !== '') params[key] = value
}

function buildOperationLogParams(
  query: OperationLogQuery,
): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {}
  appendQueryParam(params, 'module', query.module)
  appendQueryParam(params, 'action', query.action)
  appendQueryParam(params, 'success', query.success)
  appendQueryParam(params, 'keyword', query.keyword)
  appendQueryParam(params, 'startTime', query.startTime)
  appendQueryParam(params, 'endTime', query.endTime)
  appendQueryParam(params, 'userId', query.userId)
  return params
}

function buildLoginLogParams(query: LoginLogQuery): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {}
  appendQueryParam(params, 'username', query.username)
  appendQueryParam(params, 'loginType', query.loginType)
  appendQueryParam(params, 'success', query.success)
  appendQueryParam(params, 'ip', query.ip)
  appendQueryParam(params, 'startTime', query.startTime)
  appendQueryParam(params, 'endTime', query.endTime)
  appendQueryParam(params, 'userId', query.userId)
  return params
}

export function fetchOperationLogList(
  query: OperationLogQuery = {},
): Promise<PaginatedResult<OperationLog>> {
  return request.Get<PaginatedResult<OperationLog>>('/operation-log/list', {
    params: {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
      ...buildOperationLogParams(query),
    },
    cacheFor: 0,
  })
}

/** 按当前过滤条件导出操作日志（xlsx）。 */
export function exportOperationLogsBlob(query: OperationLogQuery = {}): Promise<Blob> {
  return blobRequest.Get<Blob>('/operation-log/export', {
    params: buildOperationLogParams(query),
    cacheFor: 0,
  })
}

export function cleanOperationLogs(before?: string): Promise<CleanOperationLogResult> {
  const params = before ? { before } : undefined
  return request.Delete<CleanOperationLogResult>(
    '/operation-log/clean',
    {},
    { params, cacheFor: 0 },
  )
}

export function fetchLoginLogList(query: LoginLogQuery = {}): Promise<PaginatedResult<LoginLog>> {
  return request.Get<PaginatedResult<LoginLog>>('/login-log/list', {
    params: {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
      ...buildLoginLogParams(query),
    },
    cacheFor: 0,
  })
}

/** 按当前过滤条件导出登录日志（xlsx）。 */
export function exportLoginLogsBlob(query: LoginLogQuery = {}): Promise<Blob> {
  return blobRequest.Get<Blob>('/login-log/export', {
    params: buildLoginLogParams(query),
    cacheFor: 0,
  })
}

export function cleanLoginLogs(before?: string): Promise<CleanLoginLogResult> {
  const params = before ? { before } : undefined
  return request.Delete<CleanLoginLogResult>('/login-log/clean', {}, { params, cacheFor: 0 })
}
