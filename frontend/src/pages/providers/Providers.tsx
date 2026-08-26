import { useEffect, useMemo, useState } from 'react'
import { PageHeader, SearchBox, AlertBanner } from '../../components/ui/Misc'
import { Table, THead, TH, TBody, TR, TD, EmptyState } from '../../components/ui/Table'
import { Badge } from '../../components/ui/Badge'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Field, Select, TextArea, TextInput } from '../../components/ui/Form'
import { useIndusGateStore } from '../../lib/store'
import { ApiError } from '../../lib/api/client'
import { dateTime, relative } from '../../lib/format'
import type { BackendProvider } from '../../lib/api/types'
import * as providersApi from '../../lib/api/providers'

const sourceTone = { environment: 'navy', encrypted_store: 'emerald', missing: 'critical' } as const

export default function Providers() {
  const realProviders = useIndusGateStore((s) => s.realProviders)
  const fetchRealProviders = useIndusGateStore((s) => s.fetchRealProviders)
  const currentUser = useIndusGateStore((s) => s.currentUser)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [editing, setEditing] = useState<BackendProvider | null>(null)
  const [creating, setCreating] = useState(false)
  const [credentialProvider, setCredentialProvider] = useState<BackendProvider | null>(null)
  const [modelsProvider, setModelsProvider] = useState<BackendProvider | null>(null)
  const [disableProvider, setDisableProvider] = useState<BackendProvider | null>(null)
  const [busyId, setBusyId] = useState('')
  const [testResult, setTestResult] = useState('')
  const canWrite = currentUser?.role === 'platform_admin' || currentUser?.role === 'org_admin'

  async function load() {
    setLoading(true)
    try {
      await fetchRealProviders()
      setLoadError('')
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load providers.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [fetchRealProviders])

  const filtered = useMemo(() => realProviders.filter((p) => {
    const haystack = `${p.name} ${p.provider_type} ${p.base_url}`.toLowerCase()
    return !search || haystack.includes(search.toLowerCase())
  }), [realProviders, search])

  async function testProvider(provider: BackendProvider) {
    setBusyId(provider.id)
    setTestResult('')
    try {
      const result = await providersApi.testProvider(provider.id)
      setTestResult(`${provider.name}: ${result.status}, circuit ${result.circuit_state}${result.last_error ? `, ${result.last_error}` : ''}`)
      await load()
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Connection test failed.')
    } finally {
      setBusyId('')
    }
  }

  return (
    <div>
      <PageHeader
        title="Models & Providers"
        description="Configure upstream LLM providers, encrypted credentials, model catalogs, pricing metadata, and connection health."
        action={canWrite ? <Button size="sm" onClick={() => setCreating(true)}>Add provider</Button> : undefined}
      />

      {loadError && <div className="mb-4"><AlertBanner kind="error" title="Something went wrong">{loadError}</AlertBanner></div>}
      {testResult && <div className="mb-4"><AlertBanner kind="success" title="Connection test recorded">{testResult}</AlertBanner></div>}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchBox value={search} onChange={setSearch} placeholder="Search provider..." />
      </div>

      {loading ? (
        <div className="rounded-lg border border-navy/10 bg-white py-20 text-center text-table text-navy/50">Loading providers...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-navy/10 bg-white"><EmptyState title="No providers match your search" description="Try clearing the search or add a provider." /></div>
      ) : (
        <Table>
          <THead>
            <TH>Provider</TH><TH>Capabilities</TH><TH>Credential</TH><TH>Models</TH><TH>Created</TH><TH>Status</TH><TH align="right">Actions</TH>
          </THead>
          <TBody>
            {filtered.map((p) => (
              <TR key={p.id}>
                <TD>
                  <div className="text-table font-semibold text-navy-ink">{p.name}</div>
                  <div className="font-mono text-caption text-navy/50">{p.provider_type} / {p.base_url}</div>
                </TD>
                <TD>
                  <div className="flex flex-wrap gap-1.5">
                    {p.supports_chat && <Badge tone="navy" icon={false}>Chat</Badge>}
                    {p.supports_streaming && <Badge tone="navy" icon={false}>Streaming</Badge>}
                    {p.supports_embeddings && <Badge tone="navy" icon={false}>Embeddings</Badge>}
                  </div>
                </TD>
                <TD>
                  <Badge tone={sourceTone[p.credential_source ?? 'missing']}>{p.credential_source ?? 'missing'}</Badge>
                  {p.credential_last_updated_at && <div className="mt-1 text-caption text-navy/45">{relative(p.credential_last_updated_at)}</div>}
                </TD>
                <TD>{p.models?.length ?? 0}</TD>
                <TD className="text-navy/60">{dateTime(p.created_at)}</TD>
                <TD>{p.is_active ? <Badge tone="emerald">Active</Badge> : <Badge tone="critical">Inactive</Badge>}</TD>
                <TD align="right">
                  {canWrite && (
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>Edit</Button>
                      <Button size="sm" variant="ghost" onClick={() => setModelsProvider(p)}>Models</Button>
                      <Button size="sm" variant="ghost" onClick={() => setCredentialProvider(p)}>Credential</Button>
                      <Button size="sm" variant="confirm" loading={busyId === p.id} onClick={() => testProvider(p)}>Test</Button>
                      {p.is_active && <Button size="sm" variant="destructive" onClick={() => setDisableProvider(p)}>Disable</Button>}
                    </div>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      {(creating || editing) && (
        <ProviderModal
          provider={editing}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSaved={async () => { setCreating(false); setEditing(null); await load() }}
        />
      )}
      {credentialProvider && <CredentialModal provider={credentialProvider} onClose={() => setCredentialProvider(null)} onSaved={async () => { setCredentialProvider(null); await load() }} />}
      {modelsProvider && <ModelsModal provider={modelsProvider} onClose={() => setModelsProvider(null)} onSaved={async () => { setModelsProvider(null); await load() }} />}
      <ConfirmDialog
        open={!!disableProvider}
        onClose={() => setDisableProvider(null)}
        onConfirm={async () => {
          if (!disableProvider) return
          await providersApi.disableProvider(disableProvider.id)
          setDisableProvider(null)
          await load()
        }}
        title="Disable provider?"
        description="The provider remains in configuration history, but inactive providers are excluded from routing."
        confirmLabel="Disable provider"
      />
    </div>
  )
}

function ProviderModal({ provider, onClose, onSaved }: { provider: BackendProvider | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(provider?.name ?? '')
  const [providerType, setProviderType] = useState(provider?.provider_type ?? 'openai_compatible')
  const [baseUrl, setBaseUrl] = useState(provider?.base_url ?? '')
  const [active, setActive] = useState(provider?.is_active ?? true)
  const [chat, setChat] = useState(provider?.supports_chat ?? true)
  const [streaming, setStreaming] = useState(provider?.supports_streaming ?? true)
  const [embeddings, setEmbeddings] = useState(provider?.supports_embeddings ?? false)
  const [inputPrice, setInputPrice] = useState(String((provider?.pricing_json?.input_per_1k_inr as number | undefined) ?? ''))
  const [outputPrice, setOutputPrice] = useState(String((provider?.pricing_json?.output_per_1k_inr as number | undefined) ?? ''))
  const [models, setModels] = useState((provider?.models ?? []).join('\n'))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const valid = name.trim().length >= 2 && baseUrl.trim().length > 0

  async function save() {
    if (!valid) return
    setSaving(true)
    setError('')
    const pricing_json = {
      input_per_1k_inr: inputPrice ? Number(inputPrice) : null,
      output_per_1k_inr: outputPrice ? Number(outputPrice) : null,
    }
    try {
      if (provider) {
        await providersApi.updateProvider(provider.id, {
          name,
          provider_type: providerType,
          base_url: baseUrl,
          is_active: active,
          supports_chat: chat,
          supports_streaming: streaming,
          supports_embeddings: embeddings,
          pricing_json,
        })
      } else {
        await providersApi.createProvider({
          name,
          provider_type: providerType,
          base_url: baseUrl,
          is_active: active,
          supports_chat: chat,
          supports_streaming: streaming,
          supports_embeddings: embeddings,
          pricing_json,
          models: models.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean),
        })
      }
      await onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save provider.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={provider ? 'Edit provider' : 'Add provider'} size="lg" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} loading={saving} disabled={!valid}>Save provider</Button></>}>
      {error && <div className="mb-4"><AlertBanner kind="error" title="Could not save provider">{error}</AlertBanner></div>}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name" required><TextInput value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Provider type" required>
          <Select value={providerType} onChange={(e) => setProviderType(e.target.value)}>
            <option value="openai_compatible">OpenAI-compatible</option>
            <option value="external">External</option>
            <option value="india_hosted">India-hosted</option>
            <option value="gemini">Gemini</option>
          </Select>
        </Field>
        <Field label="Base URL" required><TextInput value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://provider.example/v1" /></Field>
        <Field label="Status" required><Select value={active ? 'active' : 'inactive'} onChange={(e) => setActive(e.target.value === 'active')}><option value="active">Active</option><option value="inactive">Inactive</option></Select></Field>
        <Field label="Input price per 1K tokens"><TextInput value={inputPrice} onChange={(e) => setInputPrice(e.target.value)} inputMode="decimal" /></Field>
        <Field label="Output price per 1K tokens"><TextInput value={outputPrice} onChange={(e) => setOutputPrice(e.target.value)} inputMode="decimal" /></Field>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-3">
        <label className="flex items-center gap-2 text-table"><input type="checkbox" checked={chat} onChange={(e) => setChat(e.target.checked)} /> Chat</label>
        <label className="flex items-center gap-2 text-table"><input type="checkbox" checked={streaming} onChange={(e) => setStreaming(e.target.checked)} /> Streaming</label>
        <label className="flex items-center gap-2 text-table"><input type="checkbox" checked={embeddings} onChange={(e) => setEmbeddings(e.target.checked)} /> Embeddings</label>
      </div>
      {!provider && <div className="mt-4"><Field label="Initial models" helper="One model per line or comma-separated."><TextArea value={models} onChange={(e) => setModels(e.target.value)} /></Field></div>}
    </Modal>
  )
}

function CredentialModal({ provider, onClose, onSaved }: { provider: BackendProvider; onClose: () => void; onSaved: () => Promise<void> }) {
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!apiKey.trim()) return
    setSaving(true)
    setError('')
    try {
      await providersApi.setProviderCredential(provider.id, apiKey)
      await onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update credential.')
    } finally {
      setSaving(false)
    }
  }

  async function clear() {
    setSaving(true)
    setError('')
    try {
      await providersApi.clearProviderCredential(provider.id)
      await onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not clear credential.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Credential for ${provider.name}`} size="md" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button>{provider.credential_source === 'encrypted_store' && <Button variant="destructive" loading={saving} onClick={clear}>Clear</Button>}<Button onClick={save} loading={saving} disabled={!apiKey.trim()}>Save credential</Button></>}>
      {error && <div className="mb-4"><AlertBanner kind="error" title="Credential update failed">{error}</AlertBanner></div>}
      <Field label="API key" required helper="Stored encrypted server-side. The full key is never returned to the browser.">
        <TextInput type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" />
      </Field>
      <div className="mt-4 rounded-md border border-navy/10 bg-ivory p-3 text-table text-navy/60">
        Current source: <span className="font-semibold text-navy-ink">{provider.credential_source ?? 'missing'}</span>
      </div>
    </Modal>
  )
}

function ModelsModal({ provider, onClose, onSaved }: { provider: BackendProvider; onClose: () => void; onSaved: () => Promise<void> }) {
  const [models, setModels] = useState((provider.models ?? []).join('\n'))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setSaving(true)
    setError('')
    try {
      await providersApi.updateProviderModels(provider.id, models.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean))
      await onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update models.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Models for ${provider.name}`} size="md" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} loading={saving}>Save models</Button></>}>
      {error && <div className="mb-4"><AlertBanner kind="error" title="Model update failed">{error}</AlertBanner></div>}
      <Field label="Allowed models" helper="One model per line or comma-separated. These names become selectable when configuring alias targets.">
        <TextArea value={models} onChange={(e) => setModels(e.target.value)} />
      </Field>
    </Modal>
  )
}
