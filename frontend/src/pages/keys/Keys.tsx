import { useEffect, useMemo, useState } from 'react'
import { PageHeader, SearchBox, Pagination, AlertBanner } from '../../components/ui/Misc'
import { Table, THead, TH, TBody, TR, TD, EmptyState } from '../../components/ui/Table'
import { Badge, KeyStatusBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Modal, ConfirmDialog, Drawer } from '../../components/ui/Modal'
import { Field, TextInput, Select, Checkbox } from '../../components/ui/Form'
import { Icon } from '../../components/ui/Icons'
import { useIndusGateStore } from '../../lib/store'
import { ApiError } from '../../lib/api/client'
import { listProviderModels } from '../../lib/api/providers'
import { dateShort, dateTime } from '../../lib/format'
import type { BackendVirtualKey } from '../../lib/api/types'
import { keyExpiryPreview } from '../../lib/store'

export default function Keys() {
  const realVirtualKeys = useIndusGateStore((s) => s.realVirtualKeys)
  const realProjects = useIndusGateStore((s) => s.realProjects)
  const fetchRealVirtualKeys = useIndusGateStore((s) => s.fetchRealVirtualKeys)
  const fetchRealProjects = useIndusGateStore((s) => s.fetchRealProjects)
  const fetchRealProviders = useIndusGateStore((s) => s.fetchRealProviders)
  const fetchRealPolicies = useIndusGateStore((s) => s.fetchRealPolicies)
  const rotateRealVirtualKey = useIndusGateStore((s) => s.rotateRealVirtualKey)
  const revokeRealVirtualKey = useIndusGateStore((s) => s.revokeRealVirtualKey)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const pageSize = 8

  const [createOpen, setCreateOpen] = useState(false)
  const [revealKey, setRevealKey] = useState<{ full: string; key: BackendVirtualKey } | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ type: 'revoke' | 'rotate'; key: BackendVirtualKey } | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [detailKey, setDetailKey] = useState<BackendVirtualKey | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchRealVirtualKeys(), fetchRealProjects(), fetchRealProviders(), fetchRealPolicies()])
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'Failed to load virtual keys.'))
      .finally(() => setLoading(false))
  }, [fetchRealVirtualKeys, fetchRealProjects, fetchRealProviders, fetchRealPolicies])

  const filtered = useMemo(() => {
    return realVirtualKeys.filter((k) => {
      if (statusFilter !== 'all' && k.status !== statusFilter) return false
      if (search && !k.key_prefix.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [realVirtualKeys, statusFilter, search])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize)

  function projectName(id: string) { return realProjects.find((p) => p.id === id)?.name ?? '—' }

  async function handleRotate(key: BackendVirtualKey) {
    setActionLoading(true)
    try {
      const result = await rotateRealVirtualKey(key.id)
      setConfirmAction(null)
      setRevealKey({ full: result.fullKey, key: result.virtualKey })
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to rotate key.')
      setConfirmAction(null)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleRevoke(key: BackendVirtualKey) {
    setActionLoading(true)
    try {
      await revokeRealVirtualKey(key.id)
      setConfirmAction(null)
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to revoke key.')
      setConfirmAction(null)
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Virtual Keys"
        description="Issue virtual API keys scoped to a project. Your application uses this key instead of a real provider key — IndusGate AI authenticates it, applies policy, and forwards only sanitized prompts."
        action={<Button onClick={() => setCreateOpen(true)}><Icon.Plus className="h-4 w-4" />Create virtual key</Button>}
      />

      {loadError && <div className="mb-4"><AlertBanner kind="error" title="Something went wrong">{loadError}</AlertBanner></div>}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchBox value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search by key prefix…" />
        <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} className="w-auto" aria-label="Filter by status">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="revoked">Revoked</option>
        </Select>
      </div>

      {loading ? (
        <div className="rounded-lg border border-navy/10 bg-white py-20 text-center text-table text-navy/50">Loading virtual keys…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-navy/10 bg-white">
          <EmptyState title="No virtual keys match your filters" description="Try clearing filters, or create a new virtual key for a project." action={<Button onClick={() => setCreateOpen(true)} size="sm">Create virtual key</Button>} />
        </div>
      ) : (
        <Table>
          <THead>
            <TH>Key</TH><TH>Project</TH><TH>Status</TH><TH>Allowed models</TH><TH>Created</TH><TH>Expires</TH><TH align="right">Actions</TH>
          </THead>
          <TBody>
            {pageItems.map((k) => (
              <TR key={k.id}>
                <TD>
                  <button onClick={() => setDetailKey(k)} className="text-left font-mono text-table font-semibold text-navy-ink hover:text-saffron-deep">
                    {k.key_prefix}…
                  </button>
                </TD>
                <TD>{projectName(k.project_id)}</TD>
                <TD><KeyStatusBadge status={k.status} /></TD>
                <TD className="max-w-[220px] truncate">{k.allowed_model_aliases.join(', ') || 'Any'}</TD>
                <TD className="text-navy/60">{dateShort(k.created_at)}</TD>
                <TD className="text-navy/60">{k.expires_at ? dateShort(k.expires_at) : 'No expiry'}</TD>
                <TD align="right">
                  {k.status !== 'revoked' && (
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => setConfirmAction({ type: 'rotate', key: k })}>Rotate</Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmAction({ type: 'revoke', key: k })} className="!text-critical !border-critical/30">Revoke</Button>
                    </div>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      {!loading && filtered.length > 0 && <div className="rounded-b-lg border border-t-0 border-navy/10 bg-white"><Pagination page={page} pageCount={pageCount} onChange={setPage} totalItems={filtered.length} pageSize={pageSize} /></div>}

      {/* Create Key modal */}
      <CreateKeyModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(fullKey, key) => { setCreateOpen(false); setRevealKey({ full: fullKey, key }) }}
      />

      {/* Full key reveal (creation / rotation) */}
      <Modal open={!!revealKey} onClose={() => { setRevealKey(null); setCopied(false) }} title="Your virtual key is ready" size="md" footer={
        <Button onClick={() => { setRevealKey(null); setCopied(false) }}>Done — I've stored this key</Button>
      }>
        {revealKey && (
          <div>
            <AlertBanner kind="warning" title="This key is shown only once">
              Store it in a secure secrets manager now. IndusGate AI does not display or store the full key after this dialog closes — only the masked prefix will be shown from now on.
            </AlertBanner>
            <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-navy/15 bg-ivory px-4 py-3">
              <code className="break-all font-mono text-table text-navy-ink">{revealKey.full}</code>
              <button
                onClick={() => { navigator.clipboard.writeText(revealKey.full); setCopied(true); setTimeout(() => setCopied(false), 1800) }}
                className="flex flex-shrink-0 items-center gap-1.5 rounded-md border border-navy/20 bg-white px-3 py-2 text-caption font-semibold text-navy hover:bg-navy/5"
              >
                {copied ? <><Icon.Check className="h-4 w-4 text-emerald" />Copied</> : <><Icon.Copy className="h-4 w-4" />Copy</>}
              </button>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-table">
              <div><dt className="text-caption text-navy/50">Project</dt><dd className="font-medium text-navy-ink">{projectName(revealKey.key.project_id)}</dd></div>
              <div><dt className="text-caption text-navy/50">Expires</dt><dd className="font-medium text-navy-ink">{revealKey.key.expires_at ? dateShort(revealKey.key.expires_at) : 'No expiry'}</dd></div>
            </dl>
          </div>
        )}
      </Modal>

      {/* Confirm dialogs */}
      <ConfirmDialog
        open={confirmAction?.type === 'rotate'}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => confirmAction && handleRotate(confirmAction.key)}
        title="Rotate this virtual key?"
        description="The current secret will be invalidated immediately and a new secret will be generated. Any application still using the old secret will start receiving authentication failures."
        confirmLabel="Rotate key"
        tone="confirm"
        loading={actionLoading}
      />
      <ConfirmDialog
        open={confirmAction?.type === 'revoke'}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => confirmAction && handleRevoke(confirmAction.key)}
        title="Revoke this virtual key?"
        description="This action is immediate and cannot be undone. All future requests using this key will be rejected with an authentication failure."
        confirmLabel="Revoke key"
        tone="destructive"
        loading={actionLoading}
      />

      {/* Key detail drawer */}
      <Drawer open={!!detailKey} onClose={() => setDetailKey(null)} title={detailKey ? `${detailKey.key_prefix}…` : ''}>
        {detailKey && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-2">
              <KeyStatusBadge status={detailKey.status} />
            </div>
            <div className="rounded-md border border-navy/15 bg-ivory px-4 py-3 font-mono text-table text-navy-ink">{detailKey.key_prefix}…</div>
            <dl className="grid grid-cols-2 gap-4 text-table">
              <div><dt className="text-caption text-navy/50">Project</dt><dd className="font-medium text-navy-ink">{projectName(detailKey.project_id)}</dd></div>
              <div><dt className="text-caption text-navy/50">Created</dt><dd className="font-medium text-navy-ink">{dateTime(detailKey.created_at)}</dd></div>
              <div><dt className="text-caption text-navy/50">Expiry</dt><dd className="font-medium text-navy-ink">{detailKey.expires_at ? dateShort(detailKey.expires_at) : 'No expiry'}</dd></div>
            </dl>
            <div>
              <div className="mb-2 text-table font-semibold text-navy-ink">Allowed model aliases</div>
              <div className="flex flex-wrap gap-1.5">
                {detailKey.allowed_model_aliases.length === 0 && <span className="text-table text-navy/50">Any model</span>}
                {detailKey.allowed_model_aliases.map((alias) => (
                  <Badge key={alias} tone="teal" icon={false}><code className="font-mono">{alias}</code></Badge>
                ))}
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}

function CreateKeyModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (fullKey: string, key: BackendVirtualKey) => void }) {
  const realProjects = useIndusGateStore((s) => s.realProjects)
  const realPolicies = useIndusGateStore((s) => s.realPolicies)
  const realProviders = useIndusGateStore((s) => s.realProviders)
  const createRealVirtualKey = useIndusGateStore((s) => s.createRealVirtualKey)
  const createRealProject = useIndusGateStore((s) => s.createRealProject)

  const [projectId, setProjectId] = useState('')
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectPolicyId, setNewProjectPolicyId] = useState('')
  const [providerIds, setProviderIds] = useState<string[]>([])
  const [modelAliases, setModelAliases] = useState('')
  const [modelSuggestions, setModelSuggestions] = useState<string[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelsError, setModelsError] = useState('')
  const [expiryDays, setExpiryDays] = useState('90')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!projectId && realProjects.length > 0) setProjectId(realProjects[0].id)
  }, [realProjects, projectId])
  useEffect(() => {
    if (!newProjectPolicyId && realPolicies.length > 0) setNewProjectPolicyId(realPolicies[0].id)
  }, [realPolicies, newProjectPolicyId])
  useEffect(() => {
    if (providerIds.length === 0 && realProviders.length > 0) setProviderIds(realProviders.filter((p) => p.is_active).map((p) => p.id))
  }, [realProviders, providerIds.length])

  useEffect(() => {
    if (providerIds.length === 0) { setModelSuggestions([]); return }
    let cancelled = false
    setLoadingModels(true)
    setModelsError('')
    Promise.all(providerIds.map((id) => listProviderModels(id).catch(() => [] as string[])))
      .then((lists) => {
        if (cancelled) return
        const merged = Array.from(new Set(lists.flat())).sort()
        setModelSuggestions(merged)
        if (merged.length === 0) setModelsError('Could not fetch live models for the selected provider(s) — you can still type a model name manually.')
      })
      .finally(() => { if (!cancelled) setLoadingModels(false) })
    return () => { cancelled = true }
  }, [providerIds])

  function reset() {
    setNewProjectName(''); setModelAliases(''); setExpiryDays('90'); setError('')
  }

  async function submit() {
    setError('')
    let targetProjectId = projectId

    if (targetProjectId === '__new__') {
      if (!newProjectName.trim()) { setError('Enter a name for the new project.'); return }
      if (!newProjectPolicyId) { setError('Select a policy for the new project.'); return }
      setSubmitting(true)
      try {
        const project = await createRealProject({ name: newProjectName.trim(), policy_id: newProjectPolicyId })
        targetProjectId = project.id
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to create project.')
        setSubmitting(false)
        return
      }
    }

    if (!targetProjectId) { setError('Select a project.'); return }
    const aliasList = modelAliases.split(',').map((s) => s.trim()).filter(Boolean)
    const expiresAt = expiryDays === 'none' ? null : keyExpiryPreview(parseInt(expiryDays))

    setSubmitting(true)
    try {
      const { virtualKey, fullKey } = await createRealVirtualKey({
        project_id: targetProjectId,
        allowed_provider_ids: providerIds,
        allowed_model_aliases: aliasList,
        expires_at: expiresAt,
      })
      reset()
      onCreated(fullKey, virtualKey)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create virtual key.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title="Create a new virtual key" size="lg" footer={
      <>
        <Button variant="ghost" onClick={() => { reset(); onClose() }}>Cancel</Button>
        <Button onClick={submit} loading={submitting}>Create key</Button>
      </>
    }>
      <div className="flex flex-col gap-5">
        {error && <AlertBanner kind="error" title="Check the highlighted fields">{error}</AlertBanner>}

        <Field label="Project" required helper="The key is scoped to this project's policy — it decides what gets masked or blocked.">
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {realProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            <option value="__new__">Create a new project…</option>
          </Select>
        </Field>

        {projectId === '__new__' && (
          <div className="grid grid-cols-2 gap-4 rounded-md border border-navy/15 bg-ivory p-3.5">
            <Field label="New project name" required>
              <TextInput value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="e.g. Compliance Portal" />
            </Field>
            <Field label="Policy" required>
              <Select value={newProjectPolicyId} onChange={(e) => setNewProjectPolicyId(e.target.value)}>
                {realPolicies.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
          </div>
        )}

        <Field label="Allowed providers" helper="Which upstream providers this key may route to.">
          <div className="grid grid-cols-2 gap-2 rounded-md border border-navy/15 p-3">
            {realProviders.map((p) => (
              <Checkbox
                key={p.id}
                label={p.name}
                checked={providerIds.includes(p.id)}
                onChange={(e) => setProviderIds((prev) => e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id))}
              />
            ))}
            {realProviders.length === 0 && <span className="text-table text-navy/50">No providers configured yet.</span>}
          </div>
        </Field>

        <Field
          label="Allowed model names"
          helper={
            loadingModels
              ? 'Loading live model list from the selected provider(s)…'
              : modelsError
                ? modelsError
                : `Comma-separated model names your application will request. ${modelSuggestions.length > 0 ? `Start typing to pick from ${modelSuggestions.length} real models fetched live from the selected provider(s).` : 'Select a provider above to see its real models.'} Leave blank to allow any model.`
          }
        >
          <TextInput
            value={modelAliases}
            onChange={(e) => setModelAliases(e.target.value)}
            placeholder="e.g. gpt-4o-mini, llama-3.3-70b-versatile"
            list="model-name-suggestions"
          />
          <datalist id="model-name-suggestions">
            {modelSuggestions.map((m) => <option key={m} value={m} />)}
          </datalist>
        </Field>

        <Field label="Expiry" required helper="Keys can be rotated at any time regardless of expiry.">
          <Select value={expiryDays} onChange={(e) => setExpiryDays(e.target.value)}>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
            <option value="180">180 days</option>
            <option value="365">1 year</option>
            <option value="none">No expiry</option>
          </Select>
        </Field>
      </div>
    </Modal>
  )
}
