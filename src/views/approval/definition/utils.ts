import type { ProTableRequestParams } from '@/types/pro-table'
import type { ApprovalDefinitionQuery } from '@/types/approval'

function trimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

export function mapDefinitionQuery(params: ProTableRequestParams): ApprovalDefinitionQuery {
  const query: ApprovalDefinitionQuery = {
    page: params.page,
    pageSize: params.pageSize,
  }

  const keyword = trimmedString(params.keyword)
  if (keyword) query.keyword = keyword

  const category = trimmedString(params.category)
  if (category) query.category = category

  if (params.enabled === true || params.enabled === false) {
    query.enabled = params.enabled as boolean
  } else if (params.enabled === 'true') {
    query.enabled = true
  } else if (params.enabled === 'false') {
    query.enabled = false
  }

  return query
}
