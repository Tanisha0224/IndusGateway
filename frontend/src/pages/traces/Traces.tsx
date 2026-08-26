import { useEffect, useMemo, useState } from 'react'
import { PageHeader, SearchBox, Pagination, AlertBanner } from '../../components/ui/Misc'
import { Table, THead, TH, TBody, TR, TD, EmptyState } from '../../components/ui/Table'
import { Badge, EgressBadge } from '../../components/ui/Badge'
import { Select } from '../../components/ui/Form'
import { Drawer } from '../../components/ui/Modal'
import { useIndusGateStore } from '../../lib/store'
import { ApiError } from '../../lib/api/client'
import { dateTime, num, inr } from '../../lib/format'
import type { BackendGatewayRequest } from '../../lib/api/types'

const statusTone: Record<string, 'emerald' | 'critical' | 'saffron'> = {
  completed: 'emerald', blocked: 'critical', budget_blocked: 'critical', error: 'saffron',
}
const statusLabel: Record<string, string> = {
  completed: 'Completed', blocked: 'Blocked by policy', budget_blocked: 'Blocked — budget', error: 'Error',
}
const egressForAction: Record<string, 'allowed' | 'masked' | 'blocked'> = {
  allow: 'allowed', mask_and_allow: 'masked', block: 'blocked',
}

export default function Traces() {
  const gatewayRequests = useIndusGateStore((s) => s.gatewayRequests)
  const realProjects = useIndusGateStore((s) => s.realProjects)
  const realVirtualKeys = useIndusGateStore((s) => s.realVirtualKeys)
  const realProviders = useIndusGateStore((s) => s.realProviders)
  const fetchGatewayRequests = useIndusGateStore((s) => s.fetchGatewayRequests)
  const fetchRealProjects = useIndusGateStore((s) => s.fetchRealProjects)
  const fetchRealVirtualKeys = useIndusGateStore((s) => s.fetchRealVirtualKeys)
  const fetchRealProviders = useIndusGateStore((s) => s.fetchRealProviders)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<BackendGatewayRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const pageSize = 12

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchGatewayRequests(), fetchRealProjects(), fetchRealVirtualKeys(), fetchRealProviders()])
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'Failed to load request traces.'))
      .finally(() => setLoading(false))
  }, [fetchGatewayRequests, fetchRealProjects, fetchRealVirtualKeys, fetchRealProviders])

  function projectName(id: string) { return realProjects.find((p) => p.id === id)?.name ?? '—' }
  function keyPrefix(id: string) { return realVirtualKeys.find((k) => k.id === id)?.key_prefix ?? '—' }
  function providerName(id: string | null) { return id ? realProviders.find((p) => p.id === id)?.name ?? '—' : '—' }

  const filtered = useMemo(() => gatewayRequests.filter((t) => {
    if (statusFilter !== 'all' && t.request_status !== statusFilter) return false
    if (search) {
      const project = realProjects.find((p) => p.id === t.project_id)
      const matchesProject = project?.name.toLowerCase().includes(search.toLowerCase())
      const matchesModel = t.model_requested.toLowerCase().includes(search.toLowerCase())
      if (!matchesProject && !matchesModel) return false
    }
    return true
  }), [gatewayRequests, search, statusFilter, realProjects])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div>
      <PageHeader title="Request Traces" description="Every request made with a virtual key generates a trace showing what was detected, what policy decided, and what was actually sent to the provider." />

      {loadError && <div className="mb-4"><AlertBanner kind="error" title="Something went wrong">{loadError}</AlertBanner></div>}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchBox value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search project or model…" />
        <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} className="w-auto" aria-label="Filter by status">
          <option value="all">All statuses</option>
          <option value="completed">Completed</option>
          <option value="blocked">Blocked by policy</option>
          <option value="budget_blocked">Blocked — budget</option>
          <option value="error">Error</option>
        </Select>
      </div>

      {loading ? (
        <div className="rounded-lg border border-navy/10 bg-white py-20 text-center text-table text-navy/50">Loading traces…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-navy/10 bg-white"><EmptyState title="No requests matched your filters" description="Try clearing filters, or send a request through the gateway using a virtual key to generate a new trace." /></div>
      ) : (
        <Table>
          <THead><TH>Time</TH><TH>Project</TH><TH>Key</TH><TH>Model</TH><TH>Egress</TH><TH>Detected PII</TH><TH align="right">Tokens</TH><TH align="right">Cost</TH><TH>Status</TH></THead>
          <TBody>
            {pageItems.map((t) => (
              <TR key={t.id} onClick={() => setDetail(t)}>
                <TD className="text-navy/60">{dateTime(t.created_at)}</TD>
                <TD>{projectName(t.project_id)}</TD>
                <TD mono>{keyPrefix(t.virtual_key_id)}…</TD>
                <TD>{t.model_requested}</TD>
                <TD><EgressBadge status={egressForAction[t.policy_action]} /></TD>
                <TD>{t.detected_pii_types.length > 0 ? <Badge tone="gold" icon={false}>{t.detected_pii_types.length} type(s)</Badge> : '—'}</TD>
                <TD align="right">{t.total_tokens != null ? num(t.total_tokens) : '—'}</TD>
                <TD align="right">{t.estimated_cost_inr != null ? inr(t.estimated_cost_inr, 4) : '—'}</TD>
                <TD><Badge tone={statusTone[t.request_status]}>{statusLabel[t.request_status]}</Badge></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      {!loading && filtered.length > 0 && <div className="rounded-b-lg border border-t-0 border-navy/10 bg-white"><Pagination page={page} pageCount={pageCount} onChange={setPage} totalItems={filtered.length} pageSize={pageSize} /></div>}

      <Drawer open={!!detail} onClose={() => setDetail(null)} title={detail ? dateTime(detail.created_at) : ''} width="w-[640px]">
        {detail && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap gap-2">
              <Badge tone={statusTone[detail.request_status]}>{statusLabel[detail.request_status]}</Badge>
              <EgressBadge status={egressForAction[detail.policy_action]} />
              {detail.provider_response_status != null && <Badge tone={detail.provider_response_status < 400 ? 'emerald' : 'critical'} icon={false}>Provider HTTP {detail.provider_response_status}</Badge>}
            </div>

            <dl className="grid grid-cols-2 gap-4 text-table">
              <div><dt className="text-caption text-navy/50">Virtual key</dt><dd className="font-mono text-caption font-medium text-navy-ink">{keyPrefix(detail.virtual_key_id)}…</dd></div>
              <div><dt className="text-caption text-navy/50">Project</dt><dd className="font-medium text-navy-ink">{projectName(detail.project_id)}</dd></div>
              <div><dt className="text-caption text-navy/50">Model requested</dt><dd className="font-medium text-navy-ink">{detail.model_requested}</dd></div>
              <div><dt className="text-caption text-navy/50">Model routed</dt><dd className="font-medium text-navy-ink">{detail.model_routed ?? '—'}</dd></div>
              <div><dt className="text-caption text-navy/50">Provider</dt><dd className="font-medium text-navy-ink">{providerName(detail.provider_id)}</dd></div>
              <div><dt className="text-caption text-navy/50">Policy decision</dt><dd className="font-medium capitalize text-navy-ink">{detail.policy_action.replace(/_/g, ' ')}</dd></div>
              <div><dt className="text-caption text-navy/50">Fields masked</dt><dd className="font-medium text-navy-ink">{detail.masked_fields_count}</dd></div>
              <div><dt className="text-caption text-navy/50">Privacy action</dt><dd className="font-medium capitalize text-navy-ink">{(detail.privacy_action ?? detail.policy_action).replace(/_/g, ' ')}</dd></div>
              <div><dt className="text-caption text-navy/50">PII entities</dt><dd className="font-medium text-navy-ink">{detail.pii_entity_count ?? detail.detected_pii_types.length}</dd></div>
              <div><dt className="text-caption text-navy/50">Response scan</dt><dd className="font-medium text-navy-ink">{detail.response_scan_performed ? 'Performed' : 'Not performed'}</dd></div>
              <div><dt className="text-caption text-navy/50">Restoration</dt><dd className="font-medium text-navy-ink">{detail.restoration_applied ? `Yes (${detail.restored_entity_count ?? 0})` : 'Disabled'}</dd></div>
              <div><dt className="text-caption text-navy/50">Privacy latency</dt><dd className="font-medium text-navy-ink">{detail.privacy_processing_ms != null ? `${detail.privacy_processing_ms} ms` : 'â€”'}</dd></div>
              <div><dt className="text-caption text-navy/50">Detector</dt><dd className="font-medium text-navy-ink">{detail.detector_version ?? 'â€”'}</dd></div>
              <div><dt className="text-caption text-navy/50">Tokens</dt><dd className="font-medium text-navy-ink">{detail.total_tokens != null ? `${num(detail.prompt_tokens ?? 0)} prompt + ${num(detail.completion_tokens ?? 0)} completion = ${num(detail.total_tokens)}` : '—'}</dd></div>
              <div><dt className="text-caption text-navy/50">Estimated cost</dt><dd className="font-medium text-navy-ink">{detail.estimated_cost_inr != null ? inr(detail.estimated_cost_inr, 4) : '—'}</dd></div>
              <div><dt className="text-caption text-navy/50">Started</dt><dd className="font-medium text-navy-ink">{dateTime(detail.created_at)}</dd></div>
              <div><dt className="text-caption text-navy/50">Completed</dt><dd className="font-medium text-navy-ink">{detail.completed_at ? dateTime(detail.completed_at) : '—'}</dd></div>
            </dl>

            {(detail.requested_public_alias || detail.routing_reason) && (
              <div className="rounded-lg border border-[#4285F4]/20 bg-[#F8FAFF] p-4">
                <div className="mb-3 text-table font-semibold text-navy-ink">Routing decision</div>
                <dl className="grid grid-cols-2 gap-4 text-table">
                  <div><dt className="text-caption text-navy/50">Public alias</dt><dd className="font-mono text-caption font-medium text-navy-ink">{detail.requested_public_alias ?? detail.model_requested}</dd></div>
                  <div><dt className="text-caption text-navy/50">Selected provider</dt><dd className="font-medium text-navy-ink">{providerName(detail.selected_provider_id ?? detail.provider_id)}</dd></div>
                  <div><dt className="text-caption text-navy/50">Sovereignty mode</dt><dd className="font-medium text-navy-ink">{detail.sovereignty_mode?.replace(/_/g, ' ') ?? '—'}</dd></div>
                  <div><dt className="text-caption text-navy/50">External egress</dt><dd className="font-medium text-navy-ink">{detail.external_egress_allowed ? 'Allowed' : 'Blocked'}</dd></div>
                  <div><dt className="text-caption text-navy/50">Attempts</dt><dd className="font-medium text-navy-ink">{detail.attempt_count ?? 0}</dd></div>
                  <div><dt className="text-caption text-navy/50">Fallback used</dt><dd className="font-medium text-navy-ink">{detail.fallback_used ? 'Yes' : 'No'}</dd></div>
                </dl>
                {detail.routing_reason && <p className="mt-3 text-table text-navy/64">{detail.routing_reason}</p>}
                {detail.matched_routing_policy_ids && detail.matched_routing_policy_ids.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {detail.matched_routing_policy_ids.map((id) => <Badge key={id} tone="gold" icon={false}>{id}</Badge>)}
                  </div>
                )}
                {detail.provider_failure_categories && detail.provider_failure_categories.length > 0 && (
                  <div className="mt-3 text-caption text-navy/55">Provider failures: {detail.provider_failure_categories.join(', ')}</div>
                )}
              </div>
            )}

            {detail.stream_requested && (
              <div className="rounded-lg border border-[#34A853]/20 bg-[#F7FFF9] p-4">
                <div className="mb-3 text-table font-semibold text-navy-ink">Secure streaming</div>
                <dl className="grid grid-cols-2 gap-4 text-table">
                  <div><dt className="text-caption text-navy/50">Mode</dt><dd className="font-medium text-navy-ink">{detail.stream_mode === 'buffered' ? 'Buffered privacy' : 'Standard'}</dd></div>
                  <div><dt className="text-caption text-navy/50">Provider chunks</dt><dd className="font-medium text-navy-ink">{detail.provider_chunk_count ?? 0}</dd></div>
                  <div><dt className="text-caption text-navy/50">Buffered characters</dt><dd className="font-medium text-navy-ink">{detail.buffered_character_count ?? 0}</dd></div>
                  <div><dt className="text-caption text-navy/50">Response action</dt><dd className="font-medium capitalize text-navy-ink">{(detail.response_privacy_action ?? 'allow').replace(/_/g, ' ')}</dd></div>
                  <div><dt className="text-caption text-navy/50">Client disconnected</dt><dd className="font-medium text-navy-ink">{detail.client_disconnected ? 'Yes' : 'No'}</dd></div>
                  <div><dt className="text-caption text-navy/50">Status</dt><dd className="font-medium text-navy-ink">{detail.stream_completed ? 'Completed' : detail.stream_error_code ?? 'Pending'}</dd></div>
                </dl>
              </div>
            )}

            {(detail.pii_types ?? detail.detected_pii_types).length > 0 && (
              <div>
                <div className="mb-1.5 text-table font-semibold text-navy-ink">PII types detected</div>
                <div className="flex flex-wrap gap-1.5">
                  {(detail.pii_types ?? detail.detected_pii_types).map((type) => <Badge key={type} tone="critical" icon={false}>{type.replace(/_/g, ' ')}</Badge>)}
                </div>
              </div>
            )}

            {detail.response_pii_types && detail.response_pii_types.length > 0 && (
              <div>
                <div className="mb-1.5 text-table font-semibold text-navy-ink">Response PII masked</div>
                <div className="flex flex-wrap gap-1.5">
                  {detail.response_pii_types.map((type) => <Badge key={type} tone="gold" icon={false}>{type.replace(/_/g, ' ')}</Badge>)}
                </div>
              </div>
            )}

            {detail.sanitized_prompt && (
              <div>
                <div className="mb-1.5 text-table font-semibold text-navy-ink">Sanitized prompt sent to provider</div>
                <p className="whitespace-pre-wrap rounded-md border border-navy/10 bg-ivory px-3.5 py-2.5 text-table text-navy/75">{detail.sanitized_prompt}</p>
                <p className="mt-1.5 text-caption text-navy/45">This is exactly what left the gateway. Original values behind any placeholders above remain encrypted in local storage.</p>
              </div>
            )}

            {detail.request_status === 'blocked' && (
              <AlertBanner kind="warning" title="Request blocked before egress">
                This project's policy does not permit this data to leave the gateway. No provider call was made.
              </AlertBanner>
            )}
            {detail.request_status === 'budget_blocked' && (
              <AlertBanner kind="warning" title="Request blocked — budget exceeded">
                This project had already reached its monthly budget limit. No provider call was made.
              </AlertBanner>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}
