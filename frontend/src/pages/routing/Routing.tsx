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
import * as routingApi from '../../lib/api/routingPolicies'
import * as aliasApi from '../../lib/api/modelAliases'
import type { BackendModelAlias, BackendProvider, BackendRoutingPolicy, BackendVirtualKey, RoutingSimulationResult } from '../../lib/api/types'

export default function Routing() {
  const currentUser = useIndusGateStore((s) => s.currentUser)
  const realProjects = useIndusGateStore((s) => s.realProjects)
  const realProviders = useIndusGateStore((s) => s.realProviders)
  const realVirtualKeys = useIndusGateStore((s) => s.realVirtualKeys)
  const fetchRealProjects = useIndusGateStore((s) => s.fetchRealProjects)
  const fetchRealProviders = useIndusGateStore((s) => s.fetchRealProviders)
  const fetchRealVirtualKeys = useIndusGateStore((s) => s.fetchRealVirtualKeys)
  const [policies, setPolicies] = useState<BackendRoutingPolicy[]>([])
  const [aliases, setAliases] = useState<BackendModelAlias[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [simulateOpen, setSimulateOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const canWrite = currentUser?.role === 'platform_admin'

  async function load() {
    setLoading(true)
    setError('')
    try {
      await Promise.all([fetchRealProjects(), fetchRealProviders(), fetchRealVirtualKeys()])
      const [policyRows, aliasRows] = await Promise.all([routingApi.listRoutingPolicies(), aliasApi.listModelAliases()])
      setPolicies(policyRows)
      setAliases(aliasRows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load routing policies.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const projectName = useMemo(() => Object.fromEntries(realProjects.map((project) => [project.id, project.name])), [realProjects])
  const providerName = useMemo(() => Object.fromEntries(realProviders.map((provider) => [provider.id, provider.name])), [realProviders])

  return (
    <div>
      <PageHeader
        title="Routing Policies"
        description="Backend-enforced policies restrict provider eligibility before a request leaves IndusGate AI. They are evaluated by priority with deny-biased conflict handling."
        action={<div className="flex gap-2">{canWrite && <Button onClick={() => setCreateOpen(true)}><Icon.Plus className="h-4 w-4" />Create policy</Button>}<Button variant="ghost" onClick={() => setSimulateOpen(true)}>Simulate</Button></div>}
      />

      {error && <AlertBanner kind="error" title="Could not load routing policies">{error}</AlertBanner>}
      {loading && <Card><EmptyState title="Loading policies" description="Fetching routing policies from the backend." /></Card>}
      {!loading && policies.length === 0 && <Card><EmptyState title="No routing policies" description="Create a policy to restrict providers by alias, capability, key, project, region, or sovereignty." /></Card>}

      <div className="grid gap-4">
        {policies.map((policy) => (
          <Card key={policy.id}>
            <CardHeader
              eyebrow={policy.project_id ? projectName[policy.project_id] ?? policy.project_id : 'Global'}
              title={<span>{policy.priority}. {policy.name}</span>}
              description={policy.description ?? undefined}
              action={<Badge tone={policy.enabled ? 'emerald' : 'neutral'}>{policy.enabled ? 'Enabled' : 'Disabled'}</Badge>}
            />
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-md border border-navy/10 bg-[#F8FAFF] p-3">
                <div className="mb-2 text-caption font-semibold uppercase tracking-wide text-navy/45">Conditions</div>
                <PolicyList items={[
                  ['Requested aliases', policy.conditions_json.requested_aliases?.join(', ') || 'Any'],
                  ['Capabilities', policy.conditions_json.capabilities?.join(', ') || 'Any'],
                  ['Virtual keys', policy.conditions_json.virtual_key_ids?.join(', ') || 'Any'],
                  ['Projects', policy.conditions_json.project_ids?.map((id) => projectName[id] ?? id).join(', ') || 'Any'],
                ]} />
              </div>
              <div className="rounded-md border border-navy/10 bg-[#F8FAFF] p-3">
                <div className="mb-2 text-caption font-semibold uppercase tracking-wide text-navy/45">Actions</div>
                <PolicyList items={[
                  ['Allowed providers', policy.actions_json.allowed_provider_ids?.map((id) => providerName[id] ?? id).join(', ') || 'Any otherwise permitted'],
                  ['Excluded providers', policy.actions_json.excluded_provider_ids?.map((id) => providerName[id] ?? id).join(', ') || 'None'],
                  ['Allowed regions', policy.actions_json.allowed_regions?.join(', ') || 'Any'],
                  ['Require India hosting', policy.actions_json.require_india_hosting ? 'Yes' : 'No'],
                  ['External egress', policy.actions_json.external_egress_allowed === false ? 'Blocked' : 'Allowed when otherwise permitted'],
                  ['Fallback', policy.actions_json.fallback_allowed === false ? 'Blocked' : 'Allowed when alias and target permit'],
                ]} />
              </div>
            </div>
            {canWrite && (
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant={policy.enabled ? 'ghost' : 'confirm'} onClick={async () => { policy.enabled ? await routingApi.disableRoutingPolicy(policy.id) : await routingApi.enableRoutingPolicy(policy.id); load() }}>
                  {policy.enabled ? 'Disable' : 'Enable'}
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>

      <CreatePolicyModal open={createOpen} aliases={aliases} providers={realProviders} virtualKeys={realVirtualKeys} onClose={() => setCreateOpen(false)} onSaved={() => { setCreateOpen(false); load() }} />
      <SimulateModal open={simulateOpen} aliases={aliases} virtualKeys={realVirtualKeys} resultProviders={providerName} onClose={() => setSimulateOpen(false)} />
    </div>
  )
}

function PolicyList({ items }: { items: Array<[string, string]> }) {
  return (
    <div className="grid gap-2 text-table">
      {items.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4">
          <span className="text-navy/50">{label}</span>
          <span className="text-right font-medium text-navy-ink">{value}</span>
        </div>
      ))}
    </div>
  )
}

function CreatePolicyModal({ open, aliases, providers, virtualKeys, onClose, onSaved }: { open: boolean; aliases: BackendModelAlias[]; providers: BackendProvider[]; virtualKeys: BackendVirtualKey[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState(10)
  const [requestedAlias, setRequestedAlias] = useState('')
  const [capability, setCapability] = useState('')
  const [virtualKeyId, setVirtualKeyId] = useState('')
  const [excludedProviderId, setExcludedProviderId] = useState('')
  const [requireIndia, setRequireIndia] = useState(false)
  const [externalAllowed, setExternalAllowed] = useState(true)
  const [fallbackAllowed, setFallbackAllowed] = useState(true)
  const [error, setError] = useState('')

  async function submit() {
    try {
      setError('')
      await routingApi.createRoutingPolicy({
        name,
        description,
        priority,
        enabled: true,
        conditions: {
          requested_aliases: requestedAlias ? [requestedAlias] : [],
          capabilities: capability ? [capability] : [],
          virtual_key_ids: virtualKeyId ? [virtualKeyId] : [],
          project_ids: [],
        },
        actions: {
          excluded_provider_ids: excludedProviderId ? [excludedProviderId] : [],
          require_india_hosting: requireIndia,
          external_egress_allowed: externalAllowed,
          fallback_allowed: fallbackAllowed,
        },
      })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create routing policy.')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create routing policy" size="lg" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={submit}>Create policy</Button></>}>
      <div className="grid gap-4">
        {error && <AlertBanner kind="error" title="Policy not saved">{error}</AlertBanner>}
        <Field label="Policy name" required><TextInput value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Description"><TextArea value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <Field label="Priority" required helper="Lower numbers run first; ties use policy ID for stable ordering."><TextInput type="number" min={1} value={priority} onChange={(e) => setPriority(Number(e.target.value))} /></Field>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Requested alias"><Select value={requestedAlias} onChange={(e) => setRequestedAlias(e.target.value)}><option value="">Any alias</option>{aliases.map((a) => <option key={a.id} value={a.alias}>{a.alias}</option>)}</Select></Field>
          <Field label="Capability"><Select value={capability} onChange={(e) => setCapability(e.target.value)}><option value="">Any</option><option value="chat">Chat</option><option value="embedding">Embedding</option></Select></Field>
          <Field label="Virtual key"><Select value={virtualKeyId} onChange={(e) => setVirtualKeyId(e.target.value)}><option value="">Any key</option>{virtualKeys.map((k) => <option key={k.id} value={k.id}>{k.key_prefix}</option>)}</Select></Field>
        </div>
        <Field label="Exclude provider"><Select value={excludedProviderId} onChange={(e) => setExcludedProviderId(e.target.value)}><option value="">No provider excluded</option>{providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
        <div className="grid gap-2 md:grid-cols-3">
          <Checkbox label="Require India hosting" checked={requireIndia} onChange={(e) => setRequireIndia(e.target.checked)} />
          <Checkbox label="Allow external egress" checked={externalAllowed} onChange={(e) => setExternalAllowed(e.target.checked)} />
          <Checkbox label="Allow fallback" checked={fallbackAllowed} onChange={(e) => setFallbackAllowed(e.target.checked)} />
        </div>
      </div>
    </Modal>
  )
}

function SimulateModal({ open, aliases, virtualKeys, resultProviders, onClose }: { open: boolean; aliases: BackendModelAlias[]; virtualKeys: BackendVirtualKey[]; resultProviders: Record<string, string>; onClose: () => void }) {
  const [virtualKeyId, setVirtualKeyId] = useState(virtualKeys[0]?.id ?? '')
  const [alias, setAlias] = useState(aliases[0]?.alias ?? '')
  const [capability, setCapability] = useState<'chat' | 'embedding'>('chat')
  const [result, setResult] = useState<RoutingSimulationResult | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!virtualKeyId && virtualKeys[0]) setVirtualKeyId(virtualKeys[0].id)
    if (!alias && aliases[0]) setAlias(aliases[0].alias)
  }, [virtualKeys, aliases, virtualKeyId, alias])

  async function simulate() {
    try {
      setError('')
      setResult(await routingApi.simulateRouting({ virtual_key_id: virtualKeyId, alias, capability }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulation failed.')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Simulate routing" size="lg" footer={<><Button variant="ghost" onClick={onClose}>Close</Button><Button onClick={simulate}>Run simulation</Button></>}>
      <div className="grid gap-4">
        {error && <AlertBanner kind="error" title="Simulation failed">{error}</AlertBanner>}
        <AlertBanner kind="ai" title="No provider call">Simulation evaluates policies and eligible targets only. It never calls a provider or exposes credentials.</AlertBanner>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Virtual key" required><Select value={virtualKeyId} onChange={(e) => setVirtualKeyId(e.target.value)}>{virtualKeys.map((k) => <option key={k.id} value={k.id}>{k.key_prefix}</option>)}</Select></Field>
          <Field label="Public alias" required><Select value={alias} onChange={(e) => setAlias(e.target.value)}>{aliases.map((a) => <option key={a.id} value={a.alias}>{a.alias}</option>)}</Select></Field>
          <Field label="Capability" required><Select value={capability} onChange={(e) => setCapability(e.target.value as 'chat' | 'embedding')}><option value="chat">Chat</option><option value="embedding">Embedding</option></Select></Field>
        </div>
        {result && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader title="Matched policies" />
              <div className="grid gap-2 text-table">{result.matched_policies.map((p) => <div key={p.id}>{p.priority}. {p.name}</div>)}</div>
            </Card>
            <Card>
              <CardHeader title="Eligible targets" />
              <div className="grid gap-2 text-table">{result.eligible_targets.map((t) => <div key={String(t.id)}>{resultProviders[String(t.provider_id)] ?? String(t.provider_id)} · priority {String(t.priority)}</div>)}</div>
            </Card>
            <Card>
              <CardHeader title="Excluded targets" />
              <div className="grid gap-2 text-table">{result.excluded_targets.map((t) => <div key={String(t.id)}>{String(t.id)} · {String(t.reason)}</div>)}</div>
            </Card>
          </div>
        )}
      </div>
    </Modal>
  )
}
