import { request } from '@/utils/request'
import type {
  Permission,
  PermissionPayload,
  PermissionTreeNode,
  UpdatePermissionPayload,
} from '@/types/permission'

export function fetchPermissionTree(): Promise<PermissionTreeNode[]> {
  return request.Get<PermissionTreeNode[]>('/permission/tree', { cacheFor: 0 })
}

export function fetchPermission(id: string): Promise<Permission> {
  return request.Get<Permission>(`/permission/${id}`, { cacheFor: 0 })
}

export function createPermission(payload: PermissionPayload): Promise<Permission> {
  return request.Post<Permission>('/permission', payload, { cacheFor: 0 })
}

export function updatePermission(
  id: string,
  payload: UpdatePermissionPayload,
): Promise<Permission> {
  return request.Patch<Permission>(`/permission/${id}`, payload, { cacheFor: 0 })
}

export function deletePermission(id: string): Promise<void> {
  return request.Delete<void>(`/permission/${id}`, {}, { cacheFor: 0 })
}
