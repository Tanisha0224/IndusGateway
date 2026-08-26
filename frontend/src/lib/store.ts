import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuid } from 'uuid'
import { addDays } from 'date-fns'
import * as seed from './data/seed'
import type {
  DemoUser, VirtualKey, KeyActivityEvent, RoutingPolicy, ModelAlias, BudgetPolicy,
  RateLimitPolicy, RequestTrace, AuditEvent, AlertItem, CacheEntry, ProviderModel,
  KeyEnvironment, KeyStatus, Role,
} from '../types'
import { ApiError } from './api/client'
import * as authApi from './api/auth'
import * as projectsApi from './api/projects'
import * as policiesApi from './api/policies'
import * as providersApi from './api/providers'
import * as virtualKeysApi from './api/virtualKeys'
import * as tracesApi from './api/traces'
import * as auditLogsApi from './api/auditLogs'
import * as usageApi from './api/usage'
import type {
  BackendUser, BackendProject, BackendPolicy, BackendProvider, BackendVirtualKey,
  BackendGatewayRequest, BackendAuditLog, BackendUsageSummaryRow,
} from './api/types'

const backendRoleMap: Record<BackendUser['role'], Role> = {
  admin: 'platform_admin',
  member: 'developer',
}

function toDemoUser(user: BackendUser): DemoUser {
  const initials = user.name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const role = user.app_role ?? backendRoleMap[user.role]
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role,
    title: seed.roleLabels[role] ?? role,
    departmentId: user.department_id ?? seed.departments[0]?.id ?? '',
    avatarInitials: initials || 'U',
    password: '',
  }
}

function hash() { return Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('') }

interface IndusGateState {
  // Session (backed by the real FastAPI backend — httpOnly cookie, not localStorage)
  currentUser: DemoUser | null
  authStatus: 'idle' | 'loading' | 'authenticated' | 'unauthenticated'
  currentProjectId: string
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => Promise<void>
  bootstrapAuth: () => Promise<void>
  setCurrentProject: (projectId: string) => void

  // Real backend data — projects, policies, providers, virtual keys, gateway
  // request traces, and audit logs. Kept separate from the mocked domains
  // below (org hierarchy, budgets, routing, cache, health, playground, etc.)
  // which remain seeded/simulated pending further backend scope.
  realProjects: BackendProject[]
  realPolicies: BackendPolicy[]
  realProviders: BackendProvider[]
  realVirtualKeys: BackendVirtualKey[]
  gatewayRequests: BackendGatewayRequest[]
  realAuditLogs: BackendAuditLog[]
  auditLogsAccessDenied: boolean
  usageSummary: BackendUsageSummaryRow[]
  fetchRealProjects: () => Promise<void>
  createRealProject: (input: {
    name: string; description?: string; policy_id: string; monthly_budget_inr?: number | null
  }) => Promise<BackendProject>
  updateRealProject: (
    id: string, input: { name?: string; description?: string; monthly_budget_inr?: number | null }
  ) => Promise<BackendProject>
  fetchRealPolicies: () => Promise<void>
  fetchRealProviders: () => Promise<void>
  fetchRealVirtualKeys: () => Promise<void>
  createRealVirtualKey: (input: {
    project_id: string; allowed_provider_ids: string[]; allowed_model_aliases: string[]; expires_at: string | null
  }) => Promise<{ virtualKey: BackendVirtualKey; fullKey: string }>
  rotateRealVirtualKey: (id: string) => Promise<{ virtualKey: BackendVirtualKey; fullKey: string }>
  revokeRealVirtualKey: (id: string) => Promise<void>
  fetchGatewayRequests: () => Promise<void>
  fetchRealAuditLogs: () => Promise<void>
  fetchUsageSummary: () => Promise<void>

  // Reference data (mutable copies)
  organisation: typeof seed.organisation
  departments: typeof seed.departments
  teams: typeof seed.teams
  projects: typeof seed.projects
  providerModels: ProviderModel[]
  modelAliases: ModelAlias[]
  routingPolicies: RoutingPolicy[]
  budgetPolicies: BudgetPolicy[]
  rateLimitPolicies: RateLimitPolicy[]
  virtualKeys: VirtualKey[]
  keyActivity: KeyActivityEvent[]
  requestTraces: RequestTrace[]
  auditEvents: AuditEvent[]
  providerIncidents: typeof seed.providerIncidents
  cacheEntries: CacheEntry[]
  alerts: AlertItem[]
  usageDaily: typeof seed.usageDaily

  // Virtual key actions
  createVirtualKey: (input: {
    name: string; environment: KeyEnvironment; departmentId: string; teamId: string; projectId: string;
    boundUserId?: string; allowedAliasIds: string[]; budgetLimitUsd: number; rateLimitRpm: number;
    ipRestrictions: string[]; expiresAt: string | null;
  }) => { key: VirtualKey; fullKey: string }
  rotateVirtualKey: (id: string) => { fullKey: string } | null
  revokeVirtualKey: (id: string) => void
  deleteVirtualKey: (id: string) => void
  clearFullKeyReveal: (id: string) => void

  // Routing / aliases / budgets
  toggleRoutingPolicy: (id: string) => void
  createRoutingPolicy: (policy: Omit<RoutingPolicy, 'id' | 'createdAt' | 'updatedAt'>) => void
  createModelAlias: (alias: Omit<ModelAlias, 'id' | 'createdAt'>) => void
  updateBudgetLimit: (id: string, monthlyLimitUsd: number) => void
  updateRateLimit: (id: string, patch: Partial<RateLimitPolicy>) => void

  // Provider health
  simulateProviderFailure: (modelId: string) => void
  restoreProvider: (modelId: string) => void

  // Cache
  clearCache: () => void
  invalidateCacheEntry: (id: string) => void

  // Alerts
  markAlertRead: (id: string) => void
  markAllAlertsRead: () => void
}

export const useIndusGateStore = create<IndusGateState>()(persist((set, get) => ({
  currentUser: null,
  authStatus: 'idle',
  currentProjectId: seed.projects[0].id,

  login: async (email, password) => {
    try {
      const { user } = await authApi.login(email, password)
      set({ currentUser: toDemoUser(user), authStatus: 'authenticated' })
      return { ok: true }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Sign-in failed. Please try again.'
      return { ok: false, error: message }
    }
  },
  logout: async () => {
    try {
      await authApi.logout()
    } finally {
      set({ currentUser: null, authStatus: 'unauthenticated' })
    }
  },
  bootstrapAuth: async () => {
    set({ authStatus: 'loading' })
    try {
      const user = await authApi.me()
      set({ currentUser: toDemoUser(user), authStatus: 'authenticated' })
    } catch {
      set({ currentUser: null, authStatus: 'unauthenticated' })
    }
  },
  setCurrentProject: (projectId) => set({ currentProjectId: projectId }),

  organisation: seed.organisation,
  departments: seed.departments,
  teams: seed.teams,
  projects: seed.projects,
  providerModels: seed.providerModels,
  modelAliases: seed.modelAliases,
  routingPolicies: seed.routingPolicies,
  budgetPolicies: seed.budgetPolicies,
  rateLimitPolicies: seed.rateLimitPolicies,
  virtualKeys: seed.virtualKeys,
  keyActivity: seed.keyActivity,
  requestTraces: seed.requestTraces,
  auditEvents: seed.auditEvents,
  providerIncidents: seed.providerIncidents,
  cacheEntries: seed.cacheEntries,
  alerts: seed.alerts,
  usageDaily: seed.usageDaily,

  realProjects: [],
  realPolicies: [],
  realProviders: [],
  realVirtualKeys: [],
  gatewayRequests: [],
  realAuditLogs: [],
  auditLogsAccessDenied: false,
  usageSummary: [],

  fetchRealProjects: async () => { set({ realProjects: await projectsApi.listProjects() }) },
  createRealProject: async (input) => {
    const project = await projectsApi.createProject(input)
    set((s) => ({ realProjects: [project, ...s.realProjects] }))
    return project
  },
  updateRealProject: async (id, input) => {
    const project = await projectsApi.updateProject(id, input)
    set((s) => ({ realProjects: s.realProjects.map((p) => (p.id === id ? project : p)) }))
    return project
  },
  fetchRealPolicies: async () => { set({ realPolicies: await policiesApi.listPolicies() }) },
  fetchRealProviders: async () => { set({ realProviders: await providersApi.listProviders() }) },
  fetchRealVirtualKeys: async () => { set({ realVirtualKeys: await virtualKeysApi.listVirtualKeys() }) },

  createRealVirtualKey: async (input) => {
    const { virtual_key, full_key } = await virtualKeysApi.createVirtualKey(input)
    set((s) => ({ realVirtualKeys: [virtual_key, ...s.realVirtualKeys] }))
    return { virtualKey: virtual_key, fullKey: full_key }
  },
  rotateRealVirtualKey: async (id) => {
    const { virtual_key, full_key } = await virtualKeysApi.rotateVirtualKey(id)
    set((s) => ({ realVirtualKeys: s.realVirtualKeys.map((k) => (k.id === id ? virtual_key : k)) }))
    return { virtualKey: virtual_key, fullKey: full_key }
  },
  revokeRealVirtualKey: async (id) => {
    const updated = await virtualKeysApi.revokeVirtualKey(id)
    set((s) => ({ realVirtualKeys: s.realVirtualKeys.map((k) => (k.id === id ? updated : k)) }))
  },

  fetchGatewayRequests: async () => { set({ gatewayRequests: await tracesApi.listGatewayRequests() }) },

  fetchRealAuditLogs: async () => {
    try {
      const logs = await auditLogsApi.listAuditLogs()
      set({ realAuditLogs: logs, auditLogsAccessDenied: false })
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        set({ realAuditLogs: [], auditLogsAccessDenied: true })
      } else {
        throw err
      }
    }
  },

  fetchUsageSummary: async () => { set({ usageSummary: await usageApi.getUsageSummary() }) },

  createVirtualKey: (input) => {
    const last4 = uuid().replace(/-/g, '').slice(0, 4)
    const fullKey = `ig_sk_${input.environment}_${uuid().replace(/-/g, '')}${last4}`
    const prefix = `ig_sk_${input.environment}_${'•'.repeat(12)}${last4}`
    const key: VirtualKey = {
      id: uuid(), name: input.name, environment: input.environment, prefix, fullKeyOnce: fullKey,
      orgId: seed.organisation.id, departmentId: input.departmentId, teamId: input.teamId, projectId: input.projectId,
      boundUserId: input.boundUserId, allowedAliasIds: input.allowedAliasIds, budgetLimitUsd: input.budgetLimitUsd,
      rateLimitRpm: input.rateLimitRpm, ipRestrictions: input.ipRestrictions, createdAt: new Date().toISOString(),
      createdBy: get().currentUser?.name ?? 'Unknown', expiresAt: input.expiresAt, lastUsedAt: null, status: 'active', riskFlags: [],
    }
    const activity: KeyActivityEvent = { id: uuid(), keyId: key.id, timestamp: new Date().toISOString(), action: 'created', detail: `Key created by ${key.createdBy} for ${input.environment} environment.` }
    const audit: AuditEvent = {
      id: uuid(), timestamp: new Date().toISOString(), actor: key.createdBy, actorRole: get().currentUser?.role ?? 'developer',
      orgId: seed.organisation.id, projectId: input.projectId, action: 'virtual_key.create', resource: key.id, result: 'success',
      ipAddress: '10.1.1.1 (session)', policyDecision: 'allowed', integrityHash: hash(), tamperEvident: true,
    }
    set((s) => ({
      virtualKeys: [key, ...s.virtualKeys],
      keyActivity: [activity, ...s.keyActivity],
      auditEvents: [audit, ...s.auditEvents],
    }))
    return { key, fullKey }
  },

  rotateVirtualKey: (id) => {
    const existing = get().virtualKeys.find((k) => k.id === id)
    if (!existing) return null
    const last4 = uuid().replace(/-/g, '').slice(0, 4)
    const fullKey = `ig_sk_${existing.environment}_${uuid().replace(/-/g, '')}${last4}`
    const prefix = `ig_sk_${existing.environment}_${'•'.repeat(12)}${last4}`
    const activity: KeyActivityEvent = { id: uuid(), keyId: id, timestamp: new Date().toISOString(), action: 'rotated', detail: `Key rotated by ${get().currentUser?.name ?? 'Unknown'}. Previous secret is now invalid.` }
    set((s) => ({
      virtualKeys: s.virtualKeys.map((k) => (k.id === id ? { ...k, prefix, fullKeyOnce: fullKey, status: 'active' as KeyStatus } : k)),
      keyActivity: [activity, ...s.keyActivity],
    }))
    return { fullKey }
  },

  revokeVirtualKey: (id) => {
    const key = get().virtualKeys.find((k) => k.id === id)
    if (!key) return
    const activity: KeyActivityEvent = { id: uuid(), keyId: id, timestamp: new Date().toISOString(), action: 'revoked', detail: `Key revoked by ${get().currentUser?.name ?? 'Unknown'}.` }
    const audit: AuditEvent = {
      id: uuid(), timestamp: new Date().toISOString(), actor: get().currentUser?.name ?? 'Unknown', actorRole: get().currentUser?.role ?? 'developer',
      orgId: seed.organisation.id, projectId: key.projectId, action: 'virtual_key.revoke', resource: id, result: 'success',
      ipAddress: '10.1.1.1 (session)', policyDecision: 'allowed', previousValue: 'status=' + key.status, newValue: 'status=revoked',
      integrityHash: hash(), tamperEvident: true,
    }
    set((s) => ({
      virtualKeys: s.virtualKeys.map((k) => (k.id === id ? { ...k, status: 'revoked' as KeyStatus, fullKeyOnce: undefined } : k)),
      keyActivity: [activity, ...s.keyActivity],
      auditEvents: [audit, ...s.auditEvents],
    }))
  },

  deleteVirtualKey: (id) => set((s) => ({ virtualKeys: s.virtualKeys.filter((k) => k.id !== id) })),

  clearFullKeyReveal: (id) => set((s) => ({ virtualKeys: s.virtualKeys.map((k) => (k.id === id ? { ...k, fullKeyOnce: undefined } : k)) })),

  toggleRoutingPolicy: (id) => set((s) => ({ routingPolicies: s.routingPolicies.map((p) => (p.id === id ? { ...p, enabled: !p.enabled, updatedAt: new Date().toISOString() } : p)) })),

  createRoutingPolicy: (policy) => set((s) => ({
    routingPolicies: [{ ...policy, id: uuid(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, ...s.routingPolicies],
  })),

  createModelAlias: (alias) => set((s) => ({
    modelAliases: [{ ...alias, id: uuid(), createdAt: new Date().toISOString() }, ...s.modelAliases],
  })),

  updateBudgetLimit: (id, monthlyLimitUsd) => set((s) => ({
    budgetPolicies: s.budgetPolicies.map((b) => {
      if (b.id !== id) return b
      const pct = (b.currentSpendUsd / monthlyLimitUsd) * 100
      return { ...b, monthlyLimitUsd, status: pct >= 100 ? 'exceeded' : pct >= b.softWarningPct ? 'warning' : 'ok' }
    }),
  })),

  updateRateLimit: (id, patch) => set((s) => ({
    rateLimitPolicies: s.rateLimitPolicies.map((r) => (r.id === id ? { ...r, ...patch } : r)),
  })),

  simulateProviderFailure: (modelId) => {
    const model = get().providerModels.find((m) => m.id === modelId)
    if (!model) return
    const incident = {
      id: uuid(), providerModelId: modelId, providerName: model.displayName, startedAt: new Date().toISOString(),
      resolvedAt: null, severity: 'major' as const, description: `Simulated failure triggered from Provider Health — ${model.displayName} marked unavailable.`,
      failoverTriggered: true, failoverTargetModelId: get().providerModels.find((m) => m.id !== modelId && m.health === 'healthy')?.id,
    }
    const alert: AlertItem = {
      id: uuid(), type: 'failover_triggered', severity: 'critical', title: `Provider failure simulated — ${model.displayName}`,
      description: 'Circuit breaker opened. Future requests will use the configured fallback chain.', timestamp: new Date().toISOString(), read: false,
    }
    set((s) => ({
      providerModels: s.providerModels.map((m) => (m.id === modelId ? { ...m, health: 'unavailable', circuitBreaker: 'open', availabilityPct: 0, lastCheckedAt: new Date().toISOString() } : m)),
      providerIncidents: [incident, ...s.providerIncidents],
      alerts: [alert, ...s.alerts],
    }))
  },

  restoreProvider: (modelId) => set((s) => ({
    providerModels: s.providerModels.map((m) => (m.id === modelId ? { ...m, health: 'healthy', circuitBreaker: 'closed', availabilityPct: 99.9, lastCheckedAt: new Date().toISOString() } : m)),
    providerIncidents: s.providerIncidents.map((i) => (i.providerModelId === modelId && !i.resolvedAt ? { ...i, resolvedAt: new Date().toISOString() } : i)),
  })),

  clearCache: () => set({ cacheEntries: [] }),
  invalidateCacheEntry: (id) => set((s) => ({ cacheEntries: s.cacheEntries.filter((c) => c.id !== id) })),

  markAlertRead: (id) => set((s) => ({ alerts: s.alerts.map((a) => (a.id === id ? { ...a, read: true } : a)) })),
  markAllAlertsRead: () => set((s) => ({ alerts: s.alerts.map((a) => ({ ...a, read: true })) })),
}),
{
  name: 'indusgate_session',
  // currentUser is intentionally excluded: sessions are now backed by a real
  // httpOnly cookie (see bootstrapAuth), not client-persisted state.
  partialize: (state) => ({ currentProjectId: state.currentProjectId }),
}
))

export const keyExpiryPreview = (days: number) => addDays(new Date(), days).toISOString()
