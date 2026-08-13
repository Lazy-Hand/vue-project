import type { NoticeQuery, NoticeStatus } from '@/types/notice'
import type { ProTableRequestParams } from '@/types/pro-table'

function trimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

function noticeStatus(value: unknown): NoticeStatus | undefined {
  if (value === 'DRAFT' || value === 'PUBLISHED') return value
  return undefined
}

/** Translate ProTable's search state into the server-side notice query contract. */
export function mapNoticeQuery(params: ProTableRequestParams): NoticeQuery {
  const query: NoticeQuery = {
    page: params.page,
    pageSize: params.pageSize,
  }

  const keyword = trimmedString(params.keyword)
  if (keyword) query.keyword = keyword

  const status = noticeStatus(params.status)
  if (status) query.status = status

  return query
}
