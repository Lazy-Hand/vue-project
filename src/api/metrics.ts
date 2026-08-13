import { textRequest } from '@/utils/request'

/** Fetch the Prometheus exposition text from the metrics endpoint. */
export function fetchMetricsText(): Promise<string> {
  return textRequest.Get<string>('/metrics', { cacheFor: 0 })
}
