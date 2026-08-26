import { api } from './client'
import type { BackendVirtualKey, BackendVirtualKeyCreateResponse } from './types'

export function listVirtualKeys() {
  return api.get<BackendVirtualKey[]>('/api/virtual-keys')
}

export function createVirtualKey(input: {
  project_id: string
  allowed_provider_ids: string[]
  allowed_model_aliases: string[]
  expires_at: string | null
}) {
  return api.post<BackendVirtualKeyCreateResponse>('/api/virtual-keys', input)
}

export function rotateVirtualKey(id: string) {
  return api.post<BackendVirtualKeyCreateResponse>(`/api/virtual-keys/${id}/rotate`)
}

export function revokeVirtualKey(id: string) {
  return api.post<BackendVirtualKey>(`/api/virtual-keys/${id}/revoke`)
}
