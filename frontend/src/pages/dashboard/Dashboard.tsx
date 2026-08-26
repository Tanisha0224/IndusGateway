import { useEffect, useMemo, useState } from 'react'
import { PageHeader, AlertBanner } from '../../components/ui/Misc'
import { Card, CardHeader, KpiCard } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Select } from '../../components/ui/Form'
import { inr, num, pct, relative, dateShort } from '../../lib/format'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts'
import { Icon } from '../../components/ui/Icons'
import * as dashboardApi from '../../lib/api/dashboard'
import { ApiError } from '../../lib/api/client'
import type { BackendDashboardSummary } from '../../lib/api/types'

const CHART_COLORS = ['#E87722', '#0F7B3E', '#1A2B4A', '#0EA5E9', '#C9A961', '#FFA940']

export default function Dashboard() {
  const [range, setRange] = useState('30')
  const [summary, setSummary] = useState<BackendDashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    dashboardApi.getDashboardSummary(Number(range))
      .then((data) => {
        setSummary(data)
        setError('')
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load dashboard summary.'))
      .finally(() => setLoading(false))
  }, [range])

  const budgetTotals = useMemo(() => {
    const rows = summary?.usage_summary ?? []
    const budget = rows.reduce((acc, row) => acc + (row.monthly_budget_inr ?? 0), 0)
    const spend = rows.reduce((acc, row) => acc + row.spend_this_month_inr, 0)
    return { budget, spend, utilisation: budget > 0 ? spend / budget : 0 }
  }, [summary])

  const sovereignVsExternal = useMemo(() => {
    const rows = summary?.sovereign_vs_external ?? []
    const total = rows.reduce((acc, row) => acc + row.value, 0)
    if (total === 0) return [{ name: 'No routed traffic yet', value: 1 }]
    return rows.map((row) => ({ ...row, value: Math.round((row.value / total) * 100) }))
  }, [summary])

  const kpis = summary?.kpis

  return (
    <div>
      <PageHeader
        title="Executive Dashboard"
        description="Backend-backed overview of gateway traffic, sovereignty posture, spend, and provider health."
        action={
          <Select value={range} onChange={(e) => setRange(e.target.value)} aria-label="Date range filter">
            <option value="7">Last 7 days</option>
            <option value="14">Last 14 days</option>
            <option value="30">Last 30 days</option>
          </Select>
        }
      />

      {error && <div className="mb-4"><AlertBanner kind="error" title="Dashboard unavailable">{error}</AlertBanner></div>}
      {loading && <div className="mb-4 rounded-lg border border-navy/10 bg-white py-10 text-center text-table text-navy/50">Loading backend dashboard...</div>}
      {!loading && summary && kpis && kpis.total_requests === 0 && (
        <div className="mb-4"><AlertBanner kind="ai" title="No gateway traffic yet">The dashboard is connected to backend state. Send requests through the Playground to populate live trace, routing, and cost charts.</AlertBanner></div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        <KpiCard label="Total requests" value={num(kpis?.total_requests ?? 0)} sub={`${range}-day backend window`} />
        <KpiCard label="Tokens consumed" value={num(kpis?.total_tokens ?? 0)} sub="From gateway traces" />
        <KpiCard label="Estimated spend" value={inr(kpis?.estimated_spend_inr ?? 0)} sub="Reserved/settled backend cost" />
        <KpiCard label="Budget utilisation" value={pct(budgetTotals.utilisation)} tone={budgetTotals.utilisation >= 1 ? 'critical' : budgetTotals.utilisation >= 0.8 ? 'warning' : 'default'} sub={`${inr(budgetTotals.spend)} of ${inr(budgetTotals.budget)}`} />
        <KpiCard label="Average latency" value={Math.round(kpis?.avg_latency_ms ?? 0) + 'ms'} sub="Completed gateway requests" />
        <KpiCard label="Error rate" value={pct(kpis?.error_rate ?? 0, 1)} tone={(kpis?.error_rate ?? 0) > 0.02 ? 'warning' : 'default'} sub="Failed, blocked, or budget-blocked" />
        <KpiCard label="Sovereign traffic" value={pct(kpis?.sovereign_rate ?? 0)} tone="positive" sub="India-hosted route share" />
        <KpiCard label="PII values masked" value={num(kpis?.pii_values_masked ?? 0)} sub="Before provider/client egress" />
        <KpiCard label="Active virtual keys" value={kpis?.active_virtual_keys ?? 0} sub={`${kpis?.total_virtual_keys ?? 0} total keys`} />
        <KpiCard label="Provider incidents" value={kpis?.open_provider_incidents ?? 0} tone={(kpis?.open_provider_incidents ?? 0) > 0 ? 'warning' : 'default'} sub="Open circuit/unhealthy providers" />
        <KpiCard label="Healthy providers" value={`${kpis?.healthy_providers ?? 0}/${kpis?.total_providers ?? 0}`} sub="Backend health state" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Cost trend" description="Daily estimated spend from backend gateway traces." />
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={summary?.trend ?? []}>
              <defs>
                <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E87722" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#E87722" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1A2B4A15" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(d) => dateShort(d).slice(0, 6)} tick={{ fontSize: 11, fill: '#1A2B4A99' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#1A2B4A99' }} axisLine={false} tickLine={false} tickFormatter={(v) => 'Rs ' + v} />
              <RTooltip formatter={(v: any) => inr(v)} labelFormatter={(d: any) => dateShort(d)} />
              <Area type="monotone" dataKey="spend_inr" stroke="#E87722" strokeWidth={2} fill="url(#costGrad)" name="Estimated spend" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <CardHeader title="Sovereign vs. external traffic" description="Backend route decisions in the selected window." />
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={sovereignVsExternal} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2} isAnimationActive={false}>
                {sovereignVsExternal.map((_, i) => <Cell key={i} fill={i === 0 ? '#0F7B3E' : '#E87722'} />)}
              </Pie>
              <RTooltip formatter={(v: any) => v + '%'} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 flex justify-center gap-4 text-caption">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald" />Sovereign / India-hosted</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-saffron" />External</span>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Spend by provider" />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={summary?.spend_by_provider ?? []}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#1A2B4A99' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#1A2B4A99' }} axisLine={false} tickLine={false} tickFormatter={(v) => 'Rs ' + v} />
              <RTooltip formatter={(v: any) => inr(v)} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {(summary?.spend_by_provider ?? []).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <CardHeader title="Usage by model" />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={summary?.usage_by_model ?? []} layout="vertical" margin={{ left: 8 }}>
              <XAxis type="number" tick={{ fontSize: 11, fill: '#1A2B4A99' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 10, fill: '#1A2B4A99' }} axisLine={false} tickLine={false} />
              <RTooltip formatter={(v: any) => num(v) + ' requests'} />
              <Bar dataKey="value" fill="#0F7B3E" radius={[0, 4, 4, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recent backend alerts" action={<a href="/alerts" className="text-table font-semibold text-saffron-deep">View all</a>} />
          <div className="flex flex-col gap-3">
            {(summary?.recent_alerts ?? []).length === 0 && <p className="text-table text-navy/55">No backend alerts recorded.</p>}
            {(summary?.recent_alerts ?? []).map((a) => (
              <div key={a.id} className="flex items-start gap-3 border-b border-navy/8 pb-3 last:border-0 last:pb-0">
                <Icon.Warn className={`mt-0.5 h-4 w-4 flex-shrink-0 ${a.severity === 'critical' ? 'text-critical' : a.severity === 'warning' ? 'text-saffron-deep' : 'text-teal'}`} />
                <div className="min-w-0">
                  <div className="text-table font-medium text-navy-ink">{a.title}</div>
                  <div className="text-caption text-navy/50">{relative(a.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Recent backend activity" action={<a href="/audit" className="text-table font-semibold text-saffron-deep">View audit log</a>} />
          <div className="flex flex-col gap-3">
            {(summary?.recent_activity ?? []).map((e) => (
              <div key={e.id} className="flex items-start justify-between gap-3 border-b border-navy/8 pb-3 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <div className="truncate text-table font-medium text-navy-ink">{e.action.replace(/_/g, ' ').replace(/\./g, ' / ')}</div>
                  <div className="text-caption text-navy/50">{e.actor_type} / {relative(e.created_at)}</div>
                </div>
                <Badge tone="emerald">{e.resource_type}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
