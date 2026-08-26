import clsx from 'clsx'
import { ReactNode } from 'react'

export function Card({ children, className, padded = true }: { children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <div className={clsx('rounded-lg border border-white/70 bg-white/82 shadow-[0_10px_32px_rgba(60,64,67,0.08)] backdrop-blur transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_48px_rgba(60,64,67,0.12)]', padded && 'p-6', className)}>
      {children}
    </div>
  )
}

export function CardHeader({ eyebrow, title, action, description }: { eyebrow?: string; title: ReactNode; action?: ReactNode; description?: string }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        {eyebrow && <div className="mb-1 text-caption font-semibold uppercase tracking-wide text-navy/50">{eyebrow}</div>}
        <h3 className="font-heading text-h3 font-semibold text-navy-ink">{title}</h3>
        {description && <p className="mt-1 text-table text-navy/60">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function KpiCard({ label, value, sub, tone = 'default', icon }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'default' | 'warning' | 'critical' | 'positive'; icon?: ReactNode }) {
  const toneClass = tone === 'warning' ? 'text-saffron-deep' : tone === 'critical' ? 'text-critical' : tone === 'positive' ? 'text-emerald-deep' : 'text-navy-ink'
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="text-table font-medium text-navy/60">{label}</div>
        {icon}
      </div>
      <div className={clsx('mt-2 font-heading text-h2 font-bold tnum', toneClass)}>{value}</div>
      {sub && <div className="mt-1.5 text-caption text-navy/50">{sub}</div>}
    </Card>
  )
}
