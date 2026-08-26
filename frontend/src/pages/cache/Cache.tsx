import { useEffect, useMemo, useState } from 'react'
import { PageHeader, AlertBanner, SearchBox } from '../../components/ui/Misc'
import { Card, CardHeader, KpiCard } from '../../components/ui/Card'
import { Table, THead, TH, TBody, TR, TD, EmptyState, TableSkeleton } from '../../components/ui/Table'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { ConfirmDialog } from '../../components/ui/Modal'
import { listProjects } from '../../lib/api/projects'
import { clearCache, invalidateCacheEntry, listCacheEntries } from '../../lib/api/cache'
import type { BackendCacheEntry, BackendCacheSummary, BackendProject } from '../../lib/api/types'
import { useIndusGateStore } from '../../lib/store'
import { inr, num, relative, pct } from '../../lib/format'

const emptySummary: BackendCacheSummary = {
  active_entries: 0,
  hits: 0,
  misses: 0,
  hit_rate: 0,
  tokens_saved: 0,
  cost_saved_inr: 0,
}

export default function Cache() {
  const currentUser = useIndusGateStore((s) => s.currentUser)
  const [entries, setEntries] = useState<BackendCacheEntry[]>([])
  const [projects, setProjects] = useState<BackendProject[]>([])
  const [summary, setSummary] = useState<BackendCacheSummary>(emptySummary)
  const [projectFilter, setProjectFilter] = useState('')
  const [search, setSearch] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [clearing, setClearing] = useState(false)

  const canWrite = currentUser?.role !== 'auditor' && currentUser?.role !== 'billing_viewer' && currentUser?.role !== 'read_only_viewer'
  const projectNames = useMemo(() => new Map(projects.map((project) => [project.id, project.name])), [projects])
  const visibleEntries = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return entries
    return entries.filter((entry) =>
      entry.prompt_preview.toLowerCase().includes(needle) ||
      entry.alias.toLowerCase().includes(needle) ||
      entry.provider_model.toLowerCase().includes(needle) ||
      (projectNames.get(entry.project_id) || entry.project_id).toLowerCase().includes(needle)
    )
  }, [entries, projectNames, search])

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const [cacheResult, projectResult] = await Promise.all([
        listCacheEntries({ project: projectFilter || undefined, includeInactive }),
        listProjects(),
      ])
      setEntries(cacheResult.entries)
      setSummary(cacheResult.summary)
      setProjects(projectResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load cache entries')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [projectFilter, includeInactive])

  async function onInvalidate(entry: BackendCacheEntry) {
    setBusyId(entry.id)
    setError(null)
    try {
      await invalidateCacheEntry(entry.id)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to invalidate cache entry')
    } finally {
      setBusyId(null)
    }
  }

  async function onClear() {
    setClearing(true)
    setError(null)
    try {
      await clearCache(projectFilter || undefined)
      setConfirmClear(false)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to clear cache')
    } finally {
      setClearing(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Semantic Cache"
        description="Gateway responses cached per project and public model alias after privacy checks. Hits skip provider calls and settle usage at zero provider tokens."
        action={canWrite ? <Button variant="destructive" size="sm" onClick={() => setConfirmClear(true)}>Clear cache</Button> : undefined}
      />

      {error && <div className="mb-4"><AlertBanner kind="error" title="Cache unavailable">{error}</AlertBanner></div>}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <KpiCard label="Active entries" value={num(summary.active_entries)} />
        <KpiCard label="Cache hits" value={num(summary.hits)} tone="positive" />
        <KpiCard label="Cache misses" value={num(summary.misses)} />
        <KpiCard label="Hit rate" value={pct(summary.hit_rate)} tone={summary.hit_rate > 0 ? 'positive' : 'default'} />
        <KpiCard label="Cost saved" value={inr(summary.cost_saved_inr)} tone="positive" />
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Cache entries"
          description={`${num(summary.tokens_saved)} tokens saved across active entries`}
          action={<Button variant="ghost" size="sm" onClick={refresh} loading={loading}>Refresh</Button>}
        />
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <SearchBox value={search} onChange={setSearch} placeholder="Search cache" />
          <select
            value={projectFilter}
            onChange={(event) => setProjectFilter(event.target.value)}
            className="h-10 rounded-md border border-navy/20 bg-white px-3 text-table text-navy-ink focus:border-saffron focus:outline-none focus:ring-2 focus:ring-saffron/25"
          >
            <option value="">All projects</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
          <label className="inline-flex h-10 items-center gap-2 rounded-md border border-navy/20 px-3 text-table text-navy/70">
            <input type="checkbox" checked={includeInactive} onChange={(event) => setIncludeInactive(event.target.checked)} />
            Include inactive
          </label>
        </div>

        {loading ? (
          <TableSkeleton rows={6} cols={8} />
        ) : visibleEntries.length === 0 ? (
          <EmptyState title="Cache is empty" description="Run a repeated non-sensitive prompt through the gateway to populate cache entries." />
        ) : (
          <Table>
            <THead>
              <TH>Prompt preview</TH>
              <TH>Project</TH>
              <TH>Alias</TH>
              <TH align="right">Hits</TH>
              <TH align="right">Similarity</TH>
              <TH align="right">Tokens saved</TH>
              <TH align="right">Cost saved</TH>
              <TH>Status</TH>
              <TH>Actions</TH>
            </THead>
            <TBody>
              {visibleEntries.map((entry) => (
                <TR key={entry.id}>
                  <TD className="max-w-[300px] truncate">{entry.prompt_preview || entry.prompt_hash.slice(0, 12)}</TD>
                  <TD>{projectNames.get(entry.project_id) || entry.project_id}</TD>
                  <TD mono>{entry.alias}</TD>
                  <TD align="right">{num(entry.hits)}</TD>
                  <TD align="right"><Badge tone={entry.last_similarity >= 0.98 ? 'emerald' : 'saffron'} icon={false}>{pct(entry.last_similarity, 1)}</Badge></TD>
                  <TD align="right">{num(entry.tokens_saved)}</TD>
                  <TD align="right">{inr(entry.cost_saved_inr)}</TD>
                  <TD>
                    {entry.active ? <Badge tone="emerald">Active</Badge> : <Badge tone="neutral">Inactive</Badge>}
                    <div className="mt-1 text-caption text-navy/45">{entry.last_hit_at ? `Hit ${relative(entry.last_hit_at)}` : `Created ${relative(entry.created_at)}`}</div>
                  </TD>
                  <TD align="right">
                    {canWrite && entry.active && (
                      <Button size="sm" variant="ghost" loading={busyId === entry.id} onClick={() => onInvalidate(entry)}>
                        Invalidate
                      </Button>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={onClear}
        loading={clearing}
        title={projectFilter ? 'Clear project cache?' : 'Clear all cache entries?'}
        description={projectFilter ? 'This invalidates active cache entries for the selected project only.' : 'This invalidates every active cached response across all projects.'}
        confirmLabel="Clear cache"
      />
    </div>
  )
}
