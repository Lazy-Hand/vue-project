import type { OperationLogQuery } from '@/types/log'
import type { ProTableRequestParams } from '@/types/pro-table'

interface IsoValue {
  toISOString: () => string
}

function isIsoValue(value: object): value is IsoValue {
  return 'toISOString' in value && typeof value.toISOString === 'function'
}

/** Convert a Date/dayjs-like value to a stable ISO string for an API query. */
export function toIsoString(value: unknown): string | undefined {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString()
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
  }

  if (typeof value === 'object' && value !== null && isIsoValue(value)) {
    const iso = value.toISOString()
    return iso || undefined
  }

  return undefined
}

/** Build the inclusive time range values used by the operation log endpoint. */
export function mapDateRange(value: unknown): [string, string] | undefined {
  if (!Array.isArray(value) || value.length < 2) return undefined

  const start = toIsoString(value[0])
  const end = toIsoString(value[1])
  if (!start || !end) return undefined
  return [start, end]
}

function trimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

/** Translate ProTable's search state into the server-side log query contract. */
export function mapLogQuery(params: ProTableRequestParams): OperationLogQuery {
  const query: OperationLogQuery = {
    page: params.page,
    pageSize: params.pageSize,
  }

  const keyword = trimmedString(params.keyword)
  const module = trimmedString(params.module)
  const action = trimmedString(params.action)

  if (keyword) query.keyword = keyword
  if (module) query.module = module
  if (action) query.action = action
  if (typeof params.success === 'boolean') query.success = params.success

  const dateRange = mapDateRange(params.dateRange)
  if (dateRange) {
    query.startTime = dateRange[0]
    query.endTime = dateRange[1]
  }

  return query
}

/** Format a request duration for a compact table cell. */
export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) return '-'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

/** Semantic Tag color for an HTTP method. */
export function methodColor(method: string | null | undefined): string {
  switch (String(method).toUpperCase()) {
    case 'GET':
      return 'green'
    case 'POST':
      return 'blue'
    case 'PUT':
      return 'orange'
    case 'PATCH':
      return 'purple'
    case 'DELETE':
      return 'red'
    default:
      return 'default'
  }
}

/** Semantic Tag color for an HTTP status code. */
export function statusColor(status: number | null | undefined): string {
  if (status === null || status === undefined) return 'default'
  if (status >= 200 && status < 300) return 'green'
  if (status >= 400 && status < 500) return 'orange'
  if (status >= 500) return 'red'
  return 'default'
}
