import { request } from '@/utils/request'
import type { Post } from '@/types/post'

export function fetchPosts(): Promise<Post[]> {
  return request.Get<Post[]>('/post', { cacheFor: 0 })
}
