import { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function AppShell({ pageTitle, children }: { pageTitle: string; children: ReactNode }) {
  return (
    <div className="antigravity-page min-h-screen">
      <Sidebar />
      <div className="lg:pl-64">
        <Topbar pageTitle={pageTitle} />
        <main className="mx-auto max-w-content px-6 py-6">{children}</main>
      </div>
    </div>
  )
}
