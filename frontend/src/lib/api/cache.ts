import { api } from './client'
import type { BackendCacheEntriesResponse, BackendCacheEntry } from './types'

export function listCacheEntries(params: { project?: string; includeInactive?: boolean } = {}) {
  const query = new URLSearchParams()
  if (params.project) query.set('project', params.project)
  if (params.includeInactive) query.set('include_inactive', 'true')
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return api.get<BackendCacheEntriesResponse>(`/api/cache/entries${suffix}`)
}

export function invalidateCacheEntry(id: string) {
  return api.delete<BackendCacheEntry>(`/api/cache/entries/${id}`)
}

export function clearCache(project?: string) {
  const suffix = project ? `?${new URLSearchParams({ project }).toString()}` : ''
  return api.delete<{ invalidated: number }>(`/api/cache${suffix}`)
}
