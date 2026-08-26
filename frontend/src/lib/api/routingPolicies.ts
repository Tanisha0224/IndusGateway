import { api } from './client'
import type { BackendRoutingPolicy, RoutingSimulationResult } from './types'

export type RoutingPolicyInput = {
  project_id?: string | null
  name: string
  description?: string
  priority: number
  enabled: boolean
  conditions: {
    requested_aliases?: string[]
    capabilities?: string[]
    virtual_key_ids?: string[]
    project_ids?: string[]
  }
  actions: {
    allowed_provider_ids?: string[]
    excluded_provider_ids?: string[]
    allowed_regions?: string[]
    require_india_hosting?: boolean
    external_egress_allowed?: boolean
    fallback_allowed?: boolean
    maximum_timeout_seconds?: number | null
    maximum_retries?: number | null
  }
}

export function listRoutingPolicies() {
  return api.get<BackendRoutingPolicy[]>('/api/routing-policies')
}

export function createRoutingPolicy(input: RoutingPolicyInput) {
  return api.post<BackendRoutingPolicy>('/api/routing-policies', input)
}

export function updateRoutingPolicy(id: string, input: Partial<RoutingPolicyInput>) {
  return api.patch<BackendRoutingPolicy>(`/api/routing-policies/${id}`, input)
}

export function enableRoutingPolicy(id: string) {
  return api.post<BackendRoutingPolicy>(`/api/routing-policies/${id}/enable`)
}

export function disableRoutingPolicy(id: string) {
  return api.post<BackendRoutingPolicy>(`/api/routing-policies/${id}/disable`)
}

export function simulateRouting(input: { virtual_key_id: string; alias: string; capability: 'chat' | 'embedding' }) {
  return api.post<RoutingSimulationResult>('/api/routing-policies/simulate', input)
}
