import type { OnlineSessionQuery } from '@/types/session'
import type { ProTableRequestParams } from '@/types/pro-table'

function trimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

/** Translate ProTable's search state into the server-side session query contract. */
export function mapSessionQuery(params: ProTableRequestParams): OnlineSessionQuery {
  const query: OnlineSessionQuery = {
    page: params.page,
    pageSize: params.pageSize,
  }

  const keyword = trimmedString(params.keyword)
  if (keyword) query.keyword = keyword

  return query
}
