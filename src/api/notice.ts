import { request } from '@/utils/request'
import type { PaginatedResult } from '@/types/common'
import type {
  Notice,
  NoticeCountResult,
  NoticePayload,
  NoticeQuery,
  NoticeTargetPayload,
  PublishedNotice,
  UpdateNoticePayload,
} from '@/types/notice'

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
  return request.Delete<void>(`/notice/${encodeURIComponent(id)}`, {}, { cacheFor: 0 })
}

export function publishNotice(id: string, payload: NoticeTargetPayload = {}): Promise<Notice> {
  return request.Post<Notice>(`/notice/${encodeURIComponent(id)}/publish`, payload, {
    cacheFor: 0,
  })
}

/** 分页查询已发布公告（含当前用户已读状态，用户端通知列表） */
export function fetchPublishedNotices(
  query: NoticeQuery = {},
): Promise<PaginatedResult<PublishedNotice>> {
  const params: Record<string, string | number> = {
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 10,
  }
  const keyword = query.keyword?.trim()
  if (keyword) params.keyword = keyword

  return request.Get<PaginatedResult<PublishedNotice>>('/notice/published', {
    params,
    cacheFor: 0,
  })
}

/** 当前用户未读公告数（header 通知角标） */
export function fetchUnreadNoticeCount(): Promise<NoticeCountResult> {
  return request.Get<NoticeCountResult>('/notice/unread-count', { cacheFor: 0 })
}

/** 标记指定公告为已读（幂等） */
export function markNoticeRead(id: string): Promise<void> {
  return request.Post<void>(`/notice/${encodeURIComponent(id)}/read`, undefined, {
    cacheFor: 0,
  })
}

/** 将全部已发布公告标记为已读，返回本次新增条数 */
export function markAllNoticesRead(): Promise<NoticeCountResult> {
  return request.Post<NoticeCountResult>('/notice/read-all', undefined, { cacheFor: 0 })
}
