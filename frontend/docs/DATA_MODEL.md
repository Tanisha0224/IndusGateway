# Data Model Proposal — IndusGate AI

The authoritative type definitions live in `src/types/index.ts` and double as this proposal — this
document explains the relationships between them. Field-level detail (types, optionality) should be
read directly from that file, since it is kept in sync with the prototype's mock store.

## Entity relationship overview

```
Organisation
  └─ Department (1:N)
       └─ Team (1:N)
            └─ Project (1:N)
                 └─ VirtualKey (1:N)
                      └─ KeyActivityEvent (1:N)

ProviderModel (independent catalogue, referenced by alias/policy/trace)
  └─ referenced by ModelAlias.primaryModelId / fallbackModelIds[]
  └─ referenced by RoutingPolicy.fallbackChain[] / excludedProviders[]
  └─ referenced by ProviderIncident.providerModelId

ModelAlias
  └─ referenced by VirtualKey.allowedAliasIds[]
  └─ referenced by RequestTrace.modelAliasId

RoutingPolicy
  └─ optionally scoped to Department or Project
  └─ referenced by RequestTrace.routingPolicyId

BudgetPolicy / RateLimitPolicy
  └─ scoped to organisation | department | project | virtual_key (scopeId)

RequestTrace
  └─ produced by a VirtualKey against a ModelAlias
  └─ resolves to a ProviderModel (selectedModelId)
  └─ contains TraceStage[] (ordered, one row per gateway decision point)
  └─ contains PiiDetection[] (zero or more)
  └─ referenced by AuditEvent.traceId and AlertItem.relatedTraceId

AuditEvent
  └─ references an actor (user or virtual key), an action, a resource, and optionally a traceId

CacheEntry
  └─ scoped to a Project

AlertItem
  └─ optionally references a RequestTrace and/or Project

UsageDaily
  └─ organisation-wide daily rollup (requests, tokens, cost, cache-hit rate, error rate, latency, sovereign %)
```

## Key design notes for the backend team

1. **VirtualKey secrets are never persisted in retrievable form.** Only a masked `prefix` (e.g.
   `ig_sk_live_••••••••••••4f92`) is stored for display; the full secret should be returned exactly
   once (creation and rotation responses) and only a hash retained server-side for verification —
   mirroring how the prototype's `fullKeyOnce` field is cleared immediately after the reveal modal
   closes.
2. **RequestTrace.stages is the audit-friendly decomposition of a single gateway request.** Each stage
   name is a fixed enum (`key_validated`, `budget_check`, `pii_scan`, …) so the UI can render a
   consistent timeline regardless of which stages actually ran (some are `skipped` when not
   applicable, e.g. `prompt_masking` when no PII was detected).
3. **Sovereignty and egress are computed, not stored as free text.** `sovereignty` is one of
   `sovereign | india_hosted | external`; `egress` is one of
   `not_applicable | allowed | blocked | masked`. The backend should compute these per-request from
   the selected model's metadata and the PII-scan result — never hardcode a "stays in India" claim for
   any request that used an external provider.
4. **RoutingPolicy scope is optional and mutually exclusive-ish.** A policy may apply organisation-wide
   (`appliesToDepartmentId` and `appliesToProjectId` both unset), to a whole department, or to a single
   project. Policies are evaluated in `priority` order (lower number first); the first enabled,
   matching policy wins.
5. **Budget and RateLimit policies share a `scope` + `scopeId` pattern** so the same table/service can
   represent limits at any level of the org hierarchy without four separate schemas.
6. **AuditEvent.integrityHash is a placeholder for real tamper-evidence.** In production this should be
   a cryptographic hash chain (each event's hash incorporates the previous event's hash) or a
   write-once ledger, not a random string as in this prototype.
