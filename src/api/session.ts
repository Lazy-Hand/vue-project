import { request } from '@/utils/request'
import type { PaginatedResult } from '@/types/common'
import type { OnlineSession, OnlineSessionQuery } from '@/types/session'

export function fetchOnlineSessionList(
  query: OnlineSessionQuery = {},
): Promise<PaginatedResult<OnlineSession>> {
  const params: Record<string, string | number> = {
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 10,
  }
  const keyword = query.keyword?.trim()
  if (keyword) params.keyword = keyword

  return request.Get<PaginatedResult<OnlineSession>>('/session/list', {
    params,
    cacheFor: 0,
  })
}

/** 强制下线指定会话（幂等） */
export function revokeSession(sessionId: string): Promise<void> {
  return request.Delete<void>(`/session/${encodeURIComponent(sessionId)}`, undefined, {
    cacheFor: 0,
  })
}
