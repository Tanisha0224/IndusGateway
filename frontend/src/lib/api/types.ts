// Types mirroring the real FastAPI backend response shapes (backend/app/schemas.py).
// Kept separate from ../../types/index.ts, which models the richer mocked/seeded
// domains (budgets, cache, org, routing, health, playground) not yet backed by
// the real gateway.

export type BackendRole = 'admin' | 'member'
export type BackendAppRole = 'platform_admin' | 'org_admin' | 'department_manager' | 'developer' | 'auditor' | 'billing_viewer' | 'read_only_viewer'
export type BackendUserStatus = 'active' | 'disabled'

export interface BackendUser {
  id: string
  email: string
  name: string
  role: BackendRole
  app_role?: BackendAppRole
  status: BackendUserStatus
  department_id?: string | null
  team_id?: string | null
  project_ids?: string[]
  created_at: string
}

export type PolicyClassification = 'public' | 'internal' | 'confidential' | 'restricted' | 'regulated'
export type PolicyAction = 'allow' | 'mask_and_allow' | 'block'

export interface BackendPolicy {
  id: string
  project_id?: string | null
  name: string
  description?: string | null
  priority?: number
  enabled?: boolean
  classification: PolicyClassification
  default_action: PolicyAction
  allow_external: boolean
  external_egress_allowed?: boolean
  mask_before_egress: boolean
  mask_before_external_egress?: boolean
  block_regulated_fields: boolean
  allow_restoration: boolean
  request_retention_mode?: 'metadata_only' | 'sanitized_content'
  response_scan_enabled?: boolean
  entity_rules?: Record<string, { action: PolicyAction; minimum_confidence: number }>
  created_by?: string
  created_at: string
  updated_at?: string
}

export type BackendProjectStatus = 'active' | 'archived'

export interface BackendProject {
  id: string
  name: string
  description: string | null
  owner_user_id: string
  policy_id: string
  status: BackendProjectStatus
  monthly_budget_inr: number | null
  created_at: string
}

export interface BackendProvider {
  id: string
  name: string
  provider_type: string
  base_url: string
  is_active: boolean
  supports_chat: boolean
  supports_streaming: boolean
  supports_embeddings: boolean
  credential_configured?: boolean
  credential_source?: 'environment' | 'encrypted_store' | 'missing'
  credential_last_updated_at?: string | null
  credential_hash_prefix?: string | null
  models?: string[]
  pricing_json?: Record<string, unknown>
  created_at: string
}

export type ProviderHealthStatus = 'unknown' | 'healthy' | 'degraded' | 'unhealthy'
export type ProviderCircuitState = 'closed' | 'open' | 'half_open'

export interface BackendProviderHealth {
  provider_id: string
  provider_name: string
  provider_type: string | null
  base_url: string | null
  status: ProviderHealthStatus
  circuit_state: ProviderCircuitState
  consecutive_successes: number
  consecutive_failures: number
  last_checked_at: string | null
  last_success_at: string | null
  last_failure_at: string | null
  last_latency_ms: number | null
  last_error: string | null
  opened_at: string | null
  half_opened_at: string | null
  updated_at: string
}

export interface BackendProviderHealthEvent {
  id: string
  provider_id: string
  provider_name: string
  source: string
  result: string
  status: ProviderHealthStatus
  circuit_state: ProviderCircuitState
  previous_status: ProviderHealthStatus | null
  previous_circuit_state: ProviderCircuitState | null
  latency_ms: number | null
  error: string | null
  created_at: string
}

export interface BackendAlert {
  id: string
  type: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  description: string
  provider_id?: string | null
  provider_name?: string | null
  read: boolean
  resolved_at: string | null
  created_at: string
}

export type BackendVirtualKeyStatus = 'active' | 'revoked'

export interface BackendVirtualKey {
  id: string
  key_prefix: string
  project_id: string
  created_by_user_id: string
  status: BackendVirtualKeyStatus
  expires_at: string | null
  allowed_provider_ids: string[]
  allowed_model_aliases: string[]
  created_at: string
}

export interface BackendVirtualKeyCreateResponse {
  virtual_key: BackendVirtualKey
  full_key: string
}

export type GatewayRequestStatus = 'started' | 'completed' | 'blocked' | 'budget_blocked' | 'failed' | 'error'

export interface BackendGatewayRequest {
  id: string
  virtual_key_id: string
  project_id: string
  provider_id: string | null
  model_requested: string
  model_routed: string | null
  policy_id: string
  policy_action: PolicyAction
  request_status: GatewayRequestStatus
  detected_pii_types: string[]
  masked_fields_count: number
  sanitized_prompt: string | null
  provider_response_status: number | null
  error_category?: string | null
  prompt_tokens: number | null
  completion_tokens: number | null
  total_tokens: number | null
  estimated_cost_inr: number | null
  estimated_cost_reserved_inr?: number | null
  latency_ms?: number | null
  created_at: string
  completed_at: string | null
  requested_public_alias?: string
  selected_alias_id?: string
  selected_target_id?: string
  selected_provider_id?: string
  selected_provider_model?: string
  matched_routing_policy_ids?: string[]
  sovereignty_mode?: 'india_only' | 'protected_external' | 'unrestricted'
  external_egress_allowed?: boolean
  routing_reason?: string
  attempt_count?: number
  fallback_used?: boolean
  attempted_targets?: Array<Record<string, unknown>>
  provider_failure_categories?: string[]
  pii_detected?: boolean
  pii_types?: string[]
  pii_entity_count?: number
  privacy_policy_ids?: string[]
  privacy_action?: PolicyAction
  masking_applied?: boolean
  masked_entity_count?: number
  response_scan_performed?: boolean
  response_pii_types?: string[]
  response_masked_entity_count?: number
  restoration_applied?: boolean
  restored_entity_count?: number
  detector_version?: string
  privacy_processing_ms?: number
  stream_requested?: boolean
  stream_mode?: string | null
  provider_stream_started?: boolean
  provider_chunk_count?: number
  buffered_character_count?: number
  stream_buffer_limit?: number
  response_pii_detected?: boolean
  response_pii_entity_count?: number
  response_privacy_action?: string
  response_masking_applied?: boolean
  client_disconnected?: boolean
  stream_completed?: boolean
  stream_error_code?: string | null
  cache_status?: 'pending' | 'hit' | 'miss' | 'bypass_stream' | 'bypass_blocked' | 'bypass_sensitive'
  cache_entry_id?: string | null
  cache_similarity?: number | null
  cache_saved_provider_call?: boolean
  governance_enforced?: boolean
  governance_reservation_id?: string | null
  estimated_tokens_reserved?: number
  budget_settled?: boolean
}

export interface BackendCacheEntry {
  id: string
  project_id: string
  alias: string
  prompt_hash: string
  prompt_preview: string
  usage: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
  provider_id: string
  provider_model: string
  estimated_cost_inr: number
  hits: number
  tokens_saved: number
  cost_saved_inr: number
  last_similarity: number
  ttl_minutes: number
  active: boolean
  token_count: number
  created_at: string
  last_hit_at: string | null
  expires_at: string | null
  invalidated_at?: string | null
}

export interface BackendCacheSummary {
  active_entries: number
  hits: number
  misses: number
  hit_rate: number
  tokens_saved: number
  cost_saved_inr: number
}

export interface BackendCacheEntriesResponse {
  entries: BackendCacheEntry[]
  summary: BackendCacheSummary
}

export interface PolicySimulationResult {
  decision: PolicyAction
  entities: Array<{ type: string; confidence: number; action: PolicyAction; placeholder: string | null }>
  masked_preview: string
  external_egress_allowed: boolean
  policy_ids: string[]
}

export type BudgetStatus = 'ok' | 'warning' | 'exceeded' | 'unlimited'

export interface BackendUsageSummaryRow {
  project_id: string
  project_name: string
  monthly_budget_inr: number | null
  spend_this_month_inr: number
  total_tokens_this_month: number
  request_count_this_month: number
  budget_status: BudgetStatus
}

export interface BackendDashboardSummary {
  window_days: number
  kpis: {
    total_requests: number
    total_tokens: number
    estimated_spend_inr: number
    avg_latency_ms: number
    error_rate: number
    sovereign_rate: number
    pii_values_masked: number
    active_virtual_keys: number
    total_virtual_keys: number
    open_provider_incidents: number
    healthy_providers: number
    total_providers: number
    cache_hits: number
    cache_misses: number
    cache_hit_rate: number
    active_cache_entries: number
    cache_tokens_saved: number
    cache_cost_saved_inr: number
  }
  usage_summary: Array<{
    project_id: string
    project_name: string
    monthly_budget_inr: number | null
    spend_this_month_inr: number
    total_tokens_this_month: number
    request_count_this_month: number
  }>
  trend: Array<{ date: string; requests: number; tokens: number; spend_inr: number }>
  sovereign_vs_external: Array<{ name: string; value: number }>
  spend_by_provider: Array<{ name: string; value: number }>
  usage_by_model: Array<{ name: string; value: number }>
  recent_alerts: BackendAlert[]
  recent_activity: BackendAuditLog[]
}

export interface BackendRateLimitPolicy {
  id: string
  scope: 'virtual_key' | 'project' | 'model_alias'
  scope_id: string
  name: string
  enabled: boolean
  requests_per_minute: number
  tokens_per_minute: number
  max_concurrent_requests: number
  created_at: string
  updated_at: string
}

export type AuditActorType = 'user' | 'virtual_key' | 'system'

export interface BackendAuditLog {
  id: string
  actor_type: AuditActorType
  actor_id: string | null
  action: string
  resource_type: string
  resource_id: string | null
  metadata_json: Record<string, unknown> | null
  created_at: string
}

export type AliasCapability = 'chat' | 'embedding'
export type AliasStatus = 'active' | 'disabled'
export type SovereigntyMode = 'india_only' | 'protected_external' | 'unrestricted'

export interface BackendModelAlias {
  id: string
  project_id: string
  alias: string
  display_name: string
  description: string | null
  capability: AliasCapability
  status: AliasStatus
  sovereignty_mode: SovereigntyMode
  fallback_enabled: boolean
  created_by: string
  created_at: string
  updated_at: string
  target_count?: number
}

export interface BackendAliasTarget {
  id: string
  model_alias_id: string
  provider_id: string
  provider_model_name: string
  priority: number
  enabled: boolean
  region: string
  is_india_hosted: boolean
  timeout_seconds: number
  max_retries: number
  fallback_eligible: boolean
  created_at: string
  updated_at: string
}

export interface BackendRoutingPolicy {
  id: string
  project_id: string | null
  name: string
  description: string | null
  priority: number
  enabled: boolean
  conditions_json: {
    requested_aliases?: string[]
    capabilities?: string[]
    virtual_key_ids?: string[]
    project_ids?: string[]
  }
  actions_json: {
    allowed_provider_ids?: string[]
    excluded_provider_ids?: string[]
    allowed_regions?: string[]
    require_india_hosting?: boolean
    external_egress_allowed?: boolean
    fallback_allowed?: boolean
    maximum_timeout_seconds?: number
    maximum_retries?: number
  }
  created_by: string
  created_at: string
  updated_at: string
}

export interface RoutingSimulationResult {
  matched_policies: Array<{ id: string; name: string; priority: number }>
  effective_restrictions: Record<string, unknown>
  eligible_targets: Array<Record<string, unknown>>
  excluded_targets: Array<Record<string, unknown>>
}
