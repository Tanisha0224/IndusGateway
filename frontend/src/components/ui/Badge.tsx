import clsx from 'clsx'
import { ReactNode } from 'react'

export type BadgeTone = 'emerald' | 'saffron' | 'critical' | 'navy' | 'teal' | 'gold' | 'neutral'

const toneClasses: Record<BadgeTone, string> = {
  emerald: 'bg-emerald/10 text-emerald-deep border-emerald/25',
  saffron: 'bg-saffron/10 text-saffron-deep border-saffron/25',
  critical: 'bg-critical/10 text-critical border-critical/25',
  navy: 'bg-navy/8 text-navy border-navy/20',
  teal: 'bg-teal/10 text-sky-700 border-teal/25',
  gold: 'bg-gold/15 text-[#8a6d2f] border-gold/35',
  neutral: 'bg-navy/5 text-navy/60 border-navy/10',
}

const dotClasses: Record<BadgeTone, string> = {
  emerald: 'bg-emerald', saffron: 'bg-saffron', critical: 'bg-critical', navy: 'bg-navy',
  teal: 'bg-teal', gold: 'bg-gold', neutral: 'bg-navy/40',
}

export function Badge({ tone = 'neutral', children, icon = true, className }: { tone?: BadgeTone; children: ReactNode; icon?: boolean; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-caption font-semibold font-body leading-none', toneClasses[tone], className)}>
      {icon && <span className={clsx('h-1.5 w-1.5 rounded-full', dotClasses[tone])} aria-hidden="true" />}
      {children}
    </span>
  )
}

// Semantic helpers -----------------------------------------------------------
export function SovereigntyBadge({ status }: { status: 'sovereign' | 'india_hosted' | 'external' }) {
  if (status === 'sovereign') return <Badge tone="emerald">Sovereign route</Badge>
  if (status === 'india_hosted') return <Badge tone="emerald">India-hosted</Badge>
  return <Badge tone="saffron">External route</Badge>
}

export function EgressBadge({ status }: { status: 'not_applicable' | 'allowed' | 'blocked' | 'masked' }) {
  if (status === 'not_applicable') return <Badge tone="neutral">Not applicable</Badge>
  if (status === 'allowed') return <Badge tone="saffron">External egress allowed</Badge>
  if (status === 'blocked') return <Badge tone="critical">External egress blocked</Badge>
  return <Badge tone="gold">Masked before egress</Badge>
}

export function KeyStatusBadge({ status }: { status: 'active' | 'expiring' | 'expired' | 'revoked' }) {
  if (status === 'active') return <Badge tone="emerald">Active</Badge>
  if (status === 'expiring') return <Badge tone="saffron">Expiring soon</Badge>
  if (status === 'expired') return <Badge tone="neutral">Expired</Badge>
  return <Badge tone="critical">Revoked</Badge>
}

export function HealthBadge({ status }: { status: 'healthy' | 'degraded' | 'unavailable' }) {
  if (status === 'healthy') return <Badge tone="emerald">Healthy</Badge>
  if (status === 'degraded') return <Badge tone="saffron">Degraded</Badge>
  return <Badge tone="critical">Unavailable</Badge>
}
