import type { FileCategory, FileListQuery } from '@/types/file'
import type { ProTableRequestParams } from '@/types/pro-table'

const FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'] as const

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

/** Build the inclusive time range values used by the file list endpoint. */
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

/** Translate ProTable's search state into the server-side file query contract. */
export function mapFileListQuery(params: ProTableRequestParams): FileListQuery {
  const dateRange = mapDateRange(params.dateRange)
  const category = trimmedString(params.category)
  const query: FileListQuery = {
    page: params.page,
    pageSize: params.pageSize,
  }

  const keyword = trimmedString(params.keyword)
  const businessType = trimmedString(params.businessType)
  const businessId = trimmedString(params.businessId)

  if (keyword) query.keyword = keyword
  if (category) query.category = category as FileCategory
  if (businessType) query.businessType = businessType
  if (businessId) query.businessId = businessId
  if (dateRange) {
    query.startTime = dateRange[0]
    query.endTime = dateRange[1]
  }

  return query
}

/** Format byte counts for a compact, human-readable table cell. */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes <= 0) return '0 B'

  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    FILE_SIZE_UNITS.length - 1,
  )
  const value = bytes / 1024 ** unitIndex
  const precision = unitIndex === 0 ? 0 : value < 10 ? 1 : 0
  const formatted = value.toFixed(precision).replace(/\.0$/, '')
  return `${formatted} ${FILE_SIZE_UNITS[unitIndex]}`
}

export function categoryColor(category: FileCategory | string | null | undefined): string {
  switch (String(category).toUpperCase()) {
    case 'IMAGE':
      return 'green'
    case 'AUDIO':
      return 'purple'
    case 'VIDEO':
      return 'orange'
    default:
      return 'blue'
  }
}

export function isImageFile(file: {
  category?: FileCategory | string
  mimeType?: string
}): boolean {
  return (
    String(file.category).toUpperCase() === 'IMAGE' ||
    (typeof file.mimeType === 'string' && file.mimeType.toLowerCase().startsWith('image/'))
  )
}
