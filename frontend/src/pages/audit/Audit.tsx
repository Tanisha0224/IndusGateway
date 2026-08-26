import { useEffect, useMemo, useState } from 'react'
import { PageHeader, SearchBox, Pagination, AlertBanner } from '../../components/ui/Misc'
import { Table, THead, TH, TBody, TR, TD, EmptyState } from '../../components/ui/Table'
import { Badge } from '../../components/ui/Badge'
import { Drawer } from '../../components/ui/Modal'
import { useIndusGateStore } from '../../lib/store'
import { ApiError } from '../../lib/api/client'
import { dateTime } from '../../lib/format'
import type { BackendAuditLog } from '../../lib/api/types'
import { Icon } from '../../components/ui/Icons'

const actorTone: Record<string, 'navy' | 'teal' | 'neutral'> = { user: 'navy', virtual_key: 'teal', system: 'neutral' }

export default function Audit() {
  const realAuditLogs = useIndusGateStore((s) => s.realAuditLogs)
  const auditLogsAccessDenied = useIndusGateStore((s) => s.auditLogsAccessDenied)
  const fetchRealAuditLogs = useIndusGateStore((s) => s.fetchRealAuditLogs)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<BackendAuditLog | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const pageSize = 14

  useEffect(() => {
    setLoading(true)
    fetchRealAuditLogs()
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'Failed to load audit logs.'))
      .finally(() => setLoading(false))
  }, [fetchRealAuditLogs])

  const filtered = useMemo(() => realAuditLogs.filter((e) => {
    if (search && !e.action.toLowerCase().includes(search.toLowerCase()) && !e.resource_type.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [realAuditLogs, search])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div>
      <PageHeader title="Audit Logs" description="Every gateway decision and admin action is recorded here — who did what, to what resource, and when." />

      {auditLogsAccessDenied ? (
        <div className="rounded-lg border border-navy/10 bg-white px-6 py-16 text-center">
          <div className="mb-3 flex justify-center"><Icon.Lock className="h-8 w-8 text-navy/30" /></div>
          <h3 className="font-heading text-h3 font-semibold text-navy-ink">Admin access required</h3>
          <p className="mx-auto mt-2 max-w-md text-body text-navy/60">Audit logs span every project in IndusGate AI, so only Platform Admins can view them. Sign in as an admin account to see this data.</p>
        </div>
      ) : (
        <>
          {loadError && <div className="mb-4"><AlertBanner kind="error" title="Something went wrong">{loadError}</AlertBanner></div>}

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <SearchBox value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search action or resource type…" />
          </div>

          {loading ? (
            <div className="rounded-lg border border-navy/10 bg-white py-20 text-center text-table text-navy/50">Loading audit logs…</div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-navy/10 bg-white"><EmptyState title="No audit events match your search" description="Actions across virtual keys, providers, projects, and gateway requests all appear here." /></div>
          ) : (
            <Table>
              <THead><TH>Timestamp</TH><TH>Actor</TH><TH>Action</TH><TH>Resource type</TH></THead>
              <TBody>
                {pageItems.map((e) => (
                  <TR key={e.id} onClick={() => setDetail(e)}>
                    <TD className="text-navy/60">{dateTime(e.created_at)}</TD>
                    <TD><Badge tone={actorTone[e.actor_type] ?? 'neutral'} icon={false}>{e.actor_type.replace('_', ' ')}</Badge></TD>
                    <TD mono>{e.action}</TD>
                    <TD>{e.resource_type}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
          {!loading && filtered.length > 0 && <div className="rounded-b-lg border border-t-0 border-navy/10 bg-white"><Pagination page={page} pageCount={pageCount} onChange={setPage} totalItems={filtered.length} pageSize={pageSize} /></div>}
        </>
      )}

      <Drawer open={!!detail} onClose={() => setDetail(null)} title="Audit event detail">
        {detail && (
          <div className="flex flex-col gap-5">
            <Badge tone={actorTone[detail.actor_type] ?? 'neutral'} icon={false}>{detail.actor_type.replace('_', ' ')}</Badge>
            <dl className="grid grid-cols-2 gap-4 text-table">
              <div><dt className="text-caption text-navy/50">Timestamp</dt><dd className="font-medium text-navy-ink">{dateTime(detail.created_at)}</dd></div>
              <div><dt className="text-caption text-navy/50">Actor ID</dt><dd className="font-mono text-caption font-medium text-navy-ink">{detail.actor_id ?? '—'}</dd></div>
              <div><dt className="text-caption text-navy/50">Action</dt><dd className="font-mono text-caption font-medium text-navy-ink">{detail.action}</dd></div>
              <div><dt className="text-caption text-navy/50">Resource type</dt><dd className="font-medium text-navy-ink">{detail.resource_type}</dd></div>
              <div><dt className="text-caption text-navy/50">Resource ID</dt><dd className="break-all font-mono text-caption font-medium text-navy-ink">{detail.resource_id ?? '—'}</dd></div>
            </dl>
            {detail.metadata_json && (
              <div>
                <div className="mb-1.5 text-table font-semibold text-navy-ink">Metadata</div>
                <pre className="overflow-x-auto rounded-md border border-navy/10 bg-ivory px-3.5 py-2.5 text-caption text-navy/75">{JSON.stringify(detail.metadata_json, null, 2)}</pre>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}
