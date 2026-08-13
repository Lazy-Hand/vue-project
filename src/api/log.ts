import { request } from '@/utils/request'
import type { PaginatedResult } from '@/types/common'
import type { CleanOperationLogResult, OperationLog, OperationLogQuery } from '@/types/log'

function appendQueryParam(
  params: Record<string, string | number | boolean>,
  key: string,
  value: string | number | boolean | undefined,
): void {
  if (value !== undefined && value !== '') params[key] = value
}

export function fetchOperationLogList(
  query: OperationLogQuery = {},
): Promise<PaginatedResult<OperationLog>> {
  const params: Record<string, string | number | boolean> = {
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 10,
  }
  appendQueryParam(params, 'module', query.module)
  appendQueryParam(params, 'action', query.action)
  appendQueryParam(params, 'success', query.success)
  appendQueryParam(params, 'keyword', query.keyword)
  appendQueryParam(params, 'startTime', query.startTime)
  appendQueryParam(params, 'endTime', query.endTime)
  appendQueryParam(params, 'userId', query.userId)

  return request.Get<PaginatedResult<OperationLog>>('/operation-log/list', {
    params,
    cacheFor: 0,
  })
}

export function cleanOperationLogs(before?: string): Promise<CleanOperationLogResult> {
  const body = before ? { before } : {}
  return request.Delete<CleanOperationLogResult>('/operation-log/clean', body, { cacheFor: 0 })
}
