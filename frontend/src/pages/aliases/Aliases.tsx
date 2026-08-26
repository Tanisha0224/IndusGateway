import { useEffect, useMemo, useState } from 'react'
import { PageHeader, AlertBanner } from '../../components/ui/Misc'
import { EmptyState } from '../../components/ui/Table'
import { Card, CardHeader } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Field, TextInput, TextArea, Select, Checkbox } from '../../components/ui/Form'
import { Icon } from '../../components/ui/Icons'
import { useIndusGateStore } from '../../lib/store'
import * as aliasApi from '../../lib/api/modelAliases'
import type { AliasCapability, BackendAliasTarget, BackendModelAlias, BackendProvider, BackendProject, SovereigntyMode } from '../../lib/api/types'

const sovereigntyLabels: Record<SovereigntyMode, string> = {
  india_only: 'India-only',
  protected_external: 'Protected external',
  unrestricted: 'Unrestricted',
}

export default function Aliases() {
  const currentUser = useIndusGateStore((s) => s.currentUser)
  const realProjects = useIndusGateStore((s) => s.realProjects)
  const realProviders = useIndusGateStore((s) => s.realProviders)
  const fetchRealProjects = useIndusGateStore((s) => s.fetchRealProjects)
  const fetchRealProviders = useIndusGateStore((s) => s.fetchRealProviders)
  const [aliases, setAliases] = useState<BackendModelAlias[]>([])
  const [targetsByAlias, setTargetsByAlias] = useState<Record<string, BackendAliasTarget[]>>({})
  const [projectFilter, setProjectFilter] = useState('')
  const [capabilityFilter, setCapabilityFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sovereigntyFilter, setSovereigntyFilter] = useState('')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [targetAlias, setTargetAlias] = useState<BackendModelAlias | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const canWrite = currentUser?.role === 'platform_admin'

  async function load() {
    setLoading(true)
    setError('')
    try {
      await Promise.all([fetchRealProjects(), fetchRealProviders()])
      const rows = await aliasApi.listModelAliases({
        project: projectFilter,
        capability: capabilityFilter,
        status: statusFilter,
        sovereignty_mode: sovereigntyFilter,
        search,
      })
      setAliases(rows)
      const targetEntries = await Promise.all(rows.map(async (item) => [item.id, await aliasApi.listAliasTargets(item.id)] as const))
      setTargetsByAlias(Object.fromEntries(targetEntries))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load model aliases.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [projectFilter, capabilityFilter, statusFilter, sovereigntyFilter])

  const providerName = useMemo(() => Object.fromEntries(realProviders.map((provider) => [provider.id, provider.name])), [realProviders])
  const projectName = useMemo(() => Object.fromEntries(realProjects.map((project) => [project.id, project.name])), [realProjects])

  return (
    <div>
      <PageHeader
        title="Model Aliases"
        description="Public aliases are the stable model names applications use. Targets are internal provider models selected by backend routing and never exposed to callers."
        action={canWrite ? <Button onClick={() => setCreateOpen(true)}><Icon.Plus className="h-4 w-4" />Create alias</Button> : undefined}
      />

      <div className="mb-5 grid gap-3 rounded-lg border border-white/70 bg-white/80 p-4 shadow-subtle backdrop-blur md:grid-cols-5">
        <TextInput value={search} onChange={(e) => setSearch(e.target.value)} onBlur={load} placeholder="Search aliases" />
        <Select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
          <option value="">All projects</option>
          {realProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </Select>
        <Select value={capabilityFilter} onChange={(e) => setCapabilityFilter(e.target.value)}>
          <option value="">All capabilities</option>
          <option value="chat">Chat</option>
          <option value="embedding">Embedding</option>
        </Select>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </Select>
        <Select value={sovereigntyFilter} onChange={(e) => setSovereigntyFilter(e.target.value)}>
          <option value="">All sovereignty modes</option>
          {Object.entries(sovereigntyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
      </div>

      {error && <AlertBanner kind="error" title="Could not load aliases">{error}</AlertBanner>}
      {loading && <Card><EmptyState title="Loading aliases" description="Fetching model aliases and target mappings from the backend." /></Card>}
      {!loading && aliases.length === 0 && <Card><EmptyState title="No aliases found" description="Create a public alias and map it to one or more internal provider models." /></Card>}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {aliases.map((alias) => {
          const targets = targetsByAlias[alias.id] ?? []
          return (
            <Card key={alias.id}>
              <CardHeader
                eyebrow={projectName[alias.project_id] ?? alias.project_id}
                title={<span className="font-mono">{alias.alias}</span>}
                description={alias.description ?? undefined}
                action={<Badge tone={alias.status === 'active' ? 'emerald' : 'neutral'}>{alias.status}</Badge>}
              />
              <div className="grid gap-3 text-table md:grid-cols-4">
                <div><div className="text-caption text-navy/45">Capability</div><div className="font-semibold capitalize">{alias.capability}</div></div>
                <div><div className="text-caption text-navy/45">Sovereignty</div><div className="font-semibold">{sovereigntyLabels[alias.sovereignty_mode]}</div></div>
                <div><div className="text-caption text-navy/45">Fallback</div><div className="font-semibold">{alias.fallback_enabled ? 'Allowed' : 'Blocked'}</div></div>
                <div><div className="text-caption text-navy/45">Targets</div><div className="font-semibold">{targets.length}</div></div>
              </div>
              <div className="mt-4 rounded-md border border-navy/10 bg-[#F8FAFF] p-3">
                <div className="mb-2 text-caption font-semibold uppercase tracking-wide text-navy/45">Priority targets</div>
                <div className="grid gap-2">
                  {targets.map((target) => (
                    <div key={target.id} className="flex items-center justify-between gap-3 rounded-md border border-navy/10 bg-white px-3 py-2 text-table">
                      <span><span className="font-semibold">#{target.priority}</span> {providerName[target.provider_id] ?? target.provider_id}</span>
                      <span className="text-navy/55">{target.region} · {target.is_india_hosted ? 'India-hosted' : 'External'}</span>
                    </div>
                  ))}
                </div>
              </div>
              {canWrite && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setTargetAlias(alias)}>Manage targets</Button>
                  <Button size="sm" variant={alias.status === 'active' ? 'ghost' : 'confirm'} onClick={async () => { alias.status === 'active' ? await aliasApi.disableModelAlias(alias.id) : await aliasApi.enableModelAlias(alias.id); load() }}>
                    {alias.status === 'active' ? 'Disable' : 'Enable'}
                  </Button>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      <CreateAliasModal open={createOpen} projects={realProjects} onClose={() => setCreateOpen(false)} onSaved={() => { setCreateOpen(false); load() }} />
      {targetAlias && <TargetModal alias={targetAlias} providers={realProviders} targets={targetsByAlias[targetAlias.id] ?? []} onClose={() => setTargetAlias(null)} onSaved={() => { setTargetAlias(null); load() }} />}
    </div>
  )
}

function CreateAliasModal({ open, projects, onClose, onSaved }: { open: boolean; projects: BackendProject[]; onClose: () => void; onSaved: () => void }) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '')
  const [alias, setAlias] = useState('indusgate-')
  const [displayName, setDisplayName] = useState('')
  const [description, setDescription] = useState('')
  const [capability, setCapability] = useState<AliasCapability>('chat')
  const [sovereigntyMode, setSovereigntyMode] = useState<SovereigntyMode>('protected_external')
  const [fallbackEnabled, setFallbackEnabled] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!projectId && projects[0]) setProjectId(projects[0].id)
  }, [projects, projectId])

  async function submit() {
    try {
      setError('')
      await aliasApi.createModelAlias({ project_id: projectId, alias, display_name: displayName || alias, description, capability, sovereignty_mode: sovereigntyMode, fallback_enabled: fallbackEnabled })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create alias.')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create model alias" size="md" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={submit}>Create alias</Button></>}>
      <div className="grid gap-4">
        {error && <AlertBanner kind="error" title="Alias not saved">{error}</AlertBanner>}
        <Field label="Project" required><Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
        <Field label="Public alias" required helper="Lowercase letters, numbers, hyphens and underscores only. This is what clients send as model."><TextInput value={alias} onChange={(e) => setAlias(e.target.value)} /></Field>
        <Field label="Display name" required><TextInput value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></Field>
        <Field label="Description"><TextArea value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Capability" required><Select value={capability} onChange={(e) => setCapability(e.target.value as AliasCapability)}><option value="chat">Chat</option><option value="embedding">Embedding</option></Select></Field>
          <Field label="Sovereignty mode" required><Select value={sovereigntyMode} onChange={(e) => setSovereigntyMode(e.target.value as SovereigntyMode)}>{Object.entries(sovereigntyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
        </div>
        <Checkbox label="Allow explicitly eligible fallback targets" checked={fallbackEnabled} onChange={(e) => setFallbackEnabled(e.target.checked)} />
      </div>
    </Modal>
  )
}

function TargetModal({ alias, providers, targets, onClose, onSaved }: { alias: BackendModelAlias; providers: BackendProvider[]; targets: BackendAliasTarget[]; onClose: () => void; onSaved: () => void }) {
  const compatibleProviders = providers.filter((provider) => alias.capability === 'chat' ? provider.supports_chat : provider.supports_embeddings)
  const [providerId, setProviderId] = useState(compatibleProviders[0]?.id ?? '')
  const [providerModelName, setProviderModelName] = useState('')
  const [priority, setPriority] = useState((targets.length || 0) + 1)
  const [region, setRegion] = useState('in-west-1')
  const [indiaHosted, setIndiaHosted] = useState(true)
  const [fallbackEligible, setFallbackEligible] = useState(true)
  const [error, setError] = useState('')

  async function addTarget() {
    try {
      setError('')
      await aliasApi.createAliasTarget(alias.id, { provider_id: providerId, provider_model_name: providerModelName, priority, enabled: true, region, is_india_hosted: indiaHosted, timeout_seconds: 30, max_retries: 1, fallback_eligible: fallbackEligible })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add target.')
    }
  }

  return (
    <Modal open onClose={onClose} title={`Manage targets for ${alias.alias}`} size="lg" footer={<><Button variant="ghost" onClick={onClose}>Close</Button><Button onClick={addTarget}>Add target</Button></>}>
      <div className="grid gap-5">
        {error && <AlertBanner kind="error" title="Target not saved">{error}</AlertBanner>}
        <AlertBanner kind="ai" title="Target privacy">Provider model names are internal routing records. They are never returned from /v1/models or model responses.</AlertBanner>
        <div className="grid gap-3">
          {targets.map((target) => (
            <div key={target.id} className="grid gap-2 rounded-md border border-navy/10 bg-[#F8FAFF] p-3 text-table md:grid-cols-[80px_1fr_1fr_auto]">
              <span className="font-semibold">#{target.priority}</span>
              <span>{providers.find((p) => p.id === target.provider_id)?.name ?? target.provider_id}</span>
              <span>{target.region} · {target.is_india_hosted ? 'India-hosted' : 'External'}</span>
              <Button size="sm" variant="ghost" onClick={async () => { await aliasApi.disableAliasTarget(alias.id, target.id); onSaved() }}>Disable</Button>
            </div>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Provider" required><Select value={providerId} onChange={(e) => setProviderId(e.target.value)}>{compatibleProviders.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
          <Field label="Internal provider model" required><TextInput value={providerModelName} onChange={(e) => setProviderModelName(e.target.value)} placeholder="llama-3.1-8b-instruct" /></Field>
          <Field label="Priority" required><TextInput type="number" min={1} value={priority} onChange={(e) => setPriority(Number(e.target.value))} /></Field>
          <Field label="Region" required><TextInput value={region} onChange={(e) => setRegion(e.target.value)} /></Field>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <Checkbox label="India-hosted target" checked={indiaHosted} onChange={(e) => setIndiaHosted(e.target.checked)} />
          <Checkbox label="Eligible for fallback" checked={fallbackEligible} onChange={(e) => setFallbackEligible(e.target.checked)} />
        </div>
      </div>
    </Modal>
  )
}
