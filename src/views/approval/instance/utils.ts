import type { ProTableRequestParams } from '@/types/pro-table'
import type { ApprovalInstanceQuery } from '@/types/approval'

function trimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

export function mapInstanceQuery(params: ProTableRequestParams): ApprovalInstanceQuery {
  const query: ApprovalInstanceQuery = {
    page: params.page,
    pageSize: params.pageSize,
  }

  const keyword = trimmedString(params.keyword)
  if (keyword) query.keyword = keyword

  const status = trimmedString(params.status)
  if (status) query.status = status as ApprovalInstanceQuery['status']

  const definitionId = trimmedString(params.definitionId)
  if (definitionId) query.definitionId = definitionId

  const businessType = trimmedString(params.businessType)
  if (businessType) query.businessType = businessType

  return query
}
