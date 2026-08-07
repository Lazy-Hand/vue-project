import { request } from '@/utils/request'
import type { PaginatedResult, PaginationQuery } from '@/types/common'
import type {
  SystemConfig,
  SystemConfigPayload,
  UpdateSystemConfigPayload,
} from '@/types/system-config'

export function fetchSystemConfigList(
  query: PaginationQuery & { keyword?: string } = {},
): Promise<PaginatedResult<SystemConfig>> {
  return request.Get<PaginatedResult<SystemConfig>>('/system-config/list', {
    params: {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
      ...(query.keyword ? { keyword: query.keyword } : {}),
    },
    cacheFor: 0,
  })
}

export function createSystemConfig(payload: SystemConfigPayload): Promise<SystemConfig> {
  return request.Post<SystemConfig>('/system-config', payload, { cacheFor: 0 })
}

export function updateSystemConfig(
  id: string,
  payload: UpdateSystemConfigPayload,
): Promise<SystemConfig> {
  return request.Patch<SystemConfig>(`/system-config/${id}`, payload, { cacheFor: 0 })
}

export function deleteSystemConfig(id: string): Promise<void> {
  return request.Delete<void>(`/system-config/${id}`, { cacheFor: 0 })
}
