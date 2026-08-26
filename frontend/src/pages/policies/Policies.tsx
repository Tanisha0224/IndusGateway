import { useEffect, useMemo, useState } from 'react'
import { PageHeader, AlertBanner } from '../../components/ui/Misc'
import { Card, CardHeader } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Checkbox, Field, Select, TextArea, TextInput } from '../../components/ui/Form'
import { useIndusGateStore } from '../../lib/store'
import * as policiesApi from '../../lib/api/policies'
import { ApiError } from '../../lib/api/client'
import type { BackendPolicy, PolicyAction, PolicySimulationResult } from '../../lib/api/types'

const entityTypes = ['EMAIL', 'INDIAN_MOBILE', 'PAN', 'AADHAAR', 'GSTIN', 'CARD', 'BANK_ACCOUNT', 'IFSC', 'UPI', 'PASSPORT', 'IP_ADDRESS', 'API_KEY', 'JWT']
const syntheticSample = 'Synthetic PAN ABCDE1234F and email alpha@example.test for firewall simulation.'

type RuleDraft = { entity: string; action: PolicyAction; minimum_confidence: number }

export default function Policies() {
  const projects = useIndusGateStore((s) => s.realProjects)
  const fetchProjects = useIndusGateStore((s) => s.fetchRealProjects)
  const [policies, setPolicies] = useState<BackendPolicy[]>([])
  const [projectFilter, setProjectFilter] = useState('')
  const [editing, setEditing] = useState<BackendPolicy | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [policyRows] = await Promise.all([policiesApi.listPolicies({ project: projectFilter || undefined }), fetchProjects()])
      setPolicies(policyRows)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return
      setError(err instanceof ApiError ? err.message : 'Failed to load privacy policies.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [projectFilter])

  const projectName = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p.name])), [projects])

  return (
    <div>
      <PageHeader
        title="Privacy Policies"
        description="Configure the PII firewall that detects, blocks, or masks sensitive values before model routing."
        action={<Button onClick={() => setEditing(emptyPolicy(projects[0]?.id))}>Create policy</Button>}
      />

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <AlertBanner kind="warning" title="Blocking prevents provider calls">Blocking prevents the provider from receiving this request.</AlertBanner>
        <AlertBanner kind="ai" title="Masking before processing">Masking replaces sensitive values before provider processing.</AlertBanner>
        <AlertBanner kind="warning" title="External processing">External processing is not full data sovereignty.</AlertBanner>
      </div>

      <div className="mb-4 max-w-sm">
        <Field label="Project filter">
          <Select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
            <option value="">All projects</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </Select>
        </Field>
      </div>

      {error && <div className="mb-4"><AlertBanner kind="error" title="Could not load policies">{error}</AlertBanner></div>}
      {loading && <Card><div className="py-12 text-center text-table text-navy/50">Loading privacy policies...</div></Card>}

      {!loading && (
        <div className="grid gap-4 xl:grid-cols-2">
          {policies.map((policy) => (
            <Card key={policy.id}>
              <CardHeader
                eyebrow={policy.project_id ? projectName[policy.project_id] ?? policy.project_id : 'Global'}
                title={<span>{policy.priority ?? 10}. {policy.name}</span>}
                description={policy.description ?? undefined}
                action={<Badge tone={policy.enabled === false ? 'neutral' : 'emerald'}>{policy.enabled === false ? 'Disabled' : 'Enabled'}</Badge>}
              />
              <div className="grid grid-cols-2 gap-3 text-table md:grid-cols-3">
                <Stat label="Default action" value={policy.default_action.replace(/_/g, ' ')} />
                <Stat label="External egress" value={(policy.external_egress_allowed ?? policy.allow_external) ? 'Allowed' : 'Denied'} />
                <Stat label="Mask before egress" value={(policy.mask_before_external_egress ?? policy.mask_before_egress) ? 'Yes' : 'No'} />
                <Stat label="Response scan" value={policy.response_scan_enabled === false ? 'Off' : 'On'} />
                <Stat label="Restoration" value={policy.allow_restoration ? 'Allowed' : 'Disabled'} />
                <Stat label="Entity rules" value={String(Object.keys(policy.entity_rules ?? {}).length)} />
              </div>
              {Object.keys(policy.entity_rules ?? {}).length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {Object.entries(policy.entity_rules ?? {}).map(([entity, rule]) => <Badge key={entity} tone={rule.action === 'block' ? 'critical' : 'gold'} icon={false}>{entity}: {rule.action.replace(/_/g, ' ')}</Badge>)}
                </div>
              )}
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setEditing(policy)}>Edit</Button>
                <Button size="sm" variant={policy.enabled === false ? 'confirm' : 'ghost'} onClick={async () => { policy.enabled === false ? await policiesApi.enablePolicy(policy.id) : await policiesApi.disablePolicy(policy.id); load() }}>
                  {policy.enabled === false ? 'Enable' : 'Disable'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && <PolicyEditor policy={editing} projects={projects} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
    </div>
  )
}

function PolicyEditor({ policy, projects, onClose, onSaved }: { policy: BackendPolicy; projects: Array<{ id: string; name: string }>; onClose: () => void; onSaved: () => void }) {
  const isNew = !policy.id
  const [name, setName] = useState(policy.name)
  const [projectId, setProjectId] = useState(policy.project_id ?? '')
  const [priority, setPriority] = useState(policy.priority ?? 10)
  const [defaultAction, setDefaultAction] = useState<PolicyAction>(policy.default_action)
  const [external, setExternal] = useState(policy.external_egress_allowed ?? policy.allow_external)
  const [maskBefore, setMaskBefore] = useState(policy.mask_before_external_egress ?? policy.mask_before_egress)
  const [responseScan, setResponseScan] = useState(policy.response_scan_enabled !== false)
  const [restoration, setRestoration] = useState(policy.allow_restoration)
  const [rules, setRules] = useState<RuleDraft[]>(Object.entries(policy.entity_rules ?? {}).map(([entity, rule]) => ({ entity, action: rule.action, minimum_confidence: rule.minimum_confidence })))
  const [sample, setSample] = useState(syntheticSample)
  const [simulation, setSimulation] = useState<PolicySimulationResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const payload = {
    project_id: projectId || null,
    name,
    priority,
    classification: policy.classification ?? 'internal',
    default_action: defaultAction,
    external_egress_allowed: external,
    mask_before_external_egress: maskBefore,
    allow_restoration: restoration,
    response_scan_enabled: responseScan,
    entity_rules: Object.fromEntries(rules.map((rule) => [rule.entity, { action: rule.action, minimum_confidence: rule.minimum_confidence }])),
  }

  async function save() {
    setSaving(true)
    setError('')
    try {
      isNew ? await policiesApi.createPolicy(payload) : await policiesApi.updatePolicy(policy.id, payload)
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save policy.')
    } finally {
      setSaving(false)
    }
  }

  async function simulate() {
    if (!projectId) { setError('Choose a project before simulation.'); return }
    setSimulation(await policiesApi.simulatePolicy({ project_id: projectId, policy_id: isNew ? undefined : policy.id, text: sample }))
  }

  return (
    <Card className="mt-5">
      <CardHeader title={isNew ? 'Create privacy policy' : 'Edit privacy policy'} description="Restoration may return original values to the authorised caller." />
      {error && <div className="mb-4"><AlertBanner kind="error" title="Policy editor">{error}</AlertBanner></div>}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name" required><TextInput value={name} onChange={(event) => setName(event.target.value)} /></Field>
        <Field label="Project"><Select value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">Global</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</Select></Field>
        <Field label="Priority" required><TextInput type="number" min={1} value={priority} onChange={(event) => setPriority(Number(event.target.value))} /></Field>
        <Field label="Default action"><Select value={defaultAction} onChange={(event) => setDefaultAction(event.target.value as PolicyAction)}><option value="allow">Allow</option><option value="mask_and_allow">Mask and allow</option><option value="block">Block</option></Select></Field>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Checkbox label="External egress allowed" checked={external} onChange={(event) => setExternal(event.target.checked)} />
        <Checkbox label="Mask before external egress" checked={maskBefore} onChange={(event) => setMaskBefore(event.target.checked)} />
        <Checkbox label="Scan provider responses" checked={responseScan} onChange={(event) => setResponseScan(event.target.checked)} />
        <Checkbox label="Allow restoration" checked={restoration} onChange={(event) => setRestoration(event.target.checked)} />
      </div>

      <div className="mt-5">
        <div className="mb-2 text-table font-semibold text-navy-ink">Entity-specific rules</div>
        <div className="flex flex-col gap-2">
          {rules.map((rule, index) => (
            <div key={`${rule.entity}-${index}`} className="grid gap-2 md:grid-cols-[1fr_1fr_120px_auto]">
              <Select value={rule.entity} onChange={(event) => setRules((rows) => rows.map((row, i) => i === index ? { ...row, entity: event.target.value } : row))}>{entityTypes.map((entity) => <option key={entity} value={entity}>{entity}</option>)}</Select>
              <Select value={rule.action} onChange={(event) => setRules((rows) => rows.map((row, i) => i === index ? { ...row, action: event.target.value as PolicyAction } : row))}><option value="allow">Allow</option><option value="mask_and_allow">Mask</option><option value="block">Block</option></Select>
              <TextInput type="number" min={0} max={1} step={0.01} value={rule.minimum_confidence} onChange={(event) => setRules((rows) => rows.map((row, i) => i === index ? { ...row, minimum_confidence: Number(event.target.value) } : row))} />
              <Button size="sm" variant="ghost" onClick={() => setRules((rows) => rows.filter((_, i) => i !== index))}>Remove</Button>
            </div>
          ))}
        </div>
        <Button className="mt-2" size="sm" variant="ghost" onClick={() => setRules((rows) => [...rows, { entity: 'EMAIL', action: 'mask_and_allow', minimum_confidence: 0.8 }])}>Add rule</Button>
      </div>

      <div className="mt-5">
        <Field label="Simulation sample" helper="Use synthetic values only. The sample is not persisted."><TextArea rows={3} value={sample} onChange={(event) => setSample(event.target.value)} /></Field>
        <Button className="mt-2" size="sm" variant="secondary" onClick={simulate}>Run simulation</Button>
        {simulation && (
          <div className="mt-3 rounded-md border border-navy/10 bg-ivory p-3 text-table">
            <div className="mb-2 font-semibold text-navy-ink">Decision: {simulation.decision.replace(/_/g, ' ')}</div>
            <div className="mb-2 flex flex-wrap gap-1.5">{simulation.entities.map((entity, index) => <Badge key={`${entity.type}-${index}`} tone={entity.action === 'block' ? 'critical' : 'gold'} icon={false}>{entity.type} {Math.round(entity.confidence * 100)}%</Badge>)}</div>
            <div className="whitespace-pre-wrap font-mono text-caption text-navy/70">{simulation.masked_preview}</div>
          </div>
        )}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={save} loading={saving}>Save policy</Button>
      </div>
    </Card>
  )
}

function emptyPolicy(projectId?: string): BackendPolicy {
  return {
    id: '',
    project_id: projectId ?? null,
    name: 'New privacy policy',
    description: '',
    priority: 10,
    enabled: true,
    classification: 'internal',
    default_action: 'mask_and_allow',
    allow_external: true,
    external_egress_allowed: true,
    mask_before_egress: true,
    mask_before_external_egress: true,
    block_regulated_fields: false,
    allow_restoration: false,
    response_scan_enabled: true,
    entity_rules: {},
    created_at: new Date().toISOString(),
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div><div className="text-caption text-navy/45">{label}</div><div className="mt-0.5 font-medium capitalize text-navy-ink">{value}</div></div>
}
