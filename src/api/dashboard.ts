import { request } from '@/utils/request'
import type { DashboardOverview } from '@/types/dashboard'

export function fetchDashboardOverview(): Promise<DashboardOverview> {
  return request.Get<DashboardOverview>('/dashboard/overview', { cacheFor: 0 })
}
