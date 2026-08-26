import { api } from './client'
import type { BackendRateLimitPolicy } from './types'

export function listRateLimits() {
  return api.get<BackendRateLimitPolicy[]>('/api/rate-limits')
}

export function createRateLimit(input: Omit<BackendRateLimitPolicy, 'id' | 'created_at' | 'updated_at'>) {
  return api.post<BackendRateLimitPolicy>('/api/rate-limits', input)
}

export function updateRateLimit(id: string, input: Partial<Pick<BackendRateLimitPolicy, 'name' | 'enabled' | 'requests_per_minute' | 'tokens_per_minute' | 'max_concurrent_requests'>>) {
  return api.patch<BackendRateLimitPolicy>(`/api/rate-limits/${id}`, input)
}

export function enableRateLimit(id: string) {
  return api.post<BackendRateLimitPolicy>(`/api/rate-limits/${id}/enable`, {})
}

export function disableRateLimit(id: string) {
  return api.post<BackendRateLimitPolicy>(`/api/rate-limits/${id}/disable`, {})
}
