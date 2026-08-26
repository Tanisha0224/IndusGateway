import { api } from './client'
import type { AliasCapability, AliasStatus, BackendAliasTarget, BackendModelAlias, SovereigntyMode } from './types'

export type ModelAliasInput = {
  project_id: string
  alias: string
  display_name: string
  description?: string
  capability: AliasCapability
  status?: AliasStatus
  sovereignty_mode: SovereigntyMode
  fallback_enabled: boolean
}

export type AliasTargetInput = {
  provider_id: string
  provider_model_name: string
  priority: number
  enabled: boolean
  region: string
  is_india_hosted: boolean
  timeout_seconds: number
  max_retries: number
  fallback_eligible: boolean
}

function qs(params: Record<string, string>) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value)
  })
  const text = search.toString()
  return text ? `?${text}` : ''
}

export function listModelAliases(filters: Record<string, string> = {}) {
  return api.get<BackendModelAlias[]>(`/api/model-aliases${qs(filters)}`)
}

export function createModelAlias(input: ModelAliasInput) {
  return api.post<BackendModelAlias>('/api/model-aliases', input)
}

export function updateModelAlias(id: string, input: Partial<ModelAliasInput>) {
  return api.patch<BackendModelAlias>(`/api/model-aliases/${id}`, input)
}

export function enableModelAlias(id: string) {
  return api.post<BackendModelAlias>(`/api/model-aliases/${id}/enable`)
}

export function disableModelAlias(id: string) {
  return api.post<BackendModelAlias>(`/api/model-aliases/${id}/disable`)
}

export function listAliasTargets(aliasId: string) {
  return api.get<BackendAliasTarget[]>(`/api/model-aliases/${aliasId}/targets`)
}

export function createAliasTarget(aliasId: string, input: AliasTargetInput) {
  return api.post<BackendAliasTarget>(`/api/model-aliases/${aliasId}/targets`, input)
}

export function updateAliasTarget(aliasId: string, targetId: string, input: Partial<AliasTargetInput>) {
  return api.patch<BackendAliasTarget>(`/api/model-aliases/${aliasId}/targets/${targetId}`, input)
}

export function disableAliasTarget(aliasId: string, targetId: string) {
  return api.delete<BackendAliasTarget>(`/api/model-aliases/${aliasId}/targets/${targetId}`)
}

export function reorderAliasTargets(aliasId: string, target_ids: string[]) {
  return api.post<BackendAliasTarget[]>(`/api/model-aliases/${aliasId}/targets/reorder`, { target_ids })
}
