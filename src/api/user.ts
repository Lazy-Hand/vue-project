import { request } from '@/utils/request'
import type { PaginatedResult, PaginationQuery } from '@/types/common'
import type { Post } from '@/types/post'
import type { Role } from '@/types/role'
import type { CreateUserPayload, ManagedUser, UpdateUserPayload } from '@/types/user'

export function fetchUserList(query: PaginationQuery = {}): Promise<PaginatedResult<ManagedUser>> {
  return request.Get<PaginatedResult<ManagedUser>>('/user/list', {
    params: {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
    },
    cacheFor: 0,
  })
}

export function createUser(payload: CreateUserPayload): Promise<ManagedUser> {
  return request.Post<ManagedUser>('/user', payload, { cacheFor: 0 })
}

export function updateUser(id: string, payload: UpdateUserPayload): Promise<ManagedUser> {
  return request.Patch<ManagedUser>(`/user/${id}`, payload, { cacheFor: 0 })
}

export function deleteUser(id: string): Promise<void> {
  return request.Delete<void>(`/user/${id}`, {}, { cacheFor: 0 })
}

export function resetUserPassword(id: string, password: string): Promise<void> {
  return request.Put<void>(`/user/${id}/password`, { password }, { cacheFor: 0 })
}

export function fetchUserRoles(id: string): Promise<Role[]> {
  return request.Get<Role[]>(`/user/${id}/roles`, { cacheFor: 0 })
}

export function assignUserRoles(id: string, roleIds: string[]): Promise<Role[]> {
  return request.Put<Role[]>(`/user/${id}/roles`, { roleIds }, { cacheFor: 0 })
}

export function fetchUserPosts(id: string): Promise<Post[]> {
  return request.Get<Post[]>(`/user/${id}/posts`, { cacheFor: 0 })
}

export function assignUserPosts(id: string, postIds: string[]): Promise<Post[]> {
  return request.Put<Post[]>(`/user/${id}/posts`, { postIds }, { cacheFor: 0 })
}
