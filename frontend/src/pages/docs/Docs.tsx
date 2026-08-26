import { PageHeader } from '../../components/ui/Misc'
import { Card, CardHeader } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Table, THead, TH, TBody, TR, TD } from '../../components/ui/Table'

const endpoints = [
  { group: 'Authentication', method: 'POST', route: '/v1/auth/session', purpose: 'Demo-only session login; production would use SSO/OIDC.' },
  { group: 'Virtual Keys', method: 'POST', route: '/v1/keys', purpose: 'Create a virtual key scoped to org/dept/team/project.' },
  { group: 'Virtual Keys', method: 'POST', route: '/v1/keys/{id}/rotate', purpose: 'Rotate a key\'s secret, invalidating the previous one.' },
  { group: 'Virtual Keys', method: 'POST', route: '/v1/keys/{id}/revoke', purpose: 'Immediately revoke a key.' },
  { group: 'Virtual Keys', method: 'GET', route: '/v1/keys', purpose: 'List keys with filters (status, project, environment).' },
  { group: 'Organisations', method: 'GET', route: '/v1/organisations/{id}', purpose: 'Fetch organisation, department, team, project hierarchy.' },
  { group: 'Providers & Models', method: 'GET', route: '/v1/providers', purpose: 'List providers and models with health, cost, sovereignty metadata.' },
  { group: 'Model Aliases', method: 'POST', route: '/v1/aliases', purpose: 'Create or update an alias and its fallback chain.' },
  { group: 'Routing Policies', method: 'POST', route: '/v1/routing-policies', purpose: 'Create/update a routing policy (strategy, scope, fallback chain).' },
  { group: 'Budgets', method: 'PUT', route: '/v1/budgets/{id}', purpose: 'Update monthly limit and thresholds for a scope.' },
  { group: 'Rate Limits', method: 'PUT', route: '/v1/rate-limits/{id}', purpose: 'Update RPM/TPM/daily caps for a scope.' },
  { group: 'PII Policies', method: 'GET', route: '/v1/pii-policies', purpose: 'Fetch configured PII detection categories and masking rules.' },
  { group: 'Chat Completions', method: 'POST', route: '/v1/chat/completions', purpose: 'OpenAI-compatible completion endpoint — the core gateway call.' },
  { group: 'Request Traces', method: 'GET', route: '/v1/traces/{traceId}', purpose: 'Fetch the full stage-by-stage trace for a request.' },
  { group: 'Audit Logs', method: 'GET', route: '/v1/audit-events', purpose: 'Query tamper-evident audit records with filters.' },
  { group: 'Provider Health', method: 'GET', route: '/api/provider-health', purpose: 'Current health, circuit-breaker state, and incident history.' },
  { group: 'Cache', method: 'DELETE', route: '/v1/cache', purpose: 'Clear or invalidate semantic cache entries.' },
  { group: 'Usage', method: 'GET', route: '/v1/usage', purpose: 'Aggregated usage by org/department/project/key/provider/model.' },
  { group: 'Billing', method: 'GET', route: '/v1/billing/summary', purpose: 'Spend summary, forecast, and savings estimates.' },
  { group: 'Alerts', method: 'GET', route: '/v1/alerts', purpose: 'List and acknowledge alerts.' },
]

const mocked = [
  'Authentication is a client-side demo login against seeded accounts — no real session tokens or SSO.',
  'Some operational admin modules still use seeded reference data where a backend API has not yet been implemented.',
  'Audit log integrity hashes are randomly generated strings, not real cryptographic signatures.',
]

const backendWork = [
  'A real authentication/authorization layer (OIDC/SSO) issuing signed session tokens and enforcing RBAC server-side.',
  'A request-forwarding gateway service that validates virtual keys, applies policy, and proxies to real provider APIs.',
  'A real PII/NER detection and masking engine with configurable category rules and reversible tokenisation.',
  'Persistent storage (database) for keys, policies, budgets, traces, and audit logs with proper indexing.',
  'A real rate-limiter and budget-enforcement service operating in the request hot path with atomic counters.',
  'Cryptographic signing or hash-chaining for genuinely tamper-evident audit logs.',
  'A real semantic-cache implementation using embedding similarity search with TTL and project isolation.',
  'Provider health-check workers polling real provider endpoints and driving real circuit breakers.',
  'A billing/metering pipeline that reconciles usage against provider invoices.',
]

export default function Docs() {
  return (
    <div>
      <PageHeader title="API Documentation" description="Proposed backend API contract for the IndusGate AI. This prototype's mock service layer mirrors this contract so the backend team can implement against a known shape." />

      <Card className="mb-4">
        <CardHeader title="Sample request" description="OpenAI-compatible chat completion call through a virtual key." />
        <pre className="overflow-x-auto rounded-md bg-navy-ink p-4 font-mono text-caption leading-relaxed text-white/90">{`curl -X POST https://gateway.indusgate.example/v1/chat/completions \\
  -H "Authorization: Bearer ig_sk_live_xxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "indusgate-general",
    "messages": [
      { "role": "user", "content": "Summarise this document." }
    ]
  }'`}</pre>
        <p className="mt-2 text-caption text-navy/45">gateway.indusgate.example is a labelled placeholder domain — replace with the real gateway hostname before production use.</p>
      </Card>

      <Card className="mb-4">
        <CardHeader title="Endpoint reference" description="Method, route, and purpose for each major API surface." />
        <Table>
          <THead><TH>Group</TH><TH>Method</TH><TH>Route</TH><TH>Purpose</TH></THead>
          <TBody>
            {endpoints.map((e, i) => (
              <TR key={i}>
                <TD className="text-navy/60">{e.group}</TD>
                <TD><Badge tone={e.method === 'GET' ? 'navy' : e.method === 'DELETE' ? 'critical' : 'emerald'} icon={false}>{e.method}</Badge></TD>
                <TD mono>{e.route}</TD>
                <TD className="text-navy/70">{e.purpose}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Mocked in this prototype" />
          <ul className="flex flex-col gap-2.5">
            {mocked.map((m, i) => <li key={i} className="flex gap-2 text-table text-navy/70"><span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-saffron" />{m}</li>)}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Required backend implementation" />
          <ul className="flex flex-col gap-2.5">
            {backendWork.map((m, i) => <li key={i} className="flex gap-2 text-table text-navy/70"><span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald" />{m}</li>)}
          </ul>
        </Card>
      </div>
    </div>
  )
}
