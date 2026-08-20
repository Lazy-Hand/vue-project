import { request, textRequest } from '@/utils/request'
import type { DetailedHealthStatus } from '@/types/health'

/** Fetch the Prometheus exposition text from the metrics endpoint. */
export function fetchMetricsText(): Promise<string> {
  return textRequest.Get<string>('/metrics', { cacheFor: 0 })
}

/** Fetch detailed runtime health information (DB/Redis latency, memory, clients). */
export function fetchDetailedHealthStatus(): Promise<DetailedHealthStatus> {
  return request.Get<DetailedHealthStatus>('/health/detail', { cacheFor: 0 })
}
