// ============================================================================
// IndusGate AI (IndusGate AI) — Core domain types
// These types double as the informal "data model proposal" for the backend
// team — see docs/API_CONTRACT.md and docs/DATA_MODEL.md for the full spec.
// ============================================================================

export type Role =
  | 'platform_admin'
  | 'org_admin'
  | 'department_manager'
  | 'developer'
  | 'auditor'
  | 'billing_viewer'
  | 'read_only_viewer'

export interface DemoUser {
  id: string
  name: string
  email: string
  role: Role
  title: string
  departmentId: string
  avatarInitials: string
  password: string // demo only — never do this in production
}

export interface Organisation {
  id: string
  name: string
  slug: string
}

export interface Department {
  id: string
  orgId: string
  name: string
  code: string
}

export interface Team {
  id: string
  departmentId: string
  name: string
}

export interface Project {
  id: string
  teamId: string
  departmentId: string
  name: string
  description: string
  createdAt: string
  monthlyBudgetUsd: number
  status: 'active' | 'paused' | 'archived'
}

export type SovereigntyStatus = 'sovereign' | 'india_hosted' | 'external'
export type EgressStatus = 'not_applicable' | 'allowed' | 'blocked' | 'masked'

export interface ProviderModel {
  id: string
  provider: string // e.g. "IndusGate AI", "OpenAI", "Anthropic", "Google"
  providerType: 'india_hosted' | 'external'
  modelName: string
  displayName: string
  hostingRegion: string
  sovereignty: SovereigntyStatus
  contextWindow: number
  capability: string[]
  costPer1kInputUsd: number
  costPer1kOutputUsd: number
  avgLatencyMs: number
  health: 'healthy' | 'degraded' | 'unavailable'
  availabilityPct: number
  allowedUseCases: string[]
  externalEgress: EgressStatus
  position: 'default' | 'backup'
  circuitBreaker: 'closed' | 'half_open' | 'open'
  lastCheckedAt: string
}

export interface ModelAlias {
  id: string
  name: string // e.g. "indusgate-general"
  description: string
  primaryModelId: string
  fallbackModelIds: string[]
  sensitiveDataOnly: boolean
  createdAt: string
}

export type RoutingStrategy =
  | 'sovereign_first'
  | 'indusgate_only'
  | 'external_allowed'
  | 'external_blocked'
  | 'cost_first'
  | 'latency_first'
  | 'quality_first'

export interface RoutingPolicy {
  id: string
  name: string
  description: string
  plainLanguage: string
  strategy: RoutingStrategy
  appliesToDepartmentId?: string
  appliesToProjectId?: string
  taskTypes: string[]
  sensitiveDataRouting: 'indusgate_only' | 'no_restriction'
  maxLatencyMs?: number
  maxCostPerRequestUsd?: number
  excludedProviders: string[]
  fallbackChain: string[] // model alias ids or model ids, in order
  businessHoursOnly: boolean
  environment: 'all' | 'test' | 'live'
  enabled: boolean
  priority: number
  createdAt: string
  updatedAt: string
}

export interface BudgetPolicy {
  id: string
  scope: 'organisation' | 'department' | 'project' | 'virtual_key'
  scopeId: string
  scopeName: string
  monthlyLimitUsd: number
  currentSpendUsd: number
  softWarningPct: number
  hardStopPct: number
  status: 'ok' | 'warning' | 'exceeded'
}

export interface RateLimitPolicy {
  id: string
  scope: 'organisation' | 'project' | 'virtual_key'
  scopeId: string
  scopeName: string
  requestsPerMinute: number
  tokensPerMinute: number
  dailyRequestCap: number
  burstAllowance: number
  offHoursThrottlePct: number
}

export type KeyEnvironment = 'test' | 'live'
export type KeyStatus = 'active' | 'expiring' | 'expired' | 'revoked'

export interface VirtualKey {
  id: string
  name: string
  environment: KeyEnvironment
  prefix: string // e.g. ig_sk_live_....4f92 (masked)
  fullKeyOnce?: string // only present transiently at creation time, never persisted after modal close
  orgId: string
  departmentId: string
  teamId: string
  projectId: string
  boundUserId?: string
  allowedAliasIds: string[]
  budgetLimitUsd: number
  rateLimitRpm: number
  ipRestrictions: string[]
  createdAt: string
  createdBy: string
  expiresAt: string | null
  lastUsedAt: string | null
  status: KeyStatus
  riskFlags: string[]
}

export interface KeyActivityEvent {
  id: string
  keyId: string
  timestamp: string
  action: 'created' | 'rotated' | 'revoked' | 'used' | 'expired' | 'blocked_attempt'
  detail: string
}

export type PiiCategory =
  | 'person_name' | 'email' | 'phone' | 'aadhaar_like' | 'pan_like'
  | 'bank_account' | 'address' | 'employee_id'

export interface PiiDetection {
  category: PiiCategory
  originalValue: string
  maskedValue: string
  placeholder: string
}

export type TraceStageName =
  | 'key_validated' | 'org_project_identified' | 'rate_limit_check' | 'budget_check'
  | 'pii_scan' | 'prompt_masking' | 'policy_evaluated' | 'provider_health_checked'
  | 'model_selected' | 'request_forwarded' | 'response_received' | 'response_filtered'
  | 'usage_recorded' | 'audit_written'

export interface TraceStage {
  name: TraceStageName
  label: string
  status: 'completed' | 'warning' | 'failed' | 'skipped'
  durationMs: number
  decision: string
  metadata?: Record<string, string | number | boolean>
}

export type RequestOutcome = 'success' | 'blocked_budget' | 'blocked_rate_limit' | 'blocked_auth' | 'blocked_policy' | 'failed_provider'

export interface RequestTrace {
  id: string
  traceId: string
  timestamp: string
  virtualKeyId: string
  virtualKeyName: string
  projectId: string
  projectName: string
  departmentId: string
  modelAliasId: string
  modelAliasName: string
  selectedModelId: string
  selectedProvider: string
  selectedModel: string
  routingPolicyId: string
  routingPolicyName: string
  routingExplanation: string
  sovereignty: SovereigntyStatus
  egress: EgressStatus
  fallbackUsed: boolean
  fallbackReason?: string
  piiDetected: PiiDetection[]
  promptTokens: number
  completionTokens: number
  totalTokens: number
  latencyMs: number
  estimatedCostUsd: number
  cacheStatus: 'hit' | 'miss' | 'not_applicable'
  outcome: RequestOutcome
  stages: TraceStage[]
  userPromptPreview: string
  responsePreview: string
}

export interface AuditEvent {
  id: string
  timestamp: string
  traceId?: string
  actor: string
  actorRole: Role
  orgId: string
  projectId?: string
  action: string
  resource: string
  result: 'success' | 'denied' | 'failed'
  ipAddress: string
  policyDecision?: string
  previousValue?: string
  newValue?: string
  integrityHash: string
  tamperEvident: boolean
}

export interface ProviderIncident {
  id: string
  providerModelId: string
  providerName: string
  startedAt: string
  resolvedAt: string | null
  severity: 'minor' | 'major' | 'critical'
  description: string
  failoverTriggered: boolean
  failoverTargetModelId?: string
}

export interface CacheEntry {
  id: string
  projectId: string
  promptPreview: string
  similarityScore: number
  hits: number
  ttlMinutes: number
  createdAt: string
  tokensSaved: number
  costSavedUsd: number
}

export type AlertSeverity = 'info' | 'warning' | 'critical'
export type AlertType =
  | 'budget_80' | 'key_expiring' | 'provider_degraded' | 'egress_blocked'
  | 'pii_detected' | 'rate_limit_exceeded' | 'token_spike' | 'failover_triggered'
  | 'invalid_key_attempts' | 'cache_hit_drop'

export interface AlertItem {
  id: string
  type: AlertType
  severity: AlertSeverity
  title: string
  description: string
  timestamp: string
  read: boolean
  relatedTraceId?: string
  relatedProjectId?: string
}

export interface UsageDaily {
  date: string
  requests: number
  tokens: number
  costUsd: number
  cacheHitRate: number
  errorRate: number
  avgLatencyMs: number
  sovereignPct: number
}
