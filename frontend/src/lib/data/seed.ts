import { v4 as uuid } from 'uuid'
import { addDays, subDays, subMinutes, subHours, format } from 'date-fns'
import type {
  DemoUser, Organisation, Department, Team, Project, ProviderModel, ModelAlias,
  RoutingPolicy, BudgetPolicy, RateLimitPolicy, VirtualKey, KeyActivityEvent,
  RequestTrace, AuditEvent, ProviderIncident, CacheEntry, AlertItem, UsageDaily,
  TraceStage, PiiDetection,
} from '../../types'

// ---------------------------------------------------------------------------
// Deterministic pseudo-random so demo data feels the same across a session
// ---------------------------------------------------------------------------
let seedCounter = 42
function rand() {
  seedCounter = (seedCounter * 9301 + 49297) % 233280
  return seedCounter / 233280
}
function randInt(min: number, max: number) { return Math.floor(rand() * (max - min + 1)) + min }
function pick<T>(arr: T[]): T { return arr[randInt(0, arr.length - 1)] }
function round2(n: number) { return Math.round(n * 100) / 100 }

// ---------------------------------------------------------------------------
// Organisation hierarchy
// ---------------------------------------------------------------------------
export const organisation: Organisation = {
  id: 'org-indusgate',
  name: 'IndusGate AI Demo Organisation',
  slug: 'indusgate',
}

export const departments: Department[] = [
  { id: 'dept-idx', orgId: organisation.id, name: 'IDX', code: 'IDX' },
  { id: 'dept-cloudops', orgId: organisation.id, name: 'Cloud Operations', code: 'CLOPS' },
  { id: 'dept-finance', orgId: organisation.id, name: 'Finance', code: 'FIN' },
  { id: 'dept-hr', orgId: organisation.id, name: 'Human Resources', code: 'HR' },
  { id: 'dept-infosec', orgId: organisation.id, name: 'Information Security', code: 'ISEC' },
]

export const teams: Team[] = [
  { id: 'team-aiplatform', departmentId: 'dept-idx', name: 'AI Platform Team' },
  { id: 'team-compliance', departmentId: 'dept-infosec', name: 'Compliance Automation Team' },
  { id: 'team-cloudsupport', departmentId: 'dept-cloudops', name: 'Cloud Support Team' },
]

export const projects: Project[] = [
  { id: 'proj-compliance', teamId: 'team-compliance', departmentId: 'dept-infosec', name: 'Compliance Portal', description: 'Automated regulatory compliance drafting and review assistant.', createdAt: '2026-05-12T09:00:00Z', monthlyBudgetUsd: 4000, status: 'active' },
  { id: 'proj-knowledge', teamId: 'team-aiplatform', departmentId: 'dept-idx', name: 'Internal Knowledge Assistant', description: 'Employee-facing assistant over internal documentation.', createdAt: '2026-03-02T09:00:00Z', monthlyBudgetUsd: 6000, status: 'active' },
  { id: 'proj-support', teamId: 'team-cloudsupport', departmentId: 'dept-cloudops', name: 'Customer Support Copilot', description: 'Agent-assist for cloud support ticket triage and drafting.', createdAt: '2026-01-20T09:00:00Z', monthlyBudgetUsd: 9000, status: 'active' },
  { id: 'proj-docintel', teamId: 'team-aiplatform', departmentId: 'dept-idx', name: 'Document Intelligence', description: 'Summarisation and extraction over customer-uploaded documents.', createdAt: '2026-02-14T09:00:00Z', monthlyBudgetUsd: 5000, status: 'active' },
  { id: 'proj-devassist', teamId: 'team-aiplatform', departmentId: 'dept-idx', name: 'Developer Assistant', description: 'Code generation and review assistant for internal engineering teams.', createdAt: '2026-04-01T09:00:00Z', monthlyBudgetUsd: 3000, status: 'active' },
]

// ---------------------------------------------------------------------------
// Demo users (7 roles)
// ---------------------------------------------------------------------------
export const demoUsers: DemoUser[] = [
  { id: 'user-admin', name: 'Rohan Deshmukh', email: 'platform.admin@indusgate.example', role: 'platform_admin', title: 'Platform Admin', departmentId: 'dept-idx', avatarInitials: 'RD', password: 'demo123' },
  { id: 'user-orgadmin', name: 'Anjali Kulkarni', email: 'org.admin@indusgate.example', role: 'org_admin', title: 'Organisation Admin', departmentId: 'dept-idx', avatarInitials: 'AK', password: 'demo123' },
  { id: 'user-manager', name: 'Vikram Salunkhe', email: 'dept.manager@indusgate.example', role: 'department_manager', title: 'Department Manager, Information Security', departmentId: 'dept-infosec', avatarInitials: 'VS', password: 'demo123' },
  { id: 'user-dev', name: 'Priya Nair', email: 'developer@indusgate.example', role: 'developer', title: 'Developer, AI Platform Team', departmentId: 'dept-idx', avatarInitials: 'PN', password: 'demo123' },
  { id: 'user-auditor', name: 'Suresh Iyer', email: 'auditor@indusgate.example', role: 'auditor', title: 'Compliance Auditor', departmentId: 'dept-infosec', avatarInitials: 'SI', password: 'demo123' },
  { id: 'user-billing', name: 'Meera Joshi', email: 'billing.viewer@indusgate.example', role: 'billing_viewer', title: 'Billing Viewer, Finance', departmentId: 'dept-finance', avatarInitials: 'MJ', password: 'demo123' },
  { id: 'user-viewer', name: 'Arjun Bhat', email: 'viewer@indusgate.example', role: 'read_only_viewer', title: 'Read-only Viewer', departmentId: 'dept-hr', avatarInitials: 'AB', password: 'demo123' },
]

export const roleLabels: Record<string, string> = {
  platform_admin: 'Platform Admin',
  org_admin: 'Organisation Admin',
  department_manager: 'Department Manager',
  developer: 'Developer',
  auditor: 'Auditor',
  billing_viewer: 'Billing Viewer',
  read_only_viewer: 'Read-only Viewer',
}

// Permission matrix — used by the RBAC guard
export const rolePermissions: Record<string, string[]> = {
  platform_admin: ['*'],
  org_admin: ['dashboard', 'keys', 'providers', 'aliases', 'policies', 'routing', 'budgets', 'playground', 'traces', 'audit', 'health', 'cache', 'billing', 'org', 'alerts', 'docs'],
  department_manager: ['dashboard', 'keys', 'providers', 'aliases', 'policies', 'routing', 'budgets', 'playground', 'traces', 'health', 'cache', 'billing', 'alerts', 'docs'],
  developer: ['dashboard', 'keys', 'providers', 'aliases', 'policies', 'playground', 'traces', 'health', 'cache', 'alerts', 'docs'],
  auditor: ['dashboard', 'traces', 'audit', 'health', 'billing', 'alerts', 'providers', 'docs'],
  billing_viewer: ['dashboard', 'billing', 'alerts', 'docs'],
  read_only_viewer: ['dashboard', 'providers', 'aliases', 'policies', 'routing', 'health', 'billing', 'alerts', 'docs'],
}

// ---------------------------------------------------------------------------
// Providers & Models
// ---------------------------------------------------------------------------
export const providerModels: ProviderModel[] = [
  {
    id: 'model-india-llama', provider: 'IndusGate AI', providerType: 'india_hosted', modelName: 'llama-3-70b-india',
    displayName: 'India-hosted Llama 3 70B', hostingRegion: 'Nashik, India (India-hosted private AI DC)', sovereignty: 'sovereign',
    contextWindow: 128000, capability: ['general', 'summarisation', 'chat'], costPer1kInputUsd: 0.09, costPer1kOutputUsd: 0.18,
    avgLatencyMs: 620, health: 'healthy', availabilityPct: 99.95, allowedUseCases: ['general', 'sensitive', 'internal'],
    externalEgress: 'not_applicable', position: 'default', circuitBreaker: 'closed', lastCheckedAt: new Date().toISOString(),
  },
  {
    id: 'model-india-qwen', provider: 'IndusGate AI', providerType: 'india_hosted', modelName: 'qwen2.5-32b-india',
    displayName: 'India-hosted Qwen 2.5 32B', hostingRegion: 'Nashik, India (India-hosted private AI DC)', sovereignty: 'sovereign',
    contextWindow: 32000, capability: ['code', 'fast-response'], costPer1kInputUsd: 0.05, costPer1kOutputUsd: 0.10,
    avgLatencyMs: 340, health: 'healthy', availabilityPct: 99.98, allowedUseCases: ['code', 'fast', 'internal'],
    externalEgress: 'not_applicable', position: 'default', circuitBreaker: 'closed', lastCheckedAt: new Date().toISOString(),
  },
  {
    id: 'model-india-mistral', provider: 'IndusGate AI', providerType: 'india_hosted', modelName: 'mistral-large-india',
    displayName: 'India-hosted Mistral Large', hostingRegion: 'Mumbai, India (India-hosted private AI DC)', sovereignty: 'sovereign',
    contextWindow: 64000, capability: ['document', 'extraction', 'summarisation'], costPer1kInputUsd: 0.07, costPer1kOutputUsd: 0.14,
    avgLatencyMs: 510, health: 'degraded', availabilityPct: 98.60, allowedUseCases: ['document', 'sensitive', 'internal'],
    externalEgress: 'not_applicable', position: 'backup', circuitBreaker: 'half_open', lastCheckedAt: new Date().toISOString(),
  },
  {
    id: 'model-openai-gpt4o', provider: 'OpenAI', providerType: 'external', modelName: 'gpt-4o',
    displayName: 'OpenAI GPT-4o', hostingRegion: 'United States (OpenAI infrastructure)', sovereignty: 'external',
    contextWindow: 128000, capability: ['general', 'reasoning', 'multimodal'], costPer1kInputUsd: 0.50, costPer1kOutputUsd: 1.50,
    avgLatencyMs: 780, health: 'healthy', availabilityPct: 99.90, allowedUseCases: ['general', 'premium'],
    externalEgress: 'allowed', position: 'backup', circuitBreaker: 'closed', lastCheckedAt: new Date().toISOString(),
  },
  {
    id: 'model-anthropic-sonnet', provider: 'Anthropic', providerType: 'external', modelName: 'claude-sonnet',
    displayName: 'Anthropic Claude Sonnet', hostingRegion: 'United States (Anthropic infrastructure)', sovereignty: 'external',
    contextWindow: 200000, capability: ['reasoning', 'code', 'long-context'], costPer1kInputUsd: 0.45, costPer1kOutputUsd: 1.35,
    avgLatencyMs: 690, health: 'healthy', availabilityPct: 99.93, allowedUseCases: ['premium', 'code'],
    externalEgress: 'allowed', position: 'backup', circuitBreaker: 'closed', lastCheckedAt: new Date().toISOString(),
  },
  {
    id: 'model-google-gemini', provider: 'Google', providerType: 'external', modelName: 'gemini-1.5-pro',
    displayName: 'Google Gemini 1.5 Pro', hostingRegion: 'United States / EU (Google infrastructure)', sovereignty: 'external',
    contextWindow: 1000000, capability: ['multimodal', 'long-context'], costPer1kInputUsd: 0.35, costPer1kOutputUsd: 1.05,
    avgLatencyMs: 640, health: 'unavailable', availabilityPct: 97.10, allowedUseCases: ['multimodal'],
    externalEgress: 'blocked', position: 'backup', circuitBreaker: 'open', lastCheckedAt: new Date().toISOString(),
  },
]

// ---------------------------------------------------------------------------
// Model Aliases
// ---------------------------------------------------------------------------
export const modelAliases: ModelAlias[] = [
  { id: 'alias-general', name: 'indusgate-general', description: 'Default general-purpose alias for chat and summarisation workloads.', primaryModelId: 'model-india-llama', fallbackModelIds: ['model-openai-gpt4o'], sensitiveDataOnly: false, createdAt: '2026-01-10T08:00:00Z' },
  { id: 'alias-fast', name: 'indusgate-fast', description: 'Low-latency alias for high-throughput, short-response workloads.', primaryModelId: 'model-india-qwen', fallbackModelIds: ['model-india-llama'], sensitiveDataOnly: false, createdAt: '2026-01-10T08:05:00Z' },
  { id: 'alias-code', name: 'indusgate-code', description: 'Code generation and review alias.', primaryModelId: 'model-india-qwen', fallbackModelIds: ['model-anthropic-sonnet'], sensitiveDataOnly: false, createdAt: '2026-01-12T08:00:00Z' },
  { id: 'alias-document', name: 'indusgate-document', description: 'Document extraction and summarisation alias.', primaryModelId: 'model-india-mistral', fallbackModelIds: ['model-india-llama', 'model-google-gemini'], sensitiveDataOnly: false, createdAt: '2026-01-15T08:00:00Z' },
  { id: 'alias-sensitive', name: 'indusgate-sensitive', description: 'Sovereign-only alias for requests classified as containing sensitive data. External egress is never permitted for this alias.', primaryModelId: 'model-india-llama', fallbackModelIds: ['model-india-mistral'], sensitiveDataOnly: true, createdAt: '2026-02-01T08:00:00Z' },
  { id: 'alias-premium', name: 'indusgate-premium', description: 'Highest-quality alias, permitted to use external frontier models when policy allows.', primaryModelId: 'model-anthropic-sonnet', fallbackModelIds: ['model-openai-gpt4o', 'model-india-llama'], sensitiveDataOnly: false, createdAt: '2026-02-10T08:00:00Z' },
]

// ---------------------------------------------------------------------------
// Routing Policies
// ---------------------------------------------------------------------------
export const routingPolicies: RoutingPolicy[] = [
  {
    id: 'policy-sensitive', name: 'Sensitive Data — Sovereign Only', description: 'Applies to any request where PII or sensitive-data classification is triggered.',
    plainLanguage: 'When the request contains sensitive data, route only to India-hosted models. External providers are never used for these requests, regardless of cost or latency preference.',
    strategy: 'indusgate_only', taskTypes: ['sensitive'], sensitiveDataRouting: 'indusgate_only', excludedProviders: ['OpenAI', 'Anthropic', 'Google'],
    fallbackChain: ['model-india-llama', 'model-india-mistral'], businessHoursOnly: false, environment: 'all', enabled: true, priority: 1,
    createdAt: '2026-02-01T08:00:00Z', updatedAt: '2026-06-15T10:00:00Z',
  },
  {
    id: 'policy-costfirst', name: 'Non-sensitive — Cost-First', description: 'Default policy for general, non-sensitive workloads once sovereignty checks pass.',
    plainLanguage: 'When no sensitive data is detected and external access is permitted for the project, use the lowest-cost healthy provider. If the primary model fails, use the configured fallback chain.',
    strategy: 'cost_first', taskTypes: ['general', 'summarisation'], sensitiveDataRouting: 'no_restriction', excludedProviders: [],
    fallbackChain: ['model-india-llama', 'model-openai-gpt4o'], businessHoursOnly: false, environment: 'all', enabled: true, priority: 2,
    createdAt: '2026-01-20T08:00:00Z', updatedAt: '2026-05-01T10:00:00Z',
  },
  {
    id: 'policy-compliance-sovereign', name: 'Compliance Portal — Sovereign First', description: 'Project-specific policy for the Compliance Portal project.',
    plainLanguage: 'All requests from the Compliance Portal project prefer India-hosted models first. External providers are used only as a last-resort fallback and only outside business hours restrictions.',
    strategy: 'sovereign_first', appliesToProjectId: 'proj-compliance', taskTypes: ['general', 'document'], sensitiveDataRouting: 'indusgate_only',
    maxLatencyMs: 3000, excludedProviders: ['Google'], fallbackChain: ['model-india-llama', 'model-india-mistral', 'model-anthropic-sonnet'],
    businessHoursOnly: false, environment: 'all', enabled: true, priority: 1,
    createdAt: '2026-05-12T09:00:00Z', updatedAt: '2026-07-01T09:00:00Z',
  },
  {
    id: 'policy-devassist-quality', name: 'Developer Assistant — Quality-First', description: 'Code generation quality prioritised over cost for the Developer Assistant project.',
    plainLanguage: 'For code-generation tasks, use the highest-quality healthy model regardless of cost, provided the per-request cost stays under the configured ceiling.',
    strategy: 'quality_first', appliesToProjectId: 'proj-devassist', taskTypes: ['code'], sensitiveDataRouting: 'no_restriction',
    maxCostPerRequestUsd: 0.50, excludedProviders: [], fallbackChain: ['model-anthropic-sonnet', 'model-india-qwen'],
    businessHoursOnly: false, environment: 'all', enabled: true, priority: 3,
    createdAt: '2026-04-05T09:00:00Z', updatedAt: '2026-04-05T09:00:00Z',
  },
  {
    id: 'policy-external-blocked-hr', name: 'HR — External Blocked', description: 'Human Resources department is restricted to India-hosted models at all times.',
    plainLanguage: 'Requests originating from the Human Resources department are never routed to external providers, independent of task type or cost.',
    strategy: 'external_blocked', appliesToDepartmentId: 'dept-hr', taskTypes: ['general'], sensitiveDataRouting: 'indusgate_only',
    excludedProviders: ['OpenAI', 'Anthropic', 'Google'], fallbackChain: ['model-india-llama'], businessHoursOnly: false, environment: 'all',
    enabled: true, priority: 1, createdAt: '2026-02-20T09:00:00Z', updatedAt: '2026-02-20T09:00:00Z',
  },
  {
    id: 'policy-latency-support', name: 'Customer Support — Latency-First', description: 'Support Copilot prioritises response speed for agent-assist scenarios.',
    plainLanguage: 'For the Customer Support Copilot project, prefer the lowest-latency healthy model. Fall back automatically if the primary model exceeds the configured latency ceiling.',
    strategy: 'latency_first', appliesToProjectId: 'proj-support', taskTypes: ['fast'], sensitiveDataRouting: 'no_restriction',
    maxLatencyMs: 800, excludedProviders: [], fallbackChain: ['model-india-qwen', 'model-india-llama'], businessHoursOnly: true, environment: 'live',
    enabled: true, priority: 2, createdAt: '2026-01-25T09:00:00Z', updatedAt: '2026-06-10T09:00:00Z',
  },
]

// ---------------------------------------------------------------------------
// Budgets & Rate Limits
// ---------------------------------------------------------------------------
export const budgetPolicies: BudgetPolicy[] = [
  { id: 'budget-org', scope: 'organisation', scopeId: organisation.id, scopeName: organisation.name, monthlyLimitUsd: 30000, currentSpendUsd: 18420, softWarningPct: 80, hardStopPct: 100, status: 'ok' },
  { id: 'budget-dept-idx', scope: 'department', scopeId: 'dept-idx', scopeName: 'IDX', monthlyLimitUsd: 12000, currentSpendUsd: 9860, softWarningPct: 80, hardStopPct: 100, status: 'warning' },
  { id: 'budget-dept-infosec', scope: 'department', scopeId: 'dept-infosec', scopeName: 'Information Security', monthlyLimitUsd: 5000, currentSpendUsd: 3120, softWarningPct: 80, hardStopPct: 100, status: 'ok' },
  { id: 'budget-proj-compliance', scope: 'project', scopeId: 'proj-compliance', scopeName: 'Compliance Portal', monthlyLimitUsd: 4000, currentSpendUsd: 3340, softWarningPct: 80, hardStopPct: 100, status: 'warning' },
  { id: 'budget-proj-knowledge', scope: 'project', scopeId: 'proj-knowledge', scopeName: 'Internal Knowledge Assistant', monthlyLimitUsd: 6000, currentSpendUsd: 2210, softWarningPct: 80, hardStopPct: 100, status: 'ok' },
  { id: 'budget-proj-support', scope: 'project', scopeId: 'proj-support', scopeName: 'Customer Support Copilot', monthlyLimitUsd: 9000, currentSpendUsd: 9000, softWarningPct: 80, hardStopPct: 100, status: 'exceeded' },
  { id: 'budget-proj-docintel', scope: 'project', scopeId: 'proj-docintel', scopeName: 'Document Intelligence', monthlyLimitUsd: 5000, currentSpendUsd: 1870, softWarningPct: 80, hardStopPct: 100, status: 'ok' },
  { id: 'budget-proj-devassist', scope: 'project', scopeId: 'proj-devassist', scopeName: 'Developer Assistant', monthlyLimitUsd: 3000, currentSpendUsd: 640, softWarningPct: 80, hardStopPct: 100, status: 'ok' },
]

export const rateLimitPolicies: RateLimitPolicy[] = [
  { id: 'rl-org', scope: 'organisation', scopeId: organisation.id, scopeName: organisation.name, requestsPerMinute: 2000, tokensPerMinute: 4000000, dailyRequestCap: 500000, burstAllowance: 300, offHoursThrottlePct: 50 },
  { id: 'rl-proj-compliance', scope: 'project', scopeId: 'proj-compliance', scopeName: 'Compliance Portal', requestsPerMinute: 120, tokensPerMinute: 200000, dailyRequestCap: 8000, burstAllowance: 30, offHoursThrottlePct: 30 },
  { id: 'rl-proj-support', scope: 'project', scopeId: 'proj-support', scopeName: 'Customer Support Copilot', requestsPerMinute: 400, tokensPerMinute: 600000, dailyRequestCap: 20000, burstAllowance: 80, offHoursThrottlePct: 0 },
]

// ---------------------------------------------------------------------------
// Virtual Keys
// ---------------------------------------------------------------------------
function maskKey(env: 'test' | 'live', last4: string) {
  return `ig_sk_${env}_${'•'.repeat(12)}${last4}`
}

export const virtualKeys: VirtualKey[] = [
  {
    id: 'key-1', name: 'Compliance Portal — Production', environment: 'live', prefix: maskKey('live', '4f92'),
    orgId: organisation.id, departmentId: 'dept-infosec', teamId: 'team-compliance', projectId: 'proj-compliance', boundUserId: undefined,
    allowedAliasIds: ['alias-sensitive', 'alias-document'], budgetLimitUsd: 2000, rateLimitRpm: 60, ipRestrictions: ['10.20.0.0/16'],
    createdAt: '2026-05-12T09:10:00Z', createdBy: 'Anjali Kulkarni', expiresAt: '2026-12-31T00:00:00Z', lastUsedAt: subMinutes(new Date(), 4).toISOString(),
    status: 'active', riskFlags: [],
  },
  {
    id: 'key-2', name: 'Knowledge Assistant — Staging', environment: 'test', prefix: maskKey('test', '9b17'),
    orgId: organisation.id, departmentId: 'dept-idx', teamId: 'team-aiplatform', projectId: 'proj-knowledge', boundUserId: 'user-dev',
    allowedAliasIds: ['alias-general', 'alias-fast'], budgetLimitUsd: 500, rateLimitRpm: 100, ipRestrictions: [],
    createdAt: '2026-06-01T09:10:00Z', createdBy: 'Priya Nair', expiresAt: null, lastUsedAt: subHours(new Date(), 2).toISOString(),
    status: 'active', riskFlags: [],
  },
  {
    id: 'key-3', name: 'Support Copilot — Production', environment: 'live', prefix: maskKey('live', '2c58'),
    orgId: organisation.id, departmentId: 'dept-cloudops', teamId: 'team-cloudsupport', projectId: 'proj-support', boundUserId: undefined,
    allowedAliasIds: ['alias-fast', 'alias-general'], budgetLimitUsd: 5000, rateLimitRpm: 400, ipRestrictions: ['10.30.0.0/16'],
    createdAt: '2026-01-20T09:15:00Z', createdBy: 'Vikram Salunkhe', expiresAt: addDays(new Date(), 6).toISOString(), lastUsedAt: subMinutes(new Date(), 1).toISOString(),
    status: 'expiring', riskFlags: ['budget-exceeded'],
  },
  {
    id: 'key-4', name: 'Document Intelligence — Dev', environment: 'test', prefix: maskKey('test', '7a31'),
    orgId: organisation.id, departmentId: 'dept-idx', teamId: 'team-aiplatform', projectId: 'proj-docintel', boundUserId: 'user-dev',
    allowedAliasIds: ['alias-document'], budgetLimitUsd: 300, rateLimitRpm: 60, ipRestrictions: [],
    createdAt: '2026-02-14T09:20:00Z', createdBy: 'Priya Nair', expiresAt: subDays(new Date(), 3).toISOString(), lastUsedAt: subDays(new Date(), 10).toISOString(),
    status: 'expired', riskFlags: [],
  },
  {
    id: 'key-5', name: 'Developer Assistant — Legacy', environment: 'live', prefix: maskKey('live', '1e04'),
    orgId: organisation.id, departmentId: 'dept-idx', teamId: 'team-aiplatform', projectId: 'proj-devassist', boundUserId: 'user-dev',
    allowedAliasIds: ['alias-code'], budgetLimitUsd: 800, rateLimitRpm: 60, ipRestrictions: [],
    createdAt: '2026-04-01T09:25:00Z', createdBy: 'Rohan Deshmukh', expiresAt: null, lastUsedAt: subDays(new Date(), 40).toISOString(),
    status: 'revoked', riskFlags: ['revoked-after-incident'],
  },
]

export const keyActivity: KeyActivityEvent[] = [
  { id: uuid(), keyId: 'key-1', timestamp: '2026-05-12T09:10:00Z', action: 'created', detail: 'Key created by Anjali Kulkarni for Compliance Portal (live).' },
  { id: uuid(), keyId: 'key-1', timestamp: subMinutes(new Date(), 4).toISOString(), action: 'used', detail: 'Chat completion via indusgate-sensitive alias — 1,240 tokens.' },
  { id: uuid(), keyId: 'key-3', timestamp: subMinutes(new Date(), 1).toISOString(), action: 'used', detail: 'Chat completion via indusgate-fast alias — 640 tokens.' },
  { id: uuid(), keyId: 'key-3', timestamp: subHours(new Date(), 6).toISOString(), action: 'blocked_attempt', detail: 'Request blocked — project hard monthly budget reached.' },
  { id: uuid(), keyId: 'key-4', timestamp: subDays(new Date(), 3).toISOString(), action: 'expired', detail: 'Key expired automatically per configured expiry date.' },
  { id: uuid(), keyId: 'key-5', timestamp: subDays(new Date(), 12).toISOString(), action: 'revoked', detail: 'Key revoked by Rohan Deshmukh following provider-credential exposure review.' },
]

// ---------------------------------------------------------------------------
// PII helpers
// ---------------------------------------------------------------------------
const piiSamples: Record<string, { value: string; placeholder: string }[]> = {
  person_name: [{ value: 'Rakesh Mehta', placeholder: '[PERSON_NAME_1]' }, { value: 'Sunita Verma', placeholder: '[PERSON_NAME_1]' }],
  email: [{ value: 'rakesh.mehta@fictionalcorp.example', placeholder: '[EMAIL_1]' }],
  phone: [{ value: '+91 98765 43210', placeholder: '[PHONE_1]' }],
  aadhaar_like: [{ value: '2345 6789 0123', placeholder: '[AADHAAR_LIKE_1]' }],
  pan_like: [{ value: 'ABCDE1234F', placeholder: '[PAN_LIKE_1]' }],
  bank_account: [{ value: '000123456789012', placeholder: '[BANK_ACCOUNT_1]' }],
  address: [{ value: '221B, Ivory Heights, Nashik, Maharashtra', placeholder: '[ADDRESS_1]' }],
  employee_id: [{ value: 'IndusGate AI-EMP-04821', placeholder: '[EMPLOYEE_ID_1]' }],
}

export function generatePiiDetections(count: number): PiiDetection[] {
  const categories = Object.keys(piiSamples) as (keyof typeof piiSamples)[]
  const chosen = new Set<string>()
  while (chosen.size < Math.min(count, categories.length)) chosen.add(pick(categories))
  return Array.from(chosen).map((cat) => {
    const sample = pick(piiSamples[cat])
    return { category: cat as PiiDetection['category'], originalValue: sample.value, maskedValue: sample.placeholder, placeholder: sample.placeholder }
  })
}

// ---------------------------------------------------------------------------
// Request Traces (seed a realistic volume, connected to keys/projects)
// ---------------------------------------------------------------------------
function buildStages(opts: { piiCount: number; fallback: boolean; outcome: string; cacheHit: boolean }): TraceStage[] {
  const { piiCount, fallback, outcome, cacheHit } = opts
  const stages: TraceStage[] = [
    { name: 'key_validated', label: 'Virtual key validated', status: outcome === 'blocked_auth' ? 'failed' : 'completed', durationMs: randInt(2, 8), decision: outcome === 'blocked_auth' ? 'Key is revoked or expired — request rejected.' : 'Key is active and scoped correctly.' },
  ]
  if (outcome === 'blocked_auth') return stages
  stages.push({ name: 'org_project_identified', label: 'Organisation / project identified', status: 'completed', durationMs: randInt(1, 4), decision: 'Resolved organisation, department, team, and project from key metadata.' })
  stages.push({ name: 'rate_limit_check', label: 'Rate-limit check completed', status: outcome === 'blocked_rate_limit' ? 'failed' : 'completed', durationMs: randInt(1, 5), decision: outcome === 'blocked_rate_limit' ? 'Requests-per-minute limit exceeded for this virtual key.' : 'Within configured rate limits.' })
  if (outcome === 'blocked_rate_limit') return stages
  stages.push({ name: 'budget_check', label: 'Budget check completed', status: outcome === 'blocked_budget' ? 'failed' : 'completed', durationMs: randInt(1, 5), decision: outcome === 'blocked_budget' ? 'Project reached its hard monthly budget limit — request rejected before forwarding.' : 'Project and key budgets have available headroom.' })
  if (outcome === 'blocked_budget') return stages
  stages.push({ name: 'pii_scan', label: 'PII scan completed', status: 'completed', durationMs: randInt(15, 60), decision: piiCount > 0 ? `${piiCount} sensitive value(s) detected in the prompt.` : 'No sensitive data detected.' })
  stages.push({ name: 'prompt_masking', label: 'Prompt masking completed', status: piiCount > 0 ? 'completed' : 'skipped', durationMs: piiCount > 0 ? randInt(5, 20) : 0, decision: piiCount > 0 ? 'Detected values replaced with placeholders before policy evaluation.' : 'No masking required.' })
  stages.push({ name: 'policy_evaluated', label: 'Routing policy evaluated', status: outcome === 'blocked_policy' ? 'failed' : 'completed', durationMs: randInt(2, 8), decision: outcome === 'blocked_policy' ? 'Policy explicitly blocks external egress for this project; no eligible route found.' : 'Policy selected an eligible routing path.' })
  if (outcome === 'blocked_policy') return stages
  stages.push({ name: 'provider_health_checked', label: 'Provider health checked', status: fallback ? 'warning' : 'completed', durationMs: randInt(3, 12), decision: fallback ? 'Primary provider unhealthy — evaluating fallback chain.' : 'Primary provider healthy.' })
  stages.push({ name: 'model_selected', label: 'Model selected', status: 'completed', durationMs: randInt(1, 4), decision: fallback ? 'Fallback model selected per configured fallback chain.' : 'Primary model selected per active routing policy.' })
  stages.push({ name: 'request_forwarded', label: 'Request forwarded to provider', status: outcome === 'failed_provider' ? 'failed' : 'completed', durationMs: randInt(200, 900), decision: outcome === 'failed_provider' ? 'Provider returned an error after forwarding.' : 'Request forwarded successfully.' })
  if (outcome === 'failed_provider') return stages
  stages.push({ name: 'response_received', label: 'Response received', status: 'completed', durationMs: randInt(50, 400), decision: cacheHit ? 'Served from semantic cache — provider call skipped.' : 'Response received from provider.' })
  stages.push({ name: 'response_filtered', label: 'Response filtered', status: 'completed', durationMs: randInt(5, 20), decision: 'Response checked against response-filtering rules — no violations found.' })
  stages.push({ name: 'usage_recorded', label: 'Usage recorded', status: 'completed', durationMs: randInt(1, 3), decision: 'Token usage and cost recorded against key, project, and department.' })
  stages.push({ name: 'audit_written', label: 'Audit event written', status: 'completed', durationMs: randInt(1, 3), decision: 'Tamper-evident audit record appended to the audit log.' })
  return stages
}

const outcomes: RequestTrace['outcome'][] = ['success', 'success', 'success', 'success', 'success', 'success', 'blocked_budget', 'blocked_rate_limit', 'blocked_auth', 'blocked_policy', 'failed_provider']
const samplePrompts = [
  'Summarise this document for the compliance review committee.',
  'Draft a response to the customer regarding their invoice dispute.',
  'Generate unit tests for the billing reconciliation module.',
  'Explain the difference between the two proposed SLA clauses.',
  'Extract the key obligations from this vendor contract.',
  'Translate this internal policy note into plain language for new employees.',
]

function buildTrace(index: number): RequestTrace {
  const key = pick(virtualKeys.filter((k) => k.status !== 'revoked'))
  const project = projects.find((p) => p.id === key.projectId)!
  const alias = pick(modelAliases.filter((a) => key.allowedAliasIds.includes(a.id)) || modelAliases)
  const outcome = pick(outcomes)
  const model = providerModels.find((m) => m.id === alias.primaryModelId)!
  const fallback = outcome === 'success' && rand() < 0.15
  const selectedModel = fallback ? providerModels.find((m) => m.id === alias.fallbackModelIds[0]) ?? model : model
  const piiCount = rand() < 0.22 ? randInt(1, 3) : 0
  const cacheHit = outcome === 'success' && rand() < 0.28
  const promptTokens = randInt(80, 900)
  const completionTokens = cacheHit ? 0 : randInt(60, 700)
  const totalTokens = promptTokens + completionTokens
  const cost = cacheHit ? 0 : round2((promptTokens / 1000) * selectedModel.costPer1kInputUsd + (completionTokens / 1000) * selectedModel.costPer1kOutputUsd)
  const timestamp = subMinutes(new Date(), index * randInt(3, 40)).toISOString()

  return {
    id: uuid(),
    traceId: `trc_${uuid().replace(/-/g, '').slice(0, 20)}`,
    timestamp,
    virtualKeyId: key.id,
    virtualKeyName: key.name,
    projectId: project.id,
    projectName: project.name,
    departmentId: project.departmentId,
    modelAliasId: alias.id,
    modelAliasName: alias.name,
    selectedModelId: selectedModel.id,
    selectedProvider: selectedModel.provider,
    selectedModel: selectedModel.displayName,
    routingPolicyId: alias.sensitiveDataOnly ? 'policy-sensitive' : 'policy-costfirst',
    routingPolicyName: alias.sensitiveDataOnly ? 'Sensitive Data — Sovereign Only' : 'Non-sensitive — Cost-First',
    routingExplanation: alias.sensitiveDataOnly
      ? 'Sensitive-data policy matched — request restricted to India-hosted models only.'
      : fallback
        ? 'Primary provider was unhealthy; the gateway used the configured fallback chain.'
        : 'No sensitive data detected; lowest-cost healthy provider selected per active policy.',
    sovereignty: selectedModel.sovereignty,
    egress: selectedModel.sovereignty === 'external' ? 'allowed' : 'not_applicable',
    fallbackUsed: fallback,
    fallbackReason: fallback ? 'Primary provider health check failed (circuit breaker open/half-open).' : undefined,
    piiDetected: piiCount > 0 ? generatePiiDetections(piiCount) : [],
    promptTokens, completionTokens, totalTokens,
    latencyMs: cacheHit ? randInt(20, 60) : selectedModel.avgLatencyMs + randInt(-100, 250),
    estimatedCostUsd: cost,
    cacheStatus: outcome !== 'success' ? 'not_applicable' : cacheHit ? 'hit' : 'miss',
    outcome,
    stages: buildStages({ piiCount, fallback, outcome, cacheHit }),
    userPromptPreview: pick(samplePrompts),
    responsePreview: outcome === 'success' ? 'Response generated successfully and returned to the caller.' : '—',
  }
}

export const requestTraces: RequestTrace[] = Array.from({ length: 140 }, (_, i) => buildTrace(i))
  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

// ---------------------------------------------------------------------------
// Audit Logs (linked to traces where relevant)
// ---------------------------------------------------------------------------
function hash() { return Array.from({ length: 40 }, () => randInt(0, 15).toString(16)).join('') }

export const auditEvents: AuditEvent[] = [
  { id: uuid(), timestamp: '2026-05-12T09:10:00Z', actor: 'Anjali Kulkarni', actorRole: 'org_admin', orgId: organisation.id, projectId: 'proj-compliance', action: 'virtual_key.create', resource: 'key-1', result: 'success', ipAddress: '10.20.4.12', policyDecision: 'allowed', integrityHash: hash(), tamperEvident: true },
  { id: uuid(), timestamp: subDays(new Date(), 12).toISOString(), actor: 'Rohan Deshmukh', actorRole: 'platform_admin', orgId: organisation.id, projectId: 'proj-devassist', action: 'virtual_key.revoke', resource: 'key-5', result: 'success', ipAddress: '10.10.1.4', policyDecision: 'allowed', previousValue: 'status=active', newValue: 'status=revoked', integrityHash: hash(), tamperEvident: true },
  { id: uuid(), timestamp: subDays(new Date(), 3).toISOString(), actor: 'System', actorRole: 'platform_admin', orgId: organisation.id, projectId: 'proj-docintel', action: 'virtual_key.expire', resource: 'key-4', result: 'success', ipAddress: 'internal', policyDecision: 'automatic', previousValue: 'status=active', newValue: 'status=expired', integrityHash: hash(), tamperEvident: true },
  { id: uuid(), timestamp: subHours(new Date(), 6).toISOString(), actor: 'System', actorRole: 'platform_admin', orgId: organisation.id, projectId: 'proj-support', action: 'request.block', resource: 'proj-support budget', result: 'denied', ipAddress: '10.30.7.2', policyDecision: 'hard_stop_budget', integrityHash: hash(), tamperEvident: true },
  { id: uuid(), timestamp: subDays(new Date(), 1).toISOString(), actor: 'Vikram Salunkhe', actorRole: 'department_manager', orgId: organisation.id, projectId: 'proj-compliance', action: 'routing_policy.update', resource: 'policy-compliance-sovereign', result: 'success', ipAddress: '10.20.4.30', policyDecision: 'allowed', previousValue: 'maxLatencyMs=5000', newValue: 'maxLatencyMs=3000', integrityHash: hash(), tamperEvident: true },
  { id: uuid(), timestamp: subHours(new Date(), 18).toISOString(), actor: 'Priya Nair', actorRole: 'developer', orgId: organisation.id, projectId: 'proj-knowledge', action: 'model_alias.create', resource: 'alias-general', result: 'success', ipAddress: '10.10.9.5', policyDecision: 'allowed', integrityHash: hash(), tamperEvident: true },
  { id: uuid(), timestamp: subHours(new Date(), 2).toISOString(), actor: 'Unknown', actorRole: 'read_only_viewer', orgId: organisation.id, action: 'auth.invalid_key_attempt', resource: 'key-4 (expired)', result: 'denied', ipAddress: '103.22.19.88', policyDecision: 'rejected_expired', integrityHash: hash(), tamperEvident: true },
]

// Link a subset of traces into audit log as "chat_completion.forward" events
requestTraces.slice(0, 25).forEach((t) => {
  auditEvents.push({
    id: uuid(), timestamp: t.timestamp, traceId: t.traceId, actor: `Virtual key: ${t.virtualKeyName}`, actorRole: 'developer',
    orgId: organisation.id, projectId: t.projectId, action: 'chat_completion.forward', resource: t.selectedModel,
    result: t.outcome === 'success' ? 'success' : 'denied', ipAddress: '10.' + randInt(10, 250) + '.' + randInt(1, 250) + '.' + randInt(1, 250),
    policyDecision: t.routingPolicyName, integrityHash: hash(), tamperEvident: true,
  })
})
auditEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

// ---------------------------------------------------------------------------
// Provider incidents & health history
// ---------------------------------------------------------------------------
export const providerIncidents: ProviderIncident[] = [
  { id: uuid(), providerModelId: 'model-india-mistral', providerName: 'India-hosted Mistral Large', startedAt: subHours(new Date(), 3).toISOString(), resolvedAt: null, severity: 'minor', description: 'Elevated latency observed on Mumbai DC GPU pool — investigating capacity.', failoverTriggered: true, failoverTargetModelId: 'model-india-llama' },
  { id: uuid(), providerModelId: 'model-google-gemini', providerName: 'Google Gemini 1.5 Pro', startedAt: subHours(new Date(), 9).toISOString(), resolvedAt: null, severity: 'critical', description: 'Provider returning elevated 5xx error rates — circuit breaker opened, external egress blocked for this model.', failoverTriggered: true, failoverTargetModelId: 'model-openai-gpt4o' },
  { id: uuid(), providerModelId: 'model-openai-gpt4o', providerName: 'OpenAI GPT-4o', startedAt: subDays(new Date(), 2).toISOString(), resolvedAt: subDays(new Date(), 2).toISOString(), severity: 'minor', description: 'Brief regional outage on OpenAI infrastructure, resolved after 11 minutes.', failoverTriggered: true, failoverTargetModelId: 'model-india-llama' },
]

// ---------------------------------------------------------------------------
// Semantic cache entries
// ---------------------------------------------------------------------------
export const cacheEntries: CacheEntry[] = Array.from({ length: 18 }, (_, i) => ({
  id: uuid(),
  projectId: pick(projects).id,
  promptPreview: pick(samplePrompts),
  similarityScore: round2(0.86 + rand() * 0.13),
  hits: randInt(1, 40),
  ttlMinutes: pick([15, 30, 60, 120, 240]),
  createdAt: subHours(new Date(), randInt(1, 96)).toISOString(),
  tokensSaved: randInt(200, 5000) * (i + 1) % 9000 + 400,
  costSavedUsd: round2(rand() * 4),
}))

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------
export const alerts: AlertItem[] = [
  { id: uuid(), type: 'budget_80', severity: 'warning', title: 'Compliance Portal budget at 84%', description: 'Project has consumed ₹3,340 of its ₹4,000 monthly budget.', timestamp: subHours(new Date(), 5).toISOString(), read: false, relatedProjectId: 'proj-compliance' },
  { id: uuid(), type: 'key_expiring', severity: 'warning', title: 'Virtual key expires in 6 days', description: '"Support Copilot — Production" will expire on ' + format(addDays(new Date(), 6), 'dd MMM yyyy') + '.', timestamp: subHours(new Date(), 8).toISOString(), read: false },
  { id: uuid(), type: 'provider_degraded', severity: 'warning', title: 'India-hosted Mistral Large degraded', description: 'Elevated latency detected on Mumbai DC GPU pool; automatic failover engaged.', timestamp: subHours(new Date(), 3).toISOString(), read: false },
  { id: uuid(), type: 'egress_blocked', severity: 'critical', title: 'External egress blocked — Google Gemini', description: 'Circuit breaker opened after sustained 5xx errors; requests rerouted to approved fallback.', timestamp: subHours(new Date(), 9).toISOString(), read: false },
  { id: uuid(), type: 'pii_detected', severity: 'info', title: 'PII masked before external egress', description: '3 sensitive values were masked before a request left the protected gateway boundary.', timestamp: subHours(new Date(), 12).toISOString(), read: true, relatedTraceId: requestTraces.find((t) => t.piiDetected.length > 0)?.traceId },
  { id: uuid(), type: 'rate_limit_exceeded', severity: 'warning', title: 'Rate limit exceeded — Support Copilot', description: 'Requests-per-minute limit briefly exceeded during a traffic spike.', timestamp: subHours(new Date(), 14).toISOString(), read: true },
  { id: uuid(), type: 'token_spike', severity: 'info', title: 'Unusual token spike — Knowledge Assistant', description: 'Token consumption 2.4x above the 7-day rolling average.', timestamp: subDays(new Date(), 1).toISOString(), read: true },
  { id: uuid(), type: 'failover_triggered', severity: 'warning', title: 'Failover triggered — Compliance Portal', description: 'Primary model unavailable; gateway used the configured fallback chain successfully.', timestamp: subDays(new Date(), 2).toISOString(), read: true },
  { id: uuid(), type: 'invalid_key_attempts', severity: 'critical', title: 'Repeated invalid key attempts detected', description: '5 requests rejected using an expired virtual key from an unrecognised IP range.', timestamp: subHours(new Date(), 2).toISOString(), read: false },
  { id: uuid(), type: 'cache_hit_drop', severity: 'info', title: 'Cache-hit rate dropped 9%', description: 'Semantic cache hit rate fell from 31% to 22% over the last 24 hours.', timestamp: subDays(new Date(), 1).toISOString(), read: true },
]

// ---------------------------------------------------------------------------
// Daily usage series (30 days) — feeds dashboard + billing trend charts
// ---------------------------------------------------------------------------
export const usageDaily: UsageDaily[] = Array.from({ length: 30 }, (_, i) => {
  const date = subDays(new Date(), 29 - i)
  const requests = randInt(1800, 4200)
  const tokens = requests * randInt(400, 900)
  const cost = round2(tokens * 0.00000045 * randInt(80, 140))
  return {
    date: format(date, 'yyyy-MM-dd'),
    requests, tokens, costUsd: cost,
    cacheHitRate: round2(0.18 + rand() * 0.18),
    errorRate: round2(rand() * 0.03),
    avgLatencyMs: randInt(420, 780),
    sovereignPct: round2(0.62 + rand() * 0.28),
  }
})
