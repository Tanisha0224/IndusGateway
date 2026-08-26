import { api } from './client'
import type { BackendAlert, BackendProvider, BackendProviderHealth, BackendProviderHealthEvent } from './types'

export interface ProviderInput {
  name: string
  provider_type: string
  base_url: string
  is_active: boolean
  supports_chat: boolean
  supports_streaming: boolean
  supports_embeddings: boolean
  models: string[]
  pricing_json: Record<string, unknown>
}

export function listProviders() {
  return api.get<BackendProvider[]>('/api/providers')
}

export function createProvider(input: ProviderInput) {
  return api.post<BackendProvider>('/api/providers', input)
}

export function updateProvider(id: string, input: Partial<Omit<ProviderInput, 'models'>>) {
  return api.patch<BackendProvider>(`/api/providers/${id}`, input)
}

export function disableProvider(id: string) {
  return api.delete<BackendProvider>(`/api/providers/${id}`)
}

export function listProviderModels(providerId: string) {
  return api.get<string[]>(`/api/providers/${providerId}/models`)
}

export function updateProviderModels(providerId: string, models: string[]) {
  return api.put<string[]>(`/api/providers/${providerId}/models`, { models })
}

export function setProviderCredential(providerId: string, apiKey: string) {
  return api.post<BackendProvider>(`/api/providers/${providerId}/credential`, { api_key: apiKey })
}

export function clearProviderCredential(providerId: string) {
  return api.delete<BackendProvider>(`/api/providers/${providerId}/credential`)
}

export function testProvider(providerId: string) {
  return api.post<BackendProviderHealth>(`/api/providers/${providerId}/test`, {})
}

export function listProviderHealth() {
  return api.get<BackendProviderHealth[]>('/api/provider-health')
}

export function listProviderHealthHistory() {
  return api.get<BackendProviderHealthEvent[]>('/api/provider-health/history')
}

export function checkProvider(providerId: string) {
  return api.post<BackendProviderHealth>(`/api/provider-health/${providerId}/check`, {})
}

export function resetProviderCircuit(providerId: string) {
  return api.post<BackendProviderHealth>(`/api/provider-health/${providerId}/reset`, {})
}

export function listAlerts() {
  return api.get<BackendAlert[]>('/api/alerts')
}

export function markAlertRead(id: string) {
  return api.post<BackendAlert>(`/api/alerts/${id}/read`, {})
}

export function markAllAlertsRead() {
  return api.post<{ updated: number }>('/api/alerts/read-all', {})
}
