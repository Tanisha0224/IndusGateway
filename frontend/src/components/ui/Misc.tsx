import clsx from 'clsx'
import { ReactNode, useState } from 'react'

// Tabs -----------------------------------------------------------------------
export function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: string }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="flex gap-1 border-b border-navy/10" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          onClick={() => onChange(t.id)}
          className={clsx(
            'relative -mb-px border-b-2 px-4 py-2.5 text-table font-semibold transition-colors',
            active === t.id ? 'border-saffron text-saffron-deep' : 'border-transparent text-navy/55 hover:text-navy'
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// Tooltip ----------------------------------------------------------------
export function Tooltip({ content, children }: { content: string; children: ReactNode }) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative inline-flex" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)} onFocus={() => setShow(true)} onBlur={() => setShow(false)}>
      {children}
      {show && (
        <span role="tooltip" className="absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-xs -translate-x-1/2 rounded-md bg-navy-ink px-2.5 py-1.5 text-caption text-white shadow-raised">
          {content}
        </span>
      )}
    </span>
  )
}

// Alert banners ----------------------------------------------------------
type AlertKind = 'success' | 'warning' | 'error' | 'ai'
const alertStyles: Record<AlertKind, { bg: string; border: string; title: string; icon: string }> = {
  success: { bg: 'bg-emerald/6', border: 'border-emerald/25', title: 'text-emerald-deep', icon: '#0F7B3E' },
  warning: { bg: 'bg-saffron/6', border: 'border-saffron/25', title: 'text-saffron-deep', icon: '#C95F0E' },
  error: { bg: 'bg-critical/6', border: 'border-critical/25', title: 'text-critical', icon: '#DC2626' },
  ai: { bg: 'bg-teal/6', border: 'border-teal/25', title: 'text-sky-700', icon: '#0EA5E9' },
}

export function AlertBanner({ kind, title, children }: { kind: AlertKind; title: string; children?: ReactNode }) {
  const s = alertStyles[kind]
  return (
    <div className={clsx('flex gap-3 rounded-lg border px-4 py-3.5', s.bg, s.border)} role="status">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="mt-0.5 flex-shrink-0" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke={s.icon} strokeWidth="1.75" />
        <path d="M12 8v5M12 16h.01" stroke={s.icon} strokeWidth="1.75" strokeLinecap="round" />
      </svg>
      <div>
        <div className={clsx('text-table font-semibold', s.title)}>{title}</div>
        {children && <div className="mt-0.5 text-table text-navy/65">{children}</div>}
      </div>
    </div>
  )
}

// Pagination ---------------------------------------------------------------
export function Pagination({ page, pageCount, onChange, totalItems, pageSize }: { page: number; pageCount: number; onChange: (p: number) => void; totalItems: number; pageSize: number }) {
  if (pageCount <= 1) return null
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, totalItems)
  return (
    <div className="flex items-center justify-between border-t border-navy/10 px-4 py-3 text-table text-navy/60">
      <span>Showing {start}–{end} of {totalItems}</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1} className="h-8 rounded-md border border-navy/20 px-3 disabled:opacity-40">Previous</button>
        <span className="px-2 tnum">{page} / {pageCount}</span>
        <button onClick={() => onChange(Math.min(pageCount, page + 1))} disabled={page === pageCount} className="h-8 rounded-md border border-navy/20 px-3 disabled:opacity-40">Next</button>
      </div>
    </div>
  )
}

// Breadcrumbs ----------------------------------------------------------------
export function PageHeader({ title, description, action, breadcrumb }: { title: string; description?: string; action?: ReactNode; breadcrumb?: string }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        {breadcrumb && <div className="mb-1 text-caption font-semibold uppercase tracking-wide text-navy/45">{breadcrumb}</div>}
        <h1 className="font-heading text-h1 font-bold text-navy-ink">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-body text-navy/60">{description}</p>}
      </div>
      {action}
    </div>
  )
}

// Search box ----------------------------------------------------------------
export function SearchBox({ value, onChange, placeholder = 'Search…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy/40" width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.75" /><path d="M21 21l-4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-10 w-64 rounded-md border border-navy/20 bg-white pl-9 pr-3 text-table text-navy-ink placeholder:text-navy/40 focus:border-saffron focus:outline-none focus:ring-2 focus:ring-saffron/25" />
    </div>
  )
}
