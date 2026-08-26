import { useEffect, useMemo, useState } from 'react'
import { PageHeader, SearchBox } from '../../components/ui/Misc'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Form'
import { EmptyState } from '../../components/ui/Table'
import * as providersApi from '../../lib/api/providers'
import type { BackendAlert } from '../../lib/api/types'
import { relative } from '../../lib/format'
import { Icon } from '../../components/ui/Icons'
import { useNavigate } from 'react-router-dom'

const severityTone: Record<string, 'teal' | 'saffron' | 'critical'> = { info: 'teal', warning: 'saffron', critical: 'critical' }

export default function Alerts() {
  const [alerts, setAlerts] = useState<BackendAlert[]>([])
  const [severity, setSeverity] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  async function load() {
    setLoading(true)
    try {
      setAlerts(await providersApi.listAlerts())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const filtered = useMemo(() => alerts.filter((a) => {
    if (severity !== 'all' && a.severity !== severity) return false
    if (search && !`${a.title} ${a.description} ${a.provider_name ?? ''}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [alerts, severity, search])

  const unreadCount = alerts.filter((a) => !a.read).length

  async function markRead(id: string) {
    await providersApi.markAlertRead(id)
    await load()
  }

  async function markAllRead() {
    await providersApi.markAllAlertsRead()
    await load()
  }

  return (
    <div>
      <PageHeader
        title="Alerts & Notifications"
        description="Backend alerts for provider outages, recoveries, budget thresholds, and policy events."
        action={unreadCount > 0 ? <Button variant="ghost" size="sm" onClick={markAllRead}>Mark all as read ({unreadCount})</Button> : undefined}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchBox value={search} onChange={setSearch} placeholder="Search alerts..." />
        <Select value={severity} onChange={(e) => setSeverity(e.target.value)} className="w-auto" aria-label="Filter by severity">
          <option value="all">All severities</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </Select>
      </div>

      {loading ? (
        <div className="rounded-lg border border-navy/10 bg-white py-16 text-center text-table text-navy/50">Loading alerts...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-navy/10 bg-white"><EmptyState title="No alerts match your filters" description="All current backend alerts are clear." /></div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map((a) => (
            <Card key={a.id} className={!a.read ? 'border-l-4 border-l-saffron' : undefined}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Icon.Warn className={`mt-0.5 h-5 w-5 flex-shrink-0 ${a.severity === 'critical' ? 'text-critical' : a.severity === 'warning' ? 'text-saffron-deep' : 'text-teal'}`} />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-table font-semibold text-navy-ink">{a.title}</span>
                      <Badge tone={severityTone[a.severity]}>{a.severity}</Badge>
                      {a.resolved_at && <Badge tone="emerald">Resolved</Badge>}
                      {!a.read && <span className="h-2 w-2 rounded-full bg-saffron" aria-label="Unread" />}
                    </div>
                    <p className="mt-1 text-table text-navy/60">{a.description}</p>
                    <div className="mt-1.5 flex items-center gap-3 text-caption text-navy/40">
                      <span>{relative(a.created_at)}</span>
                      {a.provider_id && <button onClick={() => navigate('/health')} className="font-semibold text-saffron-deep">View provider health</button>}
                    </div>
                  </div>
                </div>
                {!a.read && <Button size="sm" variant="ghost" onClick={() => markRead(a.id)}>Mark read</Button>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
