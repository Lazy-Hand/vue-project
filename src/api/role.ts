import { request } from '@/utils/request'
import type { PaginatedResult, PaginationQuery } from '@/types/common'
import type { Dept } from '@/types/dept'
import type { Permission } from '@/types/permission'
import type { Role, RolePayload, UpdateRolePayload } from '@/types/role'

export function fetchRoleList(query: PaginationQuery = {}): Promise<PaginatedResult<Role>> {
  return request.Get<PaginatedResult<Role>>('/role/list', {
    params: {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
    },
    cacheFor: 0,
  })
}

export function fetchRoles(): Promise<Role[]> {
  return request.Get<Role[]>('/role', { cacheFor: 0 })
}

export function createRole(payload: RolePayload): Promise<Role> {
  return request.Post<Role>('/role', payload, { cacheFor: 0 })
}

export function updateRole(id: string, payload: UpdateRolePayload): Promise<Role> {
  return request.Patch<Role>(`/role/${id}`, payload, { cacheFor: 0 })
}

export function deleteRole(id: string): Promise<void> {
  return request.Delete<void>(`/role/${id}`, { cacheFor: 0 })
}

export function fetchRolePermissions(id: string): Promise<Permission[]> {
  return request.Get<Permission[]>(`/role/${id}/permissions`, { cacheFor: 0 })
}

export function assignRolePermissions(id: string, permissionIds: string[]): Promise<Permission[]> {
  return request.Put<Permission[]>(`/role/${id}/permissions`, { permissionIds }, { cacheFor: 0 })
}

export function fetchRoleDepts(id: string): Promise<Dept[]> {
  return request.Get<Dept[]>(`/role/${id}/depts`, { cacheFor: 0 })
}
