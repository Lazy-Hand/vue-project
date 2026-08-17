import { request } from '@/utils/request'
import type { PaginatedResult, PaginationQuery } from '@/types/common'
import type { Post, PostPayload, UpdatePostPayload } from '@/types/post'

export function fetchPosts(): Promise<Post[]> {
  return request.Get<Post[]>('/post', { cacheFor: 0 })
}

export function fetchPostList(
  query: PaginationQuery & { keyword?: string } = {},
): Promise<PaginatedResult<Post>> {
  return request.Get<PaginatedResult<Post>>('/post/list', {
    params: {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
      ...(query.keyword ? { keyword: query.keyword } : {}),
    },
    cacheFor: 0,
  })
}

export function fetchPost(id: string): Promise<Post> {
  return request.Get<Post>(`/post/${id}`, { cacheFor: 0 })
}

export function createPost(payload: PostPayload): Promise<Post> {
  return request.Post<Post>('/post', payload, { cacheFor: 0 })
}

export function updatePost(id: string, payload: UpdatePostPayload): Promise<Post> {
  return request.Patch<Post>(`/post/${id}`, payload, { cacheFor: 0 })
}

export function deletePost(id: string): Promise<void> {
  return request.Delete<void>(`/post/${id}`, {}, { cacheFor: 0 })
}
