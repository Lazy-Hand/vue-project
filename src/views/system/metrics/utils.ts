/** A single sample line from the Prometheus exposition format. */
export interface PromSample {
  name: string
  labels: Record<string, string>
  value: number
}

const SAMPLE_LINE =
  /^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{([^}]*)\})?\s+(-?[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)(?:\s+[0-9]+)?$/

function parseLabels(raw: string): Record<string, string> {
  const labels: Record<string, string> = {}
  if (!raw) return labels

  // label values may be double-quoted with escaped characters
  for (const part of raw.split(',')) {
    const match = part.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*"([^"]*)"\s*$/)
    if (!match) continue
    const key = match[1] ?? ''
    const value = match[2] ?? ''
    labels[key] = value.replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  }
  return labels
}

/** Parse Prometheus exposition text into a flat sample list. */
export function parsePrometheus(text: string): PromSample[] {
  const samples: PromSample[] = []

  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue

    const match = line.match(SAMPLE_LINE)
    if (!match) continue

    const name = match[1] ?? ''
    const value = Number(match[3])
    if (!Number.isFinite(value)) continue

    samples.push({
      name,
      labels: parseLabels(match[2] ?? ''),
      value,
    })
  }

  return samples
}

/** Find the first sample with the given name, optionally filtered by labels. */
export function findSample(
  samples: PromSample[],
  name: string,
  labels: Record<string, string> = {},
): number | undefined {
  for (const sample of samples) {
    if (sample.name !== name) continue
    if (Object.entries(labels).some(([key, value]) => sample.labels[key] !== value)) continue
    return sample.value
  }
  return undefined
}

/** Sum all samples with the given name, optionally filtered by labels. */
export function sumSamples(
  samples: PromSample[],
  name: string,
  labels: Record<string, string> = {},
): number | undefined {
  let total = 0
  let found = false
  for (const sample of samples) {
    if (sample.name !== name) continue
    if (Object.entries(labels).some(([key, value]) => sample.labels[key] !== value)) continue
    total += sample.value
    found = true
  }
  return found ? total : undefined
}

/** Format a byte count into a compact human-readable string. */
export function formatBytes(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value) || value < 0) return '-'
  if (value < 1024) return `${value.toFixed(0)} B`
  const units = ['KB', 'MB', 'GB', 'TB'] as const
  let scaled = value
  let unit = -1
  while (scaled >= 1024 && unit < units.length - 1) {
    scaled /= 1024
    unit += 1
  }
  return `${scaled.toFixed(unit >= 2 ? 2 : 1)} ${units[Math.max(0, unit)]}`
}

/** Format a seconds duration as `{d}d {h}h {m}m {s}s` when meaningful. */
export function formatUptime(seconds: number | undefined): string {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return '-'
  const total = Math.floor(seconds)
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60

  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`
  if (minutes > 0) return `${minutes}m ${secs}s`
  return `${secs}s`
}

/** Format seconds (e.g. CPU time) with a fixed precision. */
export function formatSeconds(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value) || value < 0) return '-'
  return `${value.toFixed(2)}s`
}

/** One row of the HTTP request statistics table. */
export interface HttpRequestStat {
  method: string
  route: string
  statusCode: string
  count: number
}

/**
 * Aggregate the `http_requests_total` counter samples into table rows,
 * sorted by request count in descending order.
 */
export function httpRequestStats(samples: PromSample[]): HttpRequestStat[] {
  const stats = new Map<string, HttpRequestStat>()

  for (const sample of samples) {
    if (sample.name !== 'http_requests_total') continue
    const key = `${sample.labels.method ?? ''}|${sample.labels.route ?? ''}|${sample.labels.status_code ?? ''}`
    const existing = stats.get(key)
    if (existing) {
      existing.count += sample.value
    } else {
      stats.set(key, {
        method: sample.labels.method ?? '-',
        route: sample.labels.route ?? '-',
        statusCode: sample.labels.status_code ?? '-',
        count: sample.value,
      })
    }
  }

  return [...stats.values()].sort((a, b) => b.count - a.count)
}

/** Compute heap usage percentage (0-100). */
export function getHeapUsagePercentage(
  used: number | undefined,
  total: number | undefined,
): number {
  if (!used || !total || total <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((used / total) * 100)))
}

/** Determine Event Loop health state based on p50 latency in seconds. */
export function getEventLoopStatus(
  lagSeconds: number | undefined,
): 'healthy' | 'warning' | 'critical' {
  if (lagSeconds === undefined) return 'healthy'
  const ms = lagSeconds * 1000
  if (ms < 10) return 'healthy'
  if (ms <= 50) return 'warning'
  return 'critical'
}

/** Get badge/tag color for HTTP Method. */
export function getMethodTagColor(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'blue'
    case 'POST':
      return 'green'
    case 'PUT':
    case 'PATCH':
      return 'orange'
    case 'DELETE':
      return 'red'
    default:
      return 'default'
  }
}

/** Get badge/tag color for HTTP Status Code. */
export function getStatusCodeTagColor(code: string | number): string {
  const num = Number(code)
  if (num >= 200 && num < 300) return 'green'
  if (num >= 300 && num < 400) return 'blue'
  if (num >= 400 && num < 500) return 'orange'
  if (num >= 500) return 'red'
  return 'default'
}
