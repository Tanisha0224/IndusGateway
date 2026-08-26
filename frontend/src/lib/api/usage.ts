import { api } from './client'
import type { BackendUsageSummaryRow } from './types'

export function getUsageSummary() {
  return api.get<BackendUsageSummaryRow[]>('/api/usage/summary')
}
