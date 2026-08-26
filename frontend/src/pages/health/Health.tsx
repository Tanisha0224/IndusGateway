import { useEffect, useState } from 'react'
import { PageHeader, AlertBanner } from '../../components/ui/Misc'
import { Card, CardHeader } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { ApiError } from '../../lib/api/client'
import * as providersApi from '../../lib/api/providers'
import type { BackendProviderHealth, BackendProviderHealthEvent, ProviderCircuitState, ProviderHealthStatus } from '../../lib/api/types'
import { relative } from '../../lib/format'
import { Icon } from '../../components/ui/Icons'
import { useIndusGateStore } from '../../lib/store'

const healthTone: Record<ProviderHealthStatus, 'emerald' | 'saffron' | 'critical' | 'neutral'> = {
  healthy: 'emerald',
  degraded: 'saffron',
  unhealthy: 'critical',
  unknown: 'neutral',
}

const circuitTone: Record<ProviderCircuitState, 'emerald' | 'saffron' | 'critical'> = {
  closed: 'emerald',
  half_open: 'saffron',
  open: 'critical',
}

export default function Health() {
  const currentUser = useIndusGateStore((s) => s.currentUser)
  const canWrite = currentUser?.role !== 'auditor' && currentUser?.role !== 'billing_viewer' && currentUser?.role !== 'read_only_viewer'
  const [health, setHealth] = useState<BackendProviderHealth[]>([])
  const [history, setHistory] = useState<BackendProviderHealthEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyProvider, setBusyProvider] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const [healthRows, historyRows] = await Promise.all([providersApi.listProviderHealth(), providersApi.listProviderHealthHistory()])
      setHealth(healthRows)
      setHistory(historyRows)
      setError('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load provider health.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function runAction(providerId: string, action: 'check' | 'reset') {
    setBusyProvider(providerId)
    try {
      if (action === 'check') await providersApi.checkProvider(providerId)
      else await providersApi.resetProviderCircuit(providerId)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Provider health action failed.')
    } finally {
      setBusyProvider(null)
    }
  }

  const openIncidents = history.filter((event) => event.status === 'unhealthy' || event.circuit_state === 'open')

  return (
    <div>
      <PageHeader title="Provider Health" description="Real provider /models checks, circuit-breaker state, and routing eligibility for each backend provider." />

      {error && <div className="mb-4"><AlertBanner kind="error" title="Provider health unavailable">{error}</AlertBanner></div>}
      {!loading && health.length === 0 && <div className="mb-4"><AlertBanner kind="warning" title="No provider health rows">No providers are registered for monitoring.</AlertBanner></div>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {health.map((row) => (
          <Card key={row.provider_id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-heading text-body-lg font-semibold text-navy-ink">{row.provider_name}</div>
                <div className="text-caption text-navy/50">{row.provider_type ?? 'provider'} · {row.provider_id}</div>
              </div>
              <Badge tone={healthTone[row.status]}>{row.status}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone={circuitTone[row.circuit_state]}>Circuit: {row.circuit_state.replace('_', ' ')}</Badge>
              {row.status === 'unhealthy' || row.circuit_state !== 'closed' ? <Badge tone="critical">Excluded from routing</Badge> : <Badge tone="emerald">Routable</Badge>}
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-2.5 text-table">
              <div><dt className="text-caption text-navy/45">Failures</dt><dd className="font-medium text-navy-ink">{row.consecutive_failures}</dd></div>
              <div><dt className="text-caption text-navy/45">Successes</dt><dd className="font-medium text-navy-ink">{row.consecutive_successes}</dd></div>
              <div><dt className="text-caption text-navy/45">Latency</dt><dd className="font-medium text-navy-ink">{row.last_latency_ms == null ? 'n/a' : `${row.last_latency_ms}ms`}</dd></div>
              <div><dt className="text-caption text-navy/45">Last error</dt><dd className="font-medium text-navy-ink">{row.last_error ?? 'None'}</dd></div>
              <div className="col-span-2"><dt className="text-caption text-navy/45">Last checked</dt><dd className="font-medium text-navy-ink">{row.last_checked_at ? relative(row.last_checked_at) : 'Never'}</dd></div>
            </dl>
            {canWrite && (
              <div className="mt-4 flex gap-2 border-t border-navy/8 pt-3">
                <Button size="sm" variant="ghost" loading={busyProvider === row.provider_id} onClick={() => runAction(row.provider_id, 'check')}>Check now</Button>
                <Button size="sm" variant="confirm" loading={busyProvider === row.provider_id} onClick={() => runAction(row.provider_id, 'reset')}>Reset circuit</Button>
              </div>
            )}
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader title="Health history" description={`${openIncidents.length} unhealthy/open event(s) recorded in recent history`} />
        <div className="flex flex-col gap-3">
          {history.length === 0 && <p className="text-table text-navy/55">No provider checks recorded yet.</p>}
          {history.map((event) => (
            <div key={event.id} className="flex items-start justify-between gap-4 border-b border-navy/8 pb-3 last:border-0">
              <div className="flex items-start gap-3">
                <Icon.Warn className={`mt-0.5 h-4 w-4 flex-shrink-0 ${event.status === 'unhealthy' ? 'text-critical' : event.status === 'degraded' ? 'text-saffron-deep' : 'text-emerald'}`} />
                <div>
                  <div className="text-table font-medium text-navy-ink">{event.provider_name}</div>
                  <p className="text-caption text-navy/55">{event.source} · {event.result}{event.error ? ` · ${event.error}` : ''}</p>
                  <div className="mt-1 text-caption text-navy/40">{relative(event.created_at)}</div>
                </div>
              </div>
              <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                <Badge tone={healthTone[event.status]}>{event.status}</Badge>
                <Badge tone={circuitTone[event.circuit_state]}>{event.circuit_state.replace('_', ' ')}</Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
