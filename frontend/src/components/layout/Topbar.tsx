import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useIndusGateStore } from '../../lib/store'
import { Icon } from '../ui/Icons'
import { roleLabels } from '../../lib/permissions'

export function Topbar({ pageTitle }: { pageTitle: string }) {
  const currentUser = useIndusGateStore((s) => s.currentUser)
  const logout = useIndusGateStore((s) => s.logout)
  const projects = useIndusGateStore((s) => s.projects)
  const currentProjectId = useIndusGateStore((s) => s.currentProjectId)
  const setCurrentProject = useIndusGateStore((s) => s.setCurrentProject)
  const alerts = useIndusGateStore((s) => s.alerts)
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const unread = alerts.filter((a) => !a.read).length

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-white/70 bg-white/78 px-6 shadow-[0_10px_35px_rgba(60,64,67,0.08)] backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <span className="font-heading text-h3 font-semibold text-navy-ink">{pageTitle}</span>
        <span className="hidden items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-caption font-semibold text-[#8a6d2f] sm:inline-flex">
          Prototype environment — demo data only
        </span>
      </div>

      <div className="flex items-center gap-3">
        <select
          value={currentProjectId}
          onChange={(e) => setCurrentProject(e.target.value)}
          aria-label="Select project"
          className="hidden h-10 rounded-md border border-navy/15 bg-white/72 px-3 text-table font-medium text-navy-ink shadow-sm focus:border-[#4285F4] focus:outline-none md:block"
        >
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <span className="hidden rounded-full border border-emerald/30 bg-emerald/8 px-2.5 py-1 text-caption font-semibold text-emerald-deep sm:inline-flex">
          Live environment
        </span>

        <button onClick={() => navigate('/alerts')} aria-label="Notifications" className="relative rounded-md p-2 text-navy/60 transition hover:-translate-y-0.5 hover:bg-[#F8FAFF] hover:text-[#1967D2]">
          <Icon.Bell className="h-5 w-5" />
          {unread > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-critical" />}
        </button>
        <button onClick={() => navigate('/docs')} aria-label="Documentation" className="rounded-md p-2 text-navy/60 transition hover:-translate-y-0.5 hover:bg-[#F8FAFF] hover:text-[#1967D2]">
          <Icon.Docs className="h-5 w-5" />
        </button>

        <div className="relative">
          <button onClick={() => setMenuOpen((v) => !v)} className="flex items-center gap-2 rounded-md p-1 transition hover:-translate-y-0.5 hover:bg-[#F8FAFF]">
            <div className="google-mark flex h-8 w-8 items-center justify-center rounded-full text-caption font-semibold text-white">{currentUser?.avatarInitials}</div>
            <Icon.ChevronDown className="h-4 w-4 text-navy/50" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-30 mt-2 w-56 rounded-md border border-navy/10 bg-white py-2 shadow-raised">
              <div className="border-b border-navy/10 px-3.5 pb-2">
                <div className="text-table font-semibold text-navy-ink">{currentUser?.name}</div>
                <div className="text-caption text-navy/50">{currentUser && roleLabels[currentUser.role]}</div>
              </div>
              <button onClick={() => { setMenuOpen(false); logout().then(() => navigate('/login')) }} className="mt-1 w-full px-3.5 py-2 text-left text-table text-navy hover:bg-ivory">
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
