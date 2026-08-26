import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { PageHeader, AlertBanner } from '../../components/ui/Misc'
import { Card, CardHeader, KpiCard } from '../../components/ui/Card'
import { Badge, EgressBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Checkbox, Field, TextInput, TextArea, Select } from '../../components/ui/Form'
import { Drawer } from '../../components/ui/Modal'
import { Table, THead, TH, TBody, TR, TD, EmptyState } from '../../components/ui/Table'
import { Icon } from '../../components/ui/Icons'
import { API_BASE } from '../../lib/api/base'
import { sendGatewayChatCompletion } from '../../lib/api/gatewayClient'
import { listGatewayRequests, getGatewayRequest } from '../../lib/api/traces'
import { listProjects } from '../../lib/api/projects'
import { listProviders } from '../../lib/api/providers'
import { useIndusGateStore } from '../../lib/store'
import { dateTime, inr, ms, num, pct, relative } from '../../lib/format'
import type { BackendGatewayRequest, BackendProject, BackendProvider } from '../../lib/api/types'

const egressForAction: Record<string, 'allowed' | 'masked' | 'blocked'> = {
  allow: 'allowed',
  mask_and_allow: 'masked',
  block: 'blocked',
}

const statusTone: Record<string, 'emerald' | 'critical' | 'saffron' | 'navy'> = {
  completed: 'emerald',
  blocked: 'critical',
  budget_blocked: 'critical',
  failed: 'saffron',
  error: 'saffron',
  started: 'navy',
}

interface SendResult {
  ok: boolean
  status: number
  responseText: string | null
  errorMessage: string | null
  cacheStatus: string | null
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null
  trace: BackendGatewayRequest | null
}

export default function Playground() {
  const fetchUsageSummary = useIndusGateStore((s) => s.fetchUsageSummary)
  const [virtualKey, setVirtualKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [model, setModel] = useState('indusgate-demo')
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful assistant.')
  const [userPrompt, setUserPrompt] = useState('Summarize gateway privacy controls for an internal architecture review.')
  const [stream, setStream] = useState(false)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<SendResult | null>(null)
  const [formError, setFormError] = useState('')
  const [traces, setTraces] = useState<BackendGatewayRequest[]>([])
  const [projects, setProjects] = useState<BackendProject[]>([])
  const [providers, setProviders] = useState<BackendProvider[]>([])
  const [traceDetail, setTraceDetail] = useState<BackendGatewayRequest | null>(null)
  const [loadError, setLoadError] = useState('')

  const projectNames = useMemo(() => new Map(projects.map((project) => [project.id, project.name])), [projects])
  const providerNames = useMemo(() => new Map(providers.map((provider) => [provider.id, provider.name])), [providers])
  const recentTraces = traces.slice(0, 8)
  const latestTrace = result?.trace ?? traces[0] ?? null

  const messages = systemPrompt.trim()
    ? [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }]
    : [{ role: 'user', content: userPrompt }]

  const curlExample = `curl -X POST ${API_BASE}/v1/chat/completions \\
  -H "Authorization: Bearer ${virtualKey || 'ig_sk_live_YOUR_KEY_HERE'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${model || 'indusgate-general'}",
    "messages": ${JSON.stringify(messages, null, 2).split('\n').join('\n    ')},
    "stream": ${stream ? 'true' : 'false'}
  }'`

  async function refreshTraces() {
    try {
      const [traceRows, projectRows, providerRows] = await Promise.all([listGatewayRequests(), listProjects(), listProviders()])
      setTraces(traceRows)
      setProjects(projectRows)
      setProviders(providerRows)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load gateway traces')
    }
  }

  useEffect(() => {
    refreshTraces()
  }, [])

  async function openTrace(trace: BackendGatewayRequest) {
    try {
      setTraceDetail(await getGatewayRequest(trace.id))
    } catch {
      setTraceDetail(trace)
    }
  }

  async function send() {
    setFormError('')
    setLoadError('')
    if (!virtualKey.trim()) {
      setFormError('Paste a full virtual key. Demo seeded keys are ig_sk_test_demo_secret and ig_sk_live_demo_secret.')
      return
    }
    if (!model.trim()) {
      setFormError('Enter a model alias allowed for this key.')
      return
    }
    if (!userPrompt.trim()) {
      setFormError('Enter a user prompt.')
      return
    }

    setSending(true)
    setResult(null)
    try {
      const response = await sendGatewayChatCompletion({ virtualKey: virtualKey.trim(), model: model.trim(), messages, stream })
      let trace: BackendGatewayRequest | null = null
      if (response.gatewayRequestId) {
        try {
          trace = await getGatewayRequest(response.gatewayRequestId)
        } catch {
          trace = null
        }
      }
      const detail = response.body?.detail
      const errorMessage = response.ok
        ? null
        : typeof detail === 'string'
          ? detail
          : detail && typeof detail === 'object' && 'message' in detail
            ? String((detail as Record<string, unknown>).message)
            : `Request failed with status ${response.status}.`
      const choices = response.body?.choices as Array<{ message?: { content?: string } }> | undefined
      const usage = (response.body?.usage as SendResult['usage']) ?? null

      setResult({
        ok: response.ok,
        status: response.status,
        responseText: response.ok ? choices?.[0]?.message?.content ?? null : null,
        errorMessage,
        cacheStatus: response.cacheStatus,
        usage,
        trace,
      })
      if (trace) setTraceDetail(trace)
      if (response.ok) fetchUsageSummary().catch(() => {})
      await refreshTraces()
    } catch {
      setResult({
        ok: false,
        status: 0,
        responseText: null,
        errorMessage: `Could not reach the gateway at ${API_BASE}.`,
        cacheStatus: null,
        usage: null,
        trace: null,
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Request Playground"
        description="Send real OpenAI-compatible requests through the gateway, then inspect the privacy, routing, cache, provider, and governance trace written for the call."
      />

      {loadError && <div className="mb-4"><AlertBanner kind="error" title="Trace loading failed">{loadError}</AlertBanner></div>}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Request configuration" description="POST /v1/chat/completions" />
            <div className="flex flex-col gap-4">
              {formError && <AlertBanner kind="error" title="Check request input">{formError}</AlertBanner>}
              <Field label="Virtual key" required helper="Use a full key copied when created or rotated. Seeded demo: ig_sk_test_demo_secret.">
                <div className="flex gap-2">
                  <TextInput
                    type={showKey ? 'text' : 'password'}
                    value={virtualKey}
                    onChange={(event) => setVirtualKey(event.target.value)}
                    placeholder="ig_sk_test_demo_secret"
                    className="font-mono"
                  />
                  <Button type="button" variant="ghost" onClick={() => setShowKey((value) => !value)}>{showKey ? 'Hide' : 'Show'}</Button>
                </div>
              </Field>
              <Field label="Model alias" required helper="For the seeded test key, indusgate-demo always works without external provider credentials.">
                <TextInput value={model} onChange={(event) => setModel(event.target.value)} placeholder="indusgate-general" />
              </Field>
              <Field label="System prompt">
                <TextArea rows={2} value={systemPrompt} onChange={(event) => setSystemPrompt(event.target.value)} />
              </Field>
              <Field label="User prompt" required>
                <TextArea rows={5} value={userPrompt} onChange={(event) => setUserPrompt(event.target.value)} />
              </Field>
              <Checkbox label="Request buffered privacy streaming" checked={stream} onChange={(event) => setStream(event.target.checked)} />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="ghost" onClick={() => setUserPrompt('Synthetic example: contact alpha@example.test and reference PAN ABCDE1234F for policy testing.')}>PII test prompt</Button>
                <Button size="sm" variant="ghost" onClick={() => { setModel('indusgate-demo'); setUserPrompt('Summarize gateway privacy controls for an internal architecture review.') }}>Demo cache prompt</Button>
                <Button size="sm" variant="ghost" onClick={() => setVirtualKey('ig_sk_test_demo_secret')}>Use demo key</Button>
              </div>
            </div>
          </Card>

          <Card className="bg-navy-ink">
            <div className="mb-2 text-caption font-semibold uppercase tracking-wide text-white/50">Equivalent API call</div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-caption leading-relaxed text-white/85">{curlExample}</pre>
          </Card>

          <Button onClick={send} loading={sending} size="md" className="self-start px-8"><Icon.Play className="h-4 w-4" />Send request</Button>
        </div>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <KpiCard label="Latest cache" value={result?.cacheStatus ? result.cacheStatus.toUpperCase() : latestTrace?.cache_status ? String(latestTrace.cache_status).toUpperCase() : 'NONE'} tone={result?.cacheStatus === 'hit' || latestTrace?.cache_status === 'hit' ? 'positive' : 'default'} />
            <KpiCard label="Latest latency" value={latestTrace?.latency_ms != null ? ms(latestTrace.latency_ms) : 'N/A'} />
          </div>

          <Card>
            <CardHeader title="Gateway response" description={result?.trace ? result.trace.id : 'Run a request to inspect the latest response.'} />
            {!result && !sending && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Icon.Play className="mb-3 h-8 w-8 text-navy/25" />
                <p className="max-w-md text-body text-navy/50">Send a request to see the real response, usage, cache result, and trace evidence here.</p>
              </div>
            )}
            {sending && <div className="space-y-3 py-4">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-4 animate-pulse rounded bg-navy/8" />)}</div>}
            {result && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={result.ok ? 'emerald' : 'critical'}>{result.ok ? 'Succeeded' : `HTTP ${result.status || 0}`}</Badge>
                  <CacheBadge status={result.cacheStatus ?? result.trace?.cache_status ?? null} />
                  {result.trace && <Button size="sm" variant="ghost" onClick={() => openTrace(result.trace as BackendGatewayRequest)}>Inspect trace</Button>}
                </div>
                {result.responseText && <div className="whitespace-pre-wrap rounded-md border border-navy/10 bg-ivory p-4 text-table text-navy-ink">{result.responseText}</div>}
                {result.errorMessage && <AlertBanner kind="error" title="Gateway response">{result.errorMessage}</AlertBanner>}
                {result.usage && (
                  <div className="grid grid-cols-3 gap-3 text-table">
                    <Stat label="Prompt" value={num(result.usage.prompt_tokens ?? 0)} />
                    <Stat label="Completion" value={num(result.usage.completion_tokens ?? 0)} />
                    <Stat label="Total" value={num(result.usage.total_tokens ?? 0)} />
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Recent gateway traces" description="Click any row to inspect full trace detail." action={<Button size="sm" variant="ghost" onClick={refreshTraces}>Refresh</Button>} />
            {recentTraces.length === 0 ? (
              <EmptyState title="No live traces yet" description="Send a request from this Playground to create one." />
            ) : (
              <Table>
                <THead><TH>Time</TH><TH>Model</TH><TH>Cache</TH><TH align="right">Tokens</TH><TH>Status</TH></THead>
                <TBody>
                  {recentTraces.map((trace) => (
                    <TR key={trace.id} onClick={() => openTrace(trace)}>
                      <TD className="text-navy/60">{relative(trace.created_at)}</TD>
                      <TD>{trace.model_requested}</TD>
                      <TD><CacheBadge status={trace.cache_status ?? null} /></TD>
                      <TD align="right">{trace.total_tokens != null ? num(trace.total_tokens) : '-'}</TD>
                      <TD><Badge tone={statusTone[trace.request_status] ?? 'saffron'}>{trace.request_status.replace(/_/g, ' ')}</Badge></TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        </div>
      </div>

      <TraceDrawer
        trace={traceDetail}
        onClose={() => setTraceDetail(null)}
        projectName={(id) => projectNames.get(id) ?? id}
        providerName={(id) => id ? providerNames.get(id) ?? id : 'None'}
      />
    </div>
  )
}

function TraceDrawer({
  trace,
  onClose,
  projectName,
  providerName,
}: {
  trace: BackendGatewayRequest | null
  onClose: () => void
  projectName: (id: string) => string
  providerName: (id: string | null | undefined) => string
}) {
  const cost = Number(trace?.estimated_cost_inr ?? trace?.estimated_cost_reserved_inr ?? 0)
  return (
    <Drawer open={!!trace} onClose={onClose} title={trace ? `Trace ${trace.id}` : ''} width="w-[720px]">
      {trace && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap gap-2">
            <Badge tone={statusTone[trace.request_status] ?? 'saffron'}>{trace.request_status.replace(/_/g, ' ')}</Badge>
            <CacheBadge status={trace.cache_status ?? null} />
            <EgressBadge status={egressForAction[trace.policy_action] ?? 'blocked'} />
            {trace.provider_response_status != null && <Badge tone={trace.provider_response_status < 400 ? 'emerald' : 'critical'} icon={false}>Provider HTTP {trace.provider_response_status}</Badge>}
          </div>

          <div className="grid grid-cols-2 gap-4 text-table">
            <Stat label="Project" value={projectName(trace.project_id)} />
            <Stat label="Virtual key" value={trace.virtual_key_id} mono />
            <Stat label="Requested model" value={trace.model_requested} />
            <Stat label="Routed model" value={trace.model_routed ?? trace.selected_provider_model ?? 'Not routed'} />
            <Stat label="Provider" value={providerName(trace.selected_provider_id ?? trace.provider_id)} />
            <Stat label="Latency" value={trace.latency_ms != null ? ms(trace.latency_ms) : 'N/A'} />
            <Stat label="Tokens" value={trace.total_tokens != null ? num(trace.total_tokens) : '0'} />
            <Stat label="Estimated cost" value={cost ? inr(cost, 4) : inr(0, 4)} />
          </div>

          <Section title="Privacy">
            <div className="grid grid-cols-2 gap-4 text-table">
              <Stat label="Request action" value={(trace.privacy_action ?? trace.policy_action).replace(/_/g, ' ')} />
              <Stat label="Masking applied" value={trace.masking_applied ? 'Yes' : 'No'} />
              <Stat label="Entities detected" value={String(trace.pii_entity_count ?? trace.detected_pii_types.length)} />
              <Stat label="Entities masked" value={String(trace.masked_entity_count ?? trace.masked_fields_count ?? 0)} />
              <Stat label="Response scan" value={trace.response_scan_performed ? 'Performed' : 'Not performed'} />
              <Stat label="Response action" value={String(trace.response_privacy_action ?? 'allow').replace(/_/g, ' ')} />
            </div>
            <BadgeList values={trace.pii_types ?? trace.detected_pii_types} tone="critical" />
            <BadgeList values={trace.response_pii_types ?? []} tone="gold" />
            {trace.sanitized_prompt && <PreBlock title="Sanitized prompt" text={trace.sanitized_prompt} />}
          </Section>

          <Section title="Routing">
            <div className="grid grid-cols-2 gap-4 text-table">
              <Stat label="Selected target" value={trace.selected_target_id ?? 'None'} />
              <Stat label="Sovereignty mode" value={trace.sovereignty_mode?.replace(/_/g, ' ') ?? 'N/A'} />
              <Stat label="Fallback used" value={trace.fallback_used ? 'Yes' : 'No'} />
              <Stat label="Attempts" value={String(trace.attempt_count ?? trace.attempted_targets?.length ?? 0)} />
            </div>
            {trace.routing_reason && <p className="mt-3 text-table text-navy/65">{trace.routing_reason}</p>}
            <BadgeList values={trace.matched_routing_policy_ids ?? []} tone="teal" />
          </Section>

          <Section title="Governance">
            <div className="grid grid-cols-2 gap-4 text-table">
              <Stat label="Enforced" value={trace.governance_enforced ? 'Yes' : 'No'} />
              <Stat label="Reservation" value={trace.governance_reservation_id ?? 'None'} mono />
              <Stat label="Reserved tokens" value={num(trace.estimated_tokens_reserved ?? 0)} />
              <Stat label="Settled" value={trace.budget_settled ? 'Yes' : 'No'} />
            </div>
          </Section>

          <Section title="Cache">
            <div className="grid grid-cols-2 gap-4 text-table">
              <Stat label="Status" value={String(trace.cache_status ?? 'none').replace(/_/g, ' ')} />
              <Stat label="Entry" value={trace.cache_entry_id ?? 'None'} mono />
              <Stat label="Similarity" value={trace.cache_similarity != null ? pct(trace.cache_similarity, 1) : 'N/A'} />
              <Stat label="Provider call saved" value={trace.cache_saved_provider_call ? 'Yes' : 'No'} />
            </div>
          </Section>

          {trace.error_category && <AlertBanner kind="warning" title="Gateway error category">{trace.error_category}</AlertBanner>}
        </div>
      )}
    </Drawer>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-navy/10 bg-white p-4">
      <div className="mb-3 text-table font-semibold text-navy-ink">{title}</div>
      {children}
    </div>
  )
}

function Stat({ label, value, children, mono = false }: { label: string; value?: string; children?: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-caption text-navy/45">{label}</div>
      <div className={`mt-0.5 truncate font-medium text-navy-ink ${mono ? 'font-mono text-caption' : ''}`}>{children ?? value}</div>
    </div>
  )
}

function BadgeList({ values, tone }: { values: string[]; tone: 'critical' | 'gold' | 'teal' }) {
  if (!values.length) return null
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {values.map((value) => <Badge key={value} tone={tone} icon={false}>{value.replace(/_/g, ' ')}</Badge>)}
    </div>
  )
}

function CacheBadge({ status }: { status: string | null }) {
  if (status === 'hit') return <Badge tone="emerald">Cache hit</Badge>
  if (status === 'miss') return <Badge tone="saffron">Cache miss</Badge>
  if (status?.startsWith('bypass')) return <Badge tone="neutral">{status.replace(/_/g, ' ')}</Badge>
  return <Badge tone="neutral">No cache</Badge>
}

function PreBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="mt-3">
      <div className="mb-1.5 text-caption font-semibold uppercase tracking-wide text-navy/50">{title}</div>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-navy/10 bg-ivory p-3 text-caption text-navy/75">{text}</pre>
    </div>
  )
}
