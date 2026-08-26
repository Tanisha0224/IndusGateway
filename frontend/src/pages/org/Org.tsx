import { useEffect, useMemo, useState } from 'react'
import { PageHeader, Tabs, SearchBox, AlertBanner } from '../../components/ui/Misc'
import { Card, CardHeader } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Field, Select, TextInput } from '../../components/ui/Form'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { Table, THead, TH, TBody, TR, TD, EmptyState } from '../../components/ui/Table'
import { useIndusGateStore } from '../../lib/store'
import { roleLabels } from '../../lib/data/seed'
import { navItems } from '../../lib/nav'
import { canAccess } from '../../lib/permissions'
import { Icon } from '../../components/ui/Icons'
import { dateTime } from '../../lib/format'
import { ApiError } from '../../lib/api/client'
import * as usersApi from '../../lib/api/users'
import type { Role } from '../../types'
import type { BackendAppRole, BackendUser } from '../../lib/api/types'

const roleOrder: Role[] = ['platform_admin', 'org_admin', 'department_manager', 'developer', 'auditor', 'billing_viewer', 'read_only_viewer']
const statusTone = { active: 'emerald', disabled: 'critical' } as const

const roleDescriptions: Record<Role, string> = {
  platform_admin: 'Full access to every module, including provider configuration and organisation-wide policy changes.',
  org_admin: 'Manages departments, projects, keys, policies, and budgets across the organisation.',
  department_manager: 'Manages keys, budgets, and routing for department projects.',
  developer: 'Creates and tests virtual keys, uses the Playground, and views traces for assigned projects.',
  auditor: 'Read-only access to traces, audit logs, and provider health for compliance review.',
  billing_viewer: 'Read-only access to usage, billing, and alerts.',
  read_only_viewer: 'Broad read-only visibility without administrative access.',
}

export default function Org() {
  const { organisation, departments, teams, projects, currentUser } = useIndusGateStore((s) => s)
  const [tab, setTab] = useState('users')
  const [users, setUsers] = useState<BackendUser[]>([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<BackendUser | null>(null)
  const [creating, setCreating] = useState(false)
  const [confirmStatus, setConfirmStatus] = useState<BackendUser | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<BackendUser | null>(null)
  const canManageUsers = currentUser?.role === 'platform_admin' || currentUser?.role === 'org_admin'

  async function loadUsers() {
    setLoading(true)
    try {
      setUsers(await usersApi.listUsers({ search, role: roleFilter, status: statusFilter, department: departmentFilter }))
      setError('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load users.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadUsers() }, [search, roleFilter, statusFilter, departmentFilter])

  const projectName = useMemo(() => new Map(projects.map((project) => [project.id, project.name])), [projects])
  const departmentName = useMemo(() => new Map(departments.map((department) => [department.id, department.name])), [departments])
  const teamName = useMemo(() => new Map(teams.map((team) => [team.id, team.name])), [teams])

  return (
    <div>
      <PageHeader
        title="Organisation & Access Management"
        description="Manage backend users, account status, role access, and organisational assignment."
        action={tab === 'users' && canManageUsers ? <Button size="sm" onClick={() => setCreating(true)}>Add user</Button> : undefined}
      />
      <Tabs tabs={[{ id: 'users', label: 'Users' }, { id: 'hierarchy', label: 'Hierarchy' }, { id: 'roles', label: 'Roles & permissions' }]} active={tab} onChange={setTab} />

      <div className="mt-5">
        {tab === 'users' && (
          <Card>
            <CardHeader title="Users" description={`${users.length} backend account(s) match the current filters.`} />
            {error && <div className="mb-4"><AlertBanner kind="error" title="Users unavailable">{error}</AlertBanner></div>}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <SearchBox value={search} onChange={setSearch} placeholder="Search name or email..." />
              <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="w-auto" aria-label="Filter by role">
                <option value="">All roles</option>
                {roleOrder.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
              </Select>
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-auto" aria-label="Filter by status">
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </Select>
              <Select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} className="w-auto" aria-label="Filter by department">
                <option value="">All departments</option>
                {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </Select>
            </div>

            {loading ? (
              <div className="py-16 text-center text-table text-navy/50">Loading users...</div>
            ) : users.length === 0 ? (
              <EmptyState title="No users match your filters" description="Clear filters or add a new account." />
            ) : (
              <Table>
                <THead><TH>User</TH><TH>Role</TH><TH>Status</TH><TH>Department / team</TH><TH>Projects</TH><TH>Created</TH><TH align="right">Actions</TH></THead>
                <TBody>
                  {users.map((user) => {
                    const appRole = (user.app_role ?? (user.role === 'admin' ? 'platform_admin' : 'developer')) as Role
                    return (
                      <TR key={user.id}>
                        <TD>
                          <div className="font-semibold text-navy-ink">{user.name}</div>
                          <div className="font-mono text-caption text-navy/50">{user.email}</div>
                        </TD>
                        <TD><Badge tone="navy" icon={false}>{roleLabels[appRole]}</Badge></TD>
                        <TD><Badge tone={statusTone[user.status]}>{user.status}</Badge></TD>
                        <TD>
                          <div className="text-table text-navy-ink">{departmentName.get(user.department_id ?? '') ?? 'Unassigned'}</div>
                          <div className="text-caption text-navy/45">{teamName.get(user.team_id ?? '') ?? 'No team'}</div>
                        </TD>
                        <TD className="max-w-[260px]">
                          {(user.project_ids ?? []).length === 0 ? (
                            <span className="text-caption text-navy/45">Broad access or no project scope</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {(user.project_ids ?? []).map((id) => <span key={id} className="rounded-md bg-ivory px-2 py-0.5 text-caption text-navy/70">{projectName.get(id) ?? id}</span>)}
                            </div>
                          )}
                        </TD>
                        <TD className="text-navy/60">{dateTime(user.created_at)}</TD>
                        <TD align="right">
                          {canManageUsers && (
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="ghost" onClick={() => setEditing(user)}>Edit</Button>
                              <Button size="sm" variant={user.status === 'active' ? 'ghost' : 'confirm'} onClick={() => setConfirmStatus(user)} disabled={user.id === currentUser?.id}>
                                {user.status === 'active' ? 'Disable' : 'Activate'}
                              </Button>
                              {user.status === 'disabled' && <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(user)}>Delete</Button>}
                            </div>
                          )}
                        </TD>
                      </TR>
                    )
                  })}
                </TBody>
              </Table>
            )}
          </Card>
        )}

        {tab === 'hierarchy' && (
          <Card>
            <CardHeader title={organisation.name} description="Organisation -> Department -> Team -> Project" />
            <div className="flex flex-col gap-5">
              {departments.map((dept) => {
                const deptTeams = teams.filter((t) => t.departmentId === dept.id)
                return (
                  <div key={dept.id} className="rounded-md border border-navy/10 p-4">
                    <div className="flex items-center gap-2">
                      <Icon.Org className="h-4 w-4 text-navy/50" />
                      <span className="font-heading text-body-lg font-semibold text-navy-ink">{dept.name}</span>
                      <Badge tone="navy" icon={false}>{dept.code}</Badge>
                    </div>
                    <div className="mt-3 flex flex-col gap-3 border-l-2 border-navy/10 pl-5">
                      {deptTeams.map((team) => (
                        <div key={team.id}>
                          <div className="text-table font-semibold text-navy-ink">{team.name}</div>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {projects.filter((p) => p.teamId === team.id).map((p) => (
                              <span key={p.id} className="rounded-md border border-navy/15 bg-ivory px-2.5 py-1 text-caption font-medium text-navy-ink">{p.name}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {tab === 'roles' && (
          <div className="flex flex-col gap-4">
            {roleOrder.map((role) => (
              <Card key={role}>
                <h3 className="font-heading text-h3 font-semibold text-navy-ink">{roleLabels[role]}</h3>
                <p className="mt-1 text-table text-navy/60">{roleDescriptions[role]}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {navItems.filter((i) => i.moduleKey !== 'docs').map((item) => {
                    const allowed = canAccess(role, item.moduleKey)
                    return <span key={item.path} className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-caption font-medium ${allowed ? 'border-emerald/25 bg-emerald/8 text-emerald-deep' : 'border-navy/10 bg-navy/4 text-navy/35 line-through'}`}>{item.label}</span>
                  })}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {(creating || editing) && (
        <UserModal
          user={editing}
          departments={departments}
          teams={teams}
          projects={projects}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSaved={async () => { setCreating(false); setEditing(null); await loadUsers() }}
        />
      )}

      <ConfirmDialog
        open={!!confirmStatus}
        onClose={() => setConfirmStatus(null)}
        onConfirm={async () => {
          if (!confirmStatus) return
          if (confirmStatus.status === 'active') await usersApi.disableUser(confirmStatus.id)
          else await usersApi.activateUser(confirmStatus.id)
          setConfirmStatus(null)
          await loadUsers()
        }}
        title={confirmStatus?.status === 'active' ? 'Disable user?' : 'Activate user?'}
        description={confirmStatus?.status === 'active' ? 'This user will no longer be able to sign in.' : 'This user will regain access according to their assigned role.'}
        confirmLabel={confirmStatus?.status === 'active' ? 'Disable user' : 'Activate user'}
        tone={confirmStatus?.status === 'active' ? 'destructive' : 'confirm'}
      />
      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return
          await usersApi.deleteUser(confirmDelete.id)
          setConfirmDelete(null)
          await loadUsers()
        }}
        title="Delete disabled user?"
        description="This permanently removes the disabled user record from the admin list."
        confirmLabel="Delete user"
        tone="destructive"
      />
    </div>
  )
}

function UserModal({ user, departments, teams, projects, onClose, onSaved }: {
  user: BackendUser | null
  departments: Array<{ id: string; name: string }>
  teams: Array<{ id: string; departmentId: string; name: string }>
  projects: Array<{ id: string; name: string; teamId: string }>
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [appRole, setAppRole] = useState<BackendAppRole>((user?.app_role as BackendAppRole) ?? 'developer')
  const [status, setStatus] = useState<'active' | 'disabled'>(user?.status ?? 'active')
  const [departmentId, setDepartmentId] = useState(user?.department_id ?? '')
  const [teamId, setTeamId] = useState(user?.team_id ?? '')
  const [projectIds, setProjectIds] = useState<string[]>(user?.project_ids ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const filteredTeams = teams.filter((team) => !departmentId || team.departmentId === departmentId)
  const filteredProjects = projects.filter((project) => !teamId || project.teamId === teamId)
  const valid = name.trim().length >= 2 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)

  async function save() {
    if (!valid) return
    setSaving(true)
    setError('')
    try {
      const payload = {
        name: name.trim(),
        app_role: appRole,
        status,
        department_id: departmentId || null,
        team_id: teamId || null,
        project_ids: projectIds,
      }
      if (user) await usersApi.updateUser(user.id, payload)
      else await usersApi.createUser({ ...payload, email: email.trim().toLowerCase() })
      await onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save user.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={user ? 'Edit user' : 'Add user'} size="lg" footer={
      <>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={save} loading={saving} disabled={!valid}>Save user</Button>
      </>
    }>
      {error && <div className="mb-4"><AlertBanner kind="error" title="Could not save user">{error}</AlertBanner></div>}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name" required><TextInput value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Email" required helper={user ? 'Email is immutable after creation.' : undefined}><TextInput value={email} onChange={(e) => setEmail(e.target.value)} disabled={!!user} /></Field>
        <Field label="Role" required>
          <Select value={appRole} onChange={(e) => setAppRole(e.target.value as BackendAppRole)}>
            {roleOrder.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
          </Select>
        </Field>
        <Field label="Status" required>
          <Select value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'disabled')}>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </Select>
        </Field>
        <Field label="Department">
          <Select value={departmentId} onChange={(e) => { setDepartmentId(e.target.value); setTeamId(''); setProjectIds([]) }}>
            <option value="">Unassigned</option>
            {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </Select>
        </Field>
        <Field label="Team">
          <Select value={teamId} onChange={(e) => { setTeamId(e.target.value); setProjectIds([]) }}>
            <option value="">No team</option>
            {filteredTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </Select>
        </Field>
      </div>
      <div className="mt-4">
        <Field label="Project access" helper="Select project scopes for department and developer roles. Leave empty for broad governance roles.">
          <div className="grid gap-2 rounded-md border border-navy/15 p-3 md:grid-cols-2">
            {filteredProjects.map((project) => (
              <label key={project.id} className="flex items-center gap-2 text-table text-navy-ink">
                <input
                  type="checkbox"
                  checked={projectIds.includes(project.id)}
                  onChange={(event) => setProjectIds((current) => event.target.checked ? [...current, project.id] : current.filter((id) => id !== project.id))}
                />
                {project.name}
              </label>
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  )
}
