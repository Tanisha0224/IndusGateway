import { api } from './client'
import type { BackendDashboardSummary } from './types'

export function getDashboardSummary(days = 30) {
  return api.get<BackendDashboardSummary>(`/api/dashboard/summary?days=${days}`)
}
