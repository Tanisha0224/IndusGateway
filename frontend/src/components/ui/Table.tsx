import clsx from 'clsx'
import { ReactNode } from 'react'

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-navy/10 bg-white">
      <table className="w-full border-collapse text-table">{children}</table>
    </div>
  )
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="sticky top-0 z-10 bg-ivory"><tr className="border-b border-navy/10">{children}</tr></thead>
}

export function TH({ children, align = 'left', className }: { children: ReactNode; align?: 'left' | 'right' | 'center'; className?: string }) {
  return (
    <th className={clsx('px-4 py-3 font-heading text-caption font-semibold uppercase tracking-wide text-navy/55', align === 'right' && 'text-right', align === 'center' && 'text-center', className)}>
      {children}
    </th>
  )
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-navy/8">{children}</tbody>
}

export function TR({ children, onClick, className }: { children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <tr onClick={onClick} className={clsx('transition-colors', onClick && 'cursor-pointer hover:bg-ivory/70', className)}>
      {children}
    </tr>
  )
}

export function TD({ children, align = 'left', mono = false, className }: { children: ReactNode; align?: 'left' | 'right' | 'center'; mono?: boolean; className?: string }) {
  return (
    <td className={clsx('px-4 py-3 text-navy-ink align-middle', align === 'right' && 'text-right tnum', align === 'center' && 'text-center', mono && 'font-mono text-caption', className)}>
      {children}
    </td>
  )
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <div className="font-heading text-h3 font-semibold text-navy-ink">{title}</div>
      <p className="max-w-md text-body text-navy/55">{description}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="p-4">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="mb-3 flex gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="h-4 flex-1 animate-pulse rounded bg-navy/8" />
          ))}
        </div>
      ))}
    </div>
  )
}
