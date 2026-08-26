import { useEffect, useMemo, useState } from 'react'
import { PageHeader, AlertBanner } from '../../components/ui/Misc'
import { Card, CardHeader, KpiCard } from '../../components/ui/Card'
import { Table, THead, TH, TBody, TR, TD, EmptyState } from '../../components/ui/Table'
import { Badge } from '../../components/ui/Badge'
import { useIndusGateStore } from '../../lib/store'
import { ApiError } from '../../lib/api/client'
import { inr, num, pct } from '../../lib/format'
import { BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const statusTone: Record<string, 'emerald' | 'saffron' | 'critical' | 'neutral'> = {
  ok: 'emerald', warning: 'saffron', exceeded: 'critical', unlimited: 'neutral',
}
const statusLabel: Record<string, string> = {
  ok: 'Within budget', warning: 'Approaching limit', exceeded: 'Budget exceeded', unlimited: 'No budget set',
}

export default function Billing() {
  const usageSummary = useIndusGateStore((s) => s.usageSummary)
  const fetchUsageSummary = useIndusGateStore((s) => s.fetchUsageSummary)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    setLoading(true)
    fetchUsageSummary()
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'Failed to load usage data.'))
      .finally(() => setLoading(false))
  }, [fetchUsageSummary])

  const totals = useMemo(() => usageSummary.reduce(
    (acc, row) => ({
      spend: acc.spend + row.spend_this_month_inr,
      tokens: acc.tokens + row.total_tokens_this_month,
      requests: acc.requests + row.request_count_this_month,
    }),
    { spend: 0, tokens: 0, requests: 0 }
  ), [usageSummary])

  const spendByProject = useMemo(
    () => usageSummary
      .filter((r) => r.spend_this_month_inr > 0)
      .map((r) => ({ name: r.project_name, value: Math.round(r.spend_this_month_inr * 10000) / 10000 }))
      .sort((a, b) => b.value - a.value),
    [usageSummary]
  )

  return (
    <div>
      <PageHeader
        title="Usage &amp; Billing"
        description="Real spend and token usage this calendar month, computed from actual gateway requests and each provider's published per-token pricing, converted to ₹."
      />

      {loadError && <div className="mb-4"><AlertBanner kind="error" title="Something went wrong">{loadError}</AlertBanner></div>}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Spend this month" value={inr(totals.spend)} />
        <KpiCard label="Tokens consumed" value={num(totals.tokens)} />
        <KpiCard label="Gateway requests" value={num(totals.requests)} />
        <KpiCard
          label="Projects over budget"
          value={usageSummary.filter((r) => r.budget_status === 'exceeded').length}
          tone={usageSummary.some((r) => r.budget_status === 'exceeded') ? 'critical' : 'default'}
        />
      </div>

      {spendByProject.length > 0 && (
        <Card className="mt-4">
          <CardHeader title="Spend by project" description="This calendar month, in ₹." />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={spendByProject}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1A2B4A15" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#1A2B4A99' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#1A2B4A99' }} axisLine={false} tickLine={false} tickFormatter={(v) => '₹' + v} />
              <RTooltip formatter={(v: any) => inr(v, 4)} />
              <Bar dataKey="value" fill="#E87722" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card className="mt-4">
        <CardHeader title="Usage by project" description="Every project you can see, whether or not it has spent anything yet." />
        {loading ? (
          <div className="py-16 text-center text-table text-navy/50">Loading usage…</div>
        ) : usageSummary.length === 0 ? (
          <EmptyState title="No projects yet" description="Create a project from the Virtual Keys page to start tracking usage." />
        ) : (
          <Table>
            <THead>
              <TH>Project</TH><TH align="right">Budget</TH><TH align="right">Spend</TH>
              <TH align="right">Utilisation</TH><TH align="right">Tokens</TH><TH align="right">Requests</TH><TH>Status</TH>
            </THead>
            <TBody>
              {usageSummary.map((row) => (
                <TR key={row.project_id}>
                  <TD className="font-medium text-navy-ink">{row.project_name}</TD>
                  <TD align="right">{row.monthly_budget_inr != null ? inr(row.monthly_budget_inr) : 'Unlimited'}</TD>
                  <TD align="right">{inr(row.spend_this_month_inr, 4)}</TD>
                  <TD align="right">{row.monthly_budget_inr ? pct(Math.min(1, row.spend_this_month_inr / row.monthly_budget_inr)) : '—'}</TD>
                  <TD align="right">{num(row.total_tokens_this_month)}</TD>
                  <TD align="right">{num(row.request_count_this_month)}</TD>
                  <TD><Badge tone={statusTone[row.budget_status]}>{statusLabel[row.budget_status]}</Badge></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  )
}
