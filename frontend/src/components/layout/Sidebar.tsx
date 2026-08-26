import { NavLink } from 'react-router-dom'
import clsx from 'clsx'
import { navItems, navGroups } from '../../lib/nav'
import { Icon } from '../ui/Icons'
import { LogoMark } from '../ui/Logo'
import { useIndusGateStore } from '../../lib/store'
import { canAccess, roleLabels } from '../../lib/permissions'

export function Sidebar() {
  const user = useIndusGateStore((s) => s.currentUser)

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/70 bg-white/82 shadow-[12px_0_42px_rgba(60,64,67,0.08)] backdrop-blur-xl lg:flex">
      <div className="flex items-center gap-2.5 border-b border-navy/10 px-5 py-4">
        <LogoMark className="h-9 w-9 shrink-0 drop-shadow-[0_10px_24px_rgba(66,133,244,0.24)]" />
        <div className="leading-tight">
          <div className="font-heading text-body font-bold text-navy-ink">IndusGate AI</div>
          <div className="text-caption text-navy/50">AI Gateway</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navGroups.map((group) => {
          const items = navItems.filter((i) => i.group === group && canAccess(user?.role, i.moduleKey))
          if (items.length === 0) return null
          return (
            <div key={group} className="mb-5">
              <div className="mb-1.5 px-2.5 text-caption font-semibold uppercase tracking-wide text-navy/40">{group}</div>
              <div className="flex flex-col gap-0.5">
                {items.map((item) => {
                  const IconComp = (Icon as any)[item.icon]
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={({ isActive }) => clsx(
                        'flex items-center gap-3 rounded-md px-2.5 py-2 text-table font-medium transition-all',
                        isActive ? 'bg-[#E8F0FE] text-[#1967D2] shadow-sm' : 'text-navy/75 hover:-translate-y-0.5 hover:bg-[#F8FAFF] hover:text-navy'
                      )}
                    >
                      {({ isActive }) => (
                        <>
                          <IconComp className={clsx('h-[18px] w-[18px] flex-shrink-0', isActive ? 'text-[#4285F4]' : 'text-navy/60')} />
                          <span>{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {user && (
        <div className="border-t border-navy/10 px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-navy text-caption font-semibold text-white">{user.avatarInitials}</div>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-table font-semibold text-navy-ink">{user.name}</div>
              <div className="truncate text-caption text-navy/50">{roleLabels[user.role]}</div>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
