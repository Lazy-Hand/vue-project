import { request } from '@/utils/request'
import type { DashboardOverview, DashboardTrends } from '@/types/dashboard'

export function fetchDashboardOverview(): Promise<DashboardOverview> {
  return request.Get<DashboardOverview>('/dashboard/overview', { cacheFor: 0 })
}

export function fetchDashboardTrends(days = 7): Promise<DashboardTrends> {
  return request.Get<DashboardTrends>('/dashboard/trends', {
    params: { days },
    cacheFor: 0,
  })
}
