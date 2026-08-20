import type { ProTableRequestParams } from '@/types/pro-table'
import type { JobQuery, JobStatus, MisfirePolicy } from '@/types/scheduler'

function trimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

export function mapJobQuery(params: ProTableRequestParams): JobQuery {
  const query: JobQuery = {
    page: params.page,
    pageSize: params.pageSize,
  }

  const jobName = trimmedString(params.jobName)
  if (jobName) query.jobName = jobName

  const jobGroup = trimmedString(params.jobGroup)
  if (jobGroup) query.jobGroup = jobGroup

  if (params.status === 'ENABLED' || params.status === 'DISABLED') {
    query.status = params.status as JobStatus
  }

  return query
}

export function jobGroupColor(group: string | null | undefined): string {
  switch (group?.toUpperCase()) {
    case 'SYSTEM':
      return 'blue'
    case 'BUSINESS':
      return 'purple'
    case 'DATABASE':
      return 'cyan'
    case 'LOG':
      return 'orange'
    default:
      return 'default'
  }
}

export function misfirePolicyLabel(
  policy: MisfirePolicy | string | null | undefined,
  t: (key: string) => string,
): string {
  switch (policy) {
    case 'IGNORE':
      return t('scheduler.task.misfireIgnore')
    case 'FIRE_ONCE':
      return t('scheduler.task.misfireFireOnce')
    case 'DEFAULT':
    default:
      return t('scheduler.task.misfireDefault')
  }
}

/** 解析单个 Cron 字段的有效数值集合 */
export function parseCronField(field: string, min: number, max: number): number[] | null {
  const clean = field.trim()
  if (!clean || clean === '*' || clean === '?') {
    const res: number[] = []
    for (let i = min; i <= max; i++) res.push(i)
    return res
  }

  const items = clean.split(',')
  const set = new Set<number>()

  for (const item of items) {
    if (item.includes('/')) {
      const [rangePart, stepStr] = item.split('/')
      const step = Number.parseInt(stepStr ?? '', 10)
      if (Number.isNaN(step) || step <= 0) return null

      let start = min
      let end = max
      if (rangePart && rangePart !== '*' && rangePart !== '?') {
        if (rangePart.includes('-')) {
          const [s, e] = rangePart.split('-')
          start = Number.parseInt(s ?? '', 10)
          end = Number.parseInt(e ?? '', 10)
        } else {
          start = Number.parseInt(rangePart, 10)
        }
      }
      if (Number.isNaN(start) || Number.isNaN(end)) return null
      for (let i = start; i <= end; i += step) {
        if (i >= min && i <= max) set.add(i)
      }
    } else if (item.includes('-')) {
      const [s, e] = item.split('-')
      const start = Number.parseInt(s ?? '', 10)
      const end = Number.parseInt(e ?? '', 10)
      if (Number.isNaN(start) || Number.isNaN(end)) return null
      for (let i = start; i <= end; i++) {
        if (i >= min && i <= max) set.add(i)
      }
    } else {
      const num = Number.parseInt(item, 10)
      if (Number.isNaN(num) || num < min || num > max) return null
      set.add(num)
    }
  }

  return Array.from(set).sort((a, b) => a - b)
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

export function formatDateTimeString(date: Date): string {
  const y = date.getFullYear()
  const m = pad2(date.getMonth() + 1)
  const d = pad2(date.getDate())
  const h = pad2(date.getHours())
  const min = pad2(date.getMinutes())
  const s = pad2(date.getSeconds())
  return `${y}-${m}-${d} ${h}:${min}:${s}`
}

/**
 * 预估 Cron 表达式接下来 N 次的触发时间
 */
export function getNextCronRuns(
  cronExpression: string,
  count = 5,
  fromTime = new Date(),
): string[] {
  const parts = cronExpression.trim().split(/\s+/)
  if (parts.length < 5 || parts.length > 6) return []

  // 标准化为 6 个字段 (sec, min, hour, dom, month, dow)
  let secField = '0'
  let minField = '*'
  let hourField = '*'
  let domField = '*'
  let monthField = '*'
  let dowField = '*'

  if (parts.length === 5) {
    ;[minField, hourField, domField, monthField, dowField] = parts as [
      string,
      string,
      string,
      string,
      string,
    ]
  } else {
    ;[secField, minField, hourField, domField, monthField, dowField] = parts as [
      string,
      string,
      string,
      string,
      string,
      string,
    ]
  }

  const seconds = parseCronField(secField, 0, 59)
  const minutes = parseCronField(minField, 0, 59)
  const hours = parseCronField(hourField, 0, 23)
  const doms = parseCronField(domField, 1, 31)
  const months = parseCronField(monthField, 1, 12)
  const dows = parseCronField(dowField, 0, 7)?.map((d) => (d === 7 ? 0 : d))

  if (!seconds || !minutes || !hours || !doms || !months || !dows) return []

  const secSet = new Set(seconds)
  const minSet = new Set(minutes)
  const hourSet = new Set(hours)
  const domSet = new Set(doms)
  const monthSet = new Set(months)
  const dowSet = new Set(dows)

  const results: string[] = []
  // 从下一秒开始计算
  const current = new Date(fromTime.getTime() + 1000)
  current.setMilliseconds(0)

  // 步长根据秒字段决定（若只有固定 0 秒，每次增加 1 分钟加快查找）
  const hasFixedSec = seconds.length === 1 && seconds[0] === 0
  if (hasFixedSec) {
    current.setSeconds(0)
  }

  let iterations = 0
  const maxIterations = 50000

  while (results.length < count && iterations < maxIterations) {
    iterations++
    const sec = current.getSeconds()
    const min = current.getMinutes()
    const hour = current.getHours()
    const dom = current.getDate()
    const month = current.getMonth() + 1
    const dow = current.getDay()

    const matchMonth = monthSet.has(month)
    const matchDom = domSet.has(dom)
    const matchDow = dowSet.has(dow)
    const matchHour = hourSet.has(hour)
    const matchMin = minSet.has(min)
    const matchSec = secSet.has(sec)

    if (matchMonth && matchDom && matchDow && matchHour && matchMin && matchSec) {
      results.push(formatDateTimeString(new Date(current)))
      if (hasFixedSec) {
        current.setMinutes(current.getMinutes() + 1)
      } else {
        current.setSeconds(current.getSeconds() + 1)
      }
      continue
    }

    if (hasFixedSec) {
      current.setMinutes(current.getMinutes() + 1)
    } else {
      current.setSeconds(current.getSeconds() + 1)
    }
  }

  return results
}

/** 尝试格式化 JSON 字符串 */
export function formatJsonString(input: string): {
  success: boolean
  formatted?: string
  error?: string
} {
  const trimmed = input.trim()
  if (!trimmed) return { success: true, formatted: '' }

  try {
    const parsed = JSON.parse(trimmed) as unknown
    return {
      success: true,
      formatted: JSON.stringify(parsed, null, 2),
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Invalid JSON',
    }
  }
}
