import { blobRequest, request } from '@/utils/request'
import type { PaginatedResult, PaginationQuery } from '@/types/common'
import type { Post } from '@/types/post'
import type { Role } from '@/types/role'
import type {
  CreateUserPayload,
  ManagedUser,
  UpdateUserPayload,
  UserImportResult,
} from '@/types/user'

export function fetchUserList(query: PaginationQuery = {}): Promise<PaginatedResult<ManagedUser>> {
  return request.Get<PaginatedResult<ManagedUser>>('/user/list', {
    params: {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
    },
    cacheFor: 0,
  })
}

/** 下载用户导出文件（xlsx，受当前数据权限过滤）。 */
export function exportUsersBlob(): Promise<Blob> {
  return blobRequest.Get<Blob>('/user/export', { cacheFor: 0 })
}

/** 上传 xlsx 导入用户，返回逐行处理结果。 */
export function importUsersFile(file: File): Promise<UserImportResult> {
  const form = new FormData()
  form.append('file', file)
  return request.Post<UserImportResult>('/user/import', form, { cacheFor: 0 })
}

/** 用户选择器选项（启用用户，昵称优先展示） */
export async function fetchUserOptions(): Promise<{ label: string; value: string }[]> {
  const res = await fetchUserList({ page: 1, pageSize: 200 })
  return res.items
    .filter((user) => user.enabled)
    .map((user) => ({
      label: user.nickname ? `${user.nickname} (${user.username})` : user.username,
      value: user.id,
    }))
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
