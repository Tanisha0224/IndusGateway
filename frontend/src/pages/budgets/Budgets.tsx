import { useEffect, useState } from 'react'
import { PageHeader, AlertBanner, Tabs } from '../../components/ui/Misc'
import { Card, CardHeader } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Field, Select, TextInput } from '../../components/ui/Form'
import { useIndusGateStore } from '../../lib/store'
import { ApiError } from '../../lib/api/client'
import * as rateLimitsApi from '../../lib/api/rateLimits'
import { inr, pct, dateTime } from '../../lib/format'
import { Table, THead, TH, TBody, TR, TD, EmptyState } from '../../components/ui/Table'
import type { BackendRateLimitPolicy, BackendUsageSummaryRow } from '../../lib/api/types'

const statusTone: Record<string, 'emerald' | 'saffron' | 'critical' | 'neutral'> = {
  ok: 'emerald', warning: 'saffron', exceeded: 'critical', unlimited: 'neutral',
}
const statusLabel: Record<string, string> = {
  ok: 'Within budget', warning: 'Approaching limit', exceeded: 'Hard limit reached', unlimited: 'No limit set',
}

const emptyRateDraft = {
  name: '',
  scope: 'project' as BackendRateLimitPolicy['scope'],
  scope_id: '',
  requests_per_minute: '',
  tokens_per_minute: '',
  max_concurrent_requests: '',
}

export default function Budgets() {
  const usageSummary = useIndusGateStore((s) => s.usageSummary)
  const fetchUsageSummary = useIndusGateStore((s) => s.fetchUsageSummary)
  const gatewayRequests = useIndusGateStore((s) => s.gatewayRequests)
  const fetchGatewayRequests = useIndusGateStore((s) => s.fetchGatewayRequests)
  const realProjects = useIndusGateStore((s) => s.realProjects)
  const fetchRealProjects = useIndusGateStore((s) => s.fetchRealProjects)
  const updateRealProject = useIndusGateStore((s) => s.updateRealProject)

  const [tab, setTab] = useState('budgets')
  const [editing, setEditing] = useState<BackendUsageSummaryRow | null>(null)
  const [editingRate, setEditingRate] = useState<BackendRateLimitPolicy | null>(null)
  const [creatingRate, setCreatingRate] = useState(false)
  const [newLimit, setNewLimit] = useState('')
  const [rateDraft, setRateDraft] = useState(emptyRateDraft)
  const [rateLimitPolicies, setRateLimitPolicies] = useState<BackendRateLimitPolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchUsageSummary(), fetchGatewayRequests(), fetchRealProjects(), rateLimitsApi.listRateLimits().then(setRateLimitPolicies)])
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'Failed to load budgets.'))
      .finally(() => setLoading(false))
  }, [fetchUsageSummary, fetchGatewayRequests, fetchRealProjects])

  const budgetBlocked = gatewayRequests.filter((r) => r.request_status === 'budget_blocked')
  const rateNumbersValid = Number(rateDraft.requests_per_minute) >= 1 && Number(rateDraft.tokens_per_minute) >= 1 && Number(rateDraft.max_concurrent_requests) >= 1

  async function saveLimit(inrValue: number | null) {
    if (!editing) return
    setSaving(true)
    try {
      await updateRealProject(editing.project_id, { monthly_budget_inr: inrValue })
      await fetchUsageSummary()
      setEditing(null)
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to update budget.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader title="Budgets & Rate Limits" description="Real monthly spend ceilings per project, enforced by the gateway — a project over budget is blocked before any provider is called." />
      <Tabs tabs={[{ id: 'budgets', label: 'Budget policies' }, { id: 'rates', label: 'Rate limits' }, { id: 'history', label: 'Enforcement history' }]} active={tab} onChange={setTab} />

      {loadError && <div className="mt-4"><AlertBanner kind="error" title="Something went wrong">{loadError}</AlertBanner></div>}

      <div className="mt-5">
        {tab === 'budgets' && (
          loading ? (
            <div className="rounded-lg border border-navy/10 bg-white py-16 text-center text-table text-navy/50">Loading budgets…</div>
          ) : usageSummary.length === 0 ? (
            <div className="rounded-lg border border-navy/10 bg-white"><EmptyState title="No projects yet" description="Create a project from the Virtual Keys page to set a budget for it." /></div>
          ) : (
            <div className="flex flex-col gap-4">
              {usageSummary.map((b) => {
                const util = b.monthly_budget_inr ? Math.min(1, b.spend_this_month_inr / b.monthly_budget_inr) : 0
                return (
                  <Card key={b.project_id}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge tone={statusTone[b.budget_status]}>{statusLabel[b.budget_status]}</Badge>
                        </div>
                        <h3 className="mt-0.5 font-heading text-h3 font-semibold text-navy-ink">{b.project_name}</h3>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(b); setNewLimit(b.monthly_budget_inr != null ? String(b.monthly_budget_inr) : '') }}>
                        {b.monthly_budget_inr != null ? 'Edit limit' : 'Set limit'}
                      </Button>
                    </div>
                    {b.monthly_budget_inr != null && (
                      <div className="mt-4">
                        <div className="mb-1.5 flex justify-between text-table">
                          <span className="font-medium text-navy-ink tnum">{inr(b.spend_this_month_inr, 4)} of {inr(b.monthly_budget_inr)}</span>
                          <span className="tnum text-navy/60">{pct(util)}</span>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-navy/8">
                          <div className={`h-full rounded-full ${b.budget_status === 'exceeded' ? 'bg-critical' : b.budget_status === 'warning' ? 'bg-saffron' : 'bg-emerald'}`} style={{ width: `${util * 100}%` }} />
                        </div>
                      </div>
                    )}
                    {b.monthly_budget_inr == null && (
                      <p className="mt-3 text-table text-navy/50">This project has no spend limit — requests are never blocked for budget reasons.</p>
                    )}
                    {b.budget_status === 'exceeded' && (
                      <div className="mt-3">
                        <AlertBanner kind="error" title="New requests are being blocked">
                          This project reached its monthly budget limit. Requests are rejected before being forwarded to any provider. Raise the limit or wait for next month to resume service.
                        </AlertBanner>
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          )
        )}

        {tab === 'rates' && (
          <>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1">
                <AlertBanner kind="ai" title="Redis-enforced when available">
                  These limits are enforced in the gateway hot path with Redis counters. If an enabled policy exists and Redis is unavailable, requests fail closed.
                </AlertBanner>
              </div>
              <Button size="sm" onClick={() => { setCreatingRate(true); setRateDraft(emptyRateDraft) }}>New policy</Button>
            </div>
            <Table>
              <THead><TH>Policy</TH><TH>Scope</TH><TH>Status</TH><TH align="right">Requests/min</TH><TH align="right">Tokens/min</TH><TH align="right">Concurrent</TH><TH>Actions</TH></THead>
              <TBody>
                {rateLimitPolicies.map((r) => (
                  <TR key={r.id}>
                    <TD><div className="font-medium text-navy-ink">{r.name}</div><div className="font-mono text-caption text-navy/45">{r.id}</div></TD>
                    <TD><div className="capitalize">{r.scope.replace('_', ' ')}</div><div className="font-mono text-caption text-navy/45">{r.scope_id}</div></TD>
                    <TD><Badge tone={r.enabled ? 'emerald' : 'neutral'}>{r.enabled ? 'Enabled' : 'Disabled'}</Badge></TD>
                    <TD align="right">{r.requests_per_minute}</TD>
                    <TD align="right">{r.tokens_per_minute.toLocaleString()}</TD>
                    <TD align="right">{r.max_concurrent_requests}</TD>
                    <TD>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => { setEditingRate(r); setRateDraft({ name: r.name, scope: r.scope, scope_id: r.scope_id, requests_per_minute: String(r.requests_per_minute), tokens_per_minute: String(r.tokens_per_minute), max_concurrent_requests: String(r.max_concurrent_requests) }) }}>Edit</Button>
                        <Button size="sm" variant={r.enabled ? 'ghost' : 'confirm'} onClick={async () => { r.enabled ? await rateLimitsApi.disableRateLimit(r.id) : await rateLimitsApi.enableRateLimit(r.id); setRateLimitPolicies(await rateLimitsApi.listRateLimits()) }}>{r.enabled ? 'Disable' : 'Enable'}</Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </>
        )}

        {tab === 'history' && (
          <Card>
            <CardHeader title="Budget enforcement history" description="Real gateway requests rejected because their project had already reached its monthly budget limit." />
            {budgetBlocked.length === 0 ? (
              <p className="text-table text-navy/55">No requests have been blocked for budget reasons yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {budgetBlocked.map((r) => {
                  const project = realProjects.find((p) => p.id === r.project_id)
                  return (
                    <div key={r.id} className="flex items-center justify-between border-b border-navy/8 pb-3 last:border-0">
                      <div>
                        <div className="text-table font-medium text-navy-ink">{project?.name ?? r.project_id}</div>
                        <div className="text-caption text-navy/50">{dateTime(r.created_at)} · model requested: {r.model_requested}</div>
                      </div>
                      <Badge tone="critical">Blocked — budget</Badge>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        )}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Edit budget — ${editing?.project_name ?? ''}`} size="sm" footer={
        <>
          <Button variant="ghost" onClick={() => saveLimit(null)} disabled={saving}>Remove limit</Button>
          <Button onClick={() => saveLimit(newLimit.trim() === '' ? null : Number(newLimit))} loading={saving}>Save limit</Button>
        </>
      }>
        <Field label="Monthly budget limit (INR)" helper="Leave blank and click Remove limit for unlimited spend.">
          <TextInput type="number" min={0} step={0.01} value={newLimit} onChange={(e) => setNewLimit(e.target.value)} placeholder="e.g. 500" />
        </Field>
      </Modal>
      <Modal open={!!editingRate} onClose={() => setEditingRate(null)} title={`Edit rate limit - ${editingRate?.name ?? ''}`} size="sm" footer={
        <>
          <Button variant="ghost" onClick={() => setEditingRate(null)} disabled={saving}>Cancel</Button>
          <Button onClick={async () => {
            if (!editingRate) return
            setSaving(true)
            try {
              await rateLimitsApi.updateRateLimit(editingRate.id, {
                name: rateDraft.name.trim() || editingRate.name,
                requests_per_minute: Number(rateDraft.requests_per_minute),
                tokens_per_minute: Number(rateDraft.tokens_per_minute),
                max_concurrent_requests: Number(rateDraft.max_concurrent_requests),
              })
              setRateLimitPolicies(await rateLimitsApi.listRateLimits())
              setEditingRate(null)
            } finally {
              setSaving(false)
            }
          }} loading={saving} disabled={!rateNumbersValid}>Save limits</Button>
        </>
      }>
        <div className="grid gap-3">
          <Field label="Policy name" required><TextInput value={rateDraft.name} onChange={(e) => setRateDraft((d) => ({ ...d, name: e.target.value }))} /></Field>
          <Field label="Requests per minute" required><TextInput type="number" min={1} value={rateDraft.requests_per_minute} onChange={(e) => setRateDraft((d) => ({ ...d, requests_per_minute: e.target.value }))} /></Field>
          <Field label="Tokens per minute" required><TextInput type="number" min={1} value={rateDraft.tokens_per_minute} onChange={(e) => setRateDraft((d) => ({ ...d, tokens_per_minute: e.target.value }))} /></Field>
          <Field label="Maximum concurrent requests" required><TextInput type="number" min={1} value={rateDraft.max_concurrent_requests} onChange={(e) => setRateDraft((d) => ({ ...d, max_concurrent_requests: e.target.value }))} /></Field>
        </div>
      </Modal>
      <Modal open={creatingRate} onClose={() => setCreatingRate(false)} title="New rate limit policy" size="sm" footer={
        <>
          <Button variant="ghost" onClick={() => setCreatingRate(false)} disabled={saving}>Cancel</Button>
          <Button onClick={async () => {
            setSaving(true)
            try {
              await rateLimitsApi.createRateLimit({
                name: rateDraft.name.trim(),
                scope: rateDraft.scope,
                scope_id: rateDraft.scope_id.trim(),
                enabled: false,
                requests_per_minute: Number(rateDraft.requests_per_minute),
                tokens_per_minute: Number(rateDraft.tokens_per_minute),
                max_concurrent_requests: Number(rateDraft.max_concurrent_requests),
              })
              setRateLimitPolicies(await rateLimitsApi.listRateLimits())
              setCreatingRate(false)
            } finally {
              setSaving(false)
            }
          }} loading={saving} disabled={!rateDraft.name.trim() || !rateDraft.scope_id.trim() || !rateNumbersValid}>Create policy</Button>
        </>
      }>
        <div className="grid gap-3">
          <Field label="Policy name" required><TextInput value={rateDraft.name} onChange={(e) => setRateDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Knowledge project throttle" /></Field>
          <Field label="Scope" required>
            <Select value={rateDraft.scope} onChange={(e) => setRateDraft((d) => ({ ...d, scope: e.target.value as BackendRateLimitPolicy['scope'] }))}>
              <option value="project">Project</option>
              <option value="virtual_key">Virtual key</option>
              <option value="model_alias">Model alias</option>
            </Select>
          </Field>
          <Field label="Scope id" required helper="Use a project id, virtual key id, or public model alias.">
            <TextInput value={rateDraft.scope_id} onChange={(e) => setRateDraft((d) => ({ ...d, scope_id: e.target.value }))} placeholder="proj-knowledge" />
          </Field>
          <Field label="Requests per minute" required><TextInput type="number" min={1} value={rateDraft.requests_per_minute} onChange={(e) => setRateDraft((d) => ({ ...d, requests_per_minute: e.target.value }))} /></Field>
          <Field label="Tokens per minute" required><TextInput type="number" min={1} value={rateDraft.tokens_per_minute} onChange={(e) => setRateDraft((d) => ({ ...d, tokens_per_minute: e.target.value }))} /></Field>
          <Field label="Maximum concurrent requests" required><TextInput type="number" min={1} value={rateDraft.max_concurrent_requests} onChange={(e) => setRateDraft((d) => ({ ...d, max_concurrent_requests: e.target.value }))} /></Field>
        </div>
      </Modal>
    </div>
  )
}
