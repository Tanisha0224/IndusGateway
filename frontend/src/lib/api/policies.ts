import { api } from './client'
import type { BackendPolicy, PolicySimulationResult } from './types'

export function listPolicies(params?: { project?: string; enabled?: boolean }) {
  const query = new URLSearchParams()
  if (params?.project) query.set('project', params.project)
  if (params?.enabled !== undefined) query.set('enabled', String(params.enabled))
  return api.get<BackendPolicy[]>(`/api/policies${query.toString() ? `?${query}` : ''}`)
}

export type PolicyInput = {
  project_id?: string | null
  name: string
  description?: string | null
  priority?: number
  enabled?: boolean
  classification?: BackendPolicy['classification']
  default_action?: BackendPolicy['default_action']
  external_egress_allowed?: boolean
  mask_before_external_egress?: boolean
  allow_restoration?: boolean
  request_retention_mode?: 'metadata_only' | 'sanitized_content'
  response_scan_enabled?: boolean
  entity_rules?: Record<string, { action: BackendPolicy['default_action']; minimum_confidence: number }>
}

export function createPolicy(input: PolicyInput) {
  return api.post<BackendPolicy>('/api/policies', input)
}

export function updatePolicy(id: string, input: Partial<PolicyInput>) {
  return api.patch<BackendPolicy>(`/api/policies/${id}`, input)
}

export function enablePolicy(id: string) {
  return api.post<BackendPolicy>(`/api/policies/${id}/enable`, {})
}

export function disablePolicy(id: string) {
  return api.post<BackendPolicy>(`/api/policies/${id}/disable`, {})
}

export function simulatePolicy(input: { project_id: string; policy_id?: string; text: string }) {
  return api.post<PolicySimulationResult>('/api/policies/simulate', input)
}
