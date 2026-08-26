import { ReactNode, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'

export function Modal({ open, onClose, title, children, footer, size = 'md' }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-ink/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={clsx('relative z-10 max-h-[88vh] w-full overflow-y-auto rounded-lg bg-white shadow-raised', widths[size])}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-navy/10 bg-white px-6 py-4">
          <h2 className="font-heading text-h3 font-semibold text-navy-ink">{title}</h2>
          <button onClick={onClose} aria-label="Close dialog" className="rounded-md p-1.5 text-navy/50 hover:bg-navy/5 hover:text-navy">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && <div className="sticky bottom-0 flex justify-end gap-3 border-t border-navy/10 bg-white px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}

export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = 'Confirm', tone = 'destructive', loading }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; description: string; confirmLabel?: string; tone?: 'destructive' | 'confirm'; loading?: boolean
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm" footer={
      <>
        <button onClick={onClose} className="h-11 rounded-md border border-navy/30 px-5 text-body font-semibold text-navy hover:bg-navy/5">Cancel</button>
        <button onClick={onConfirm} disabled={loading} className={clsx('h-11 rounded-md px-5 text-body font-semibold text-white', tone === 'destructive' ? 'bg-critical hover:bg-red-700' : 'bg-emerald hover:bg-emerald-deep')}>
          {loading ? 'Working…' : confirmLabel}
        </button>
      </>
    }>
      <p className="text-body text-navy/70">{description}</p>
    </Modal>
  )
}

export function Drawer({ open, onClose, title, children, width = 'w-[560px]' }: { open: boolean; onClose: () => void; title: string; children: ReactNode; width?: string }) {
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-navy-ink/50" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label={title} className={clsx('relative z-10 h-full max-w-full overflow-y-auto bg-white shadow-raised', width)}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-navy/10 bg-white px-6 py-4">
          <h2 className="font-heading text-h3 font-semibold text-navy-ink">{title}</h2>
          <button onClick={onClose} aria-label="Close panel" className="rounded-md p-1.5 text-navy/50 hover:bg-navy/5 hover:text-navy">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body
  )
}
