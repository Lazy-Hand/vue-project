import { request } from '@/utils/request'
import type { PaginatedResult } from '@/types/common'
import type { Notice, NoticePayload, NoticeQuery, UpdateNoticePayload } from '@/types/notice'

export function fetchNoticeList(query: NoticeQuery = {}): Promise<PaginatedResult<Notice>> {
  const params: Record<string, string | number> = {
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 10,
  }
  const keyword = query.keyword?.trim()
  if (keyword) params.keyword = keyword
  if (query.status) params.status = query.status

  return request.Get<PaginatedResult<Notice>>('/notice/list', {
    params,
    cacheFor: 0,
  })
}

export function createNotice(payload: NoticePayload): Promise<Notice> {
  return request.Post<Notice>('/notice', payload, { cacheFor: 0 })
}

export function updateNotice(id: string, payload: UpdateNoticePayload): Promise<Notice> {
  return request.Patch<Notice>(`/notice/${encodeURIComponent(id)}`, payload, { cacheFor: 0 })
}

export function deleteNotice(id: string): Promise<void> {
  return request.Delete<void>(`/notice/${encodeURIComponent(id)}`, undefined, { cacheFor: 0 })
}

export function publishNotice(id: string): Promise<Notice> {
  return request.Post<Notice>(`/notice/${encodeURIComponent(id)}/publish`, undefined, {
    cacheFor: 0,
  })
}
