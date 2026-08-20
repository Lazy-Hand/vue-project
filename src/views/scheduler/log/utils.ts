import type { ProTableRequestParams } from '@/types/pro-table'
import type { JobLogQuery, JobLogStatus } from '@/types/scheduler'

interface IsoValue {
  toISOString: () => string
}

function isIsoValue(value: object): value is IsoValue {
  return 'toISOString' in value && typeof value.toISOString === 'function'
}

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

export function mapJobLogQuery(params: ProTableRequestParams): JobLogQuery {
  const query: JobLogQuery = {
    page: params.page,
    pageSize: params.pageSize,
  }

  const jobName = trimmedString(params.jobName)
  if (jobName) query.jobName = jobName

  const jobGroup = trimmedString(params.jobGroup)
  if (jobGroup) query.jobGroup = jobGroup

  if (params.jobId && typeof params.jobId === 'string') {
    query.jobId = params.jobId.trim()
  }

  if (params.status && typeof params.status === 'string') {
    query.status = params.status as JobLogStatus
  }

  const dateRange = mapDateRange(params.dateRange)
  if (dateRange) {
    query.startTime = dateRange[0]
    query.endTime = dateRange[1]
  }

  return query
}

export function jobLogStatusColor(status: JobLogStatus | string | null | undefined): string {
  switch (String(status).toUpperCase()) {
    case 'SUCCESS':
      return 'green'
    case 'RUNNING':
      return 'blue'
    case 'FAILED':
      return 'red'
    case 'SKIPPED':
      return 'orange'
    default:
      return 'default'
  }
}

export function formatJobDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) return '-'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

export function formatTriggerSource(
  source: string | null | undefined,
  t: (key: string, values?: Record<string, unknown>) => string,
): string {
  if (!source) return '-'
  if (source === 'scheduler') return t('scheduler.log.triggeredByScheduler')
  if (source.startsWith('manual:')) {
    const user = source.slice(7)
    return t('scheduler.log.triggeredByManual', { user })
  }
  return source
}
