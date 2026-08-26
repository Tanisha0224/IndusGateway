import { Navigate } from 'react-router-dom'
import { ReactNode } from 'react'
import { useIndusGateStore } from '../../lib/store'
import { canAccess } from '../../lib/permissions'
import { AppShell } from './AppShell'
import { Icon } from '../ui/Icons'

export function RequireAuth({ children }: { children: ReactNode }) {
  const currentUser = useIndusGateStore((s) => s.currentUser)
  const authStatus = useIndusGateStore((s) => s.authStatus)

  if (authStatus === 'idle' || authStatus === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ivory">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-navy/20 border-t-saffron" aria-label="Loading" />
      </div>
    )
  }
  if (!currentUser) return <Navigate to="/login" replace />
  return <>{children}</>
}

export function ModuleGuard({ moduleKey, title, children }: { moduleKey: string; title: string; children: ReactNode }) {
  const user = useIndusGateStore((s) => s.currentUser)
  const allowed = canAccess(user?.role, moduleKey)
  if (!allowed) {
    return (
      <AppShell pageTitle={title}>
        <div className="flex flex-col items-center justify-center rounded-lg border border-navy/10 bg-white px-6 py-20 text-center shadow-subtle">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-critical/10 text-critical">
            <Icon.Lock className="h-7 w-7" />
          </div>
          <h2 className="font-heading text-h2 font-semibold text-navy-ink">You don't have access to this page</h2>
          <p className="mt-2 max-w-md text-body text-navy/60">
            Your current role does not include permission for this module. If you believe this is incorrect,
            contact your Organisation Admin or Platform Admin to request access.
          </p>
        </div>
      </AppShell>
    )
  }
  return <>{children}</>
}
