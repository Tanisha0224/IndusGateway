import { rolePermissions, roleLabels } from './data/seed'
import type { Role } from '../types'

export function canAccess(role: Role | undefined, moduleKey: string): boolean {
  if (!role) return false
  const perms = rolePermissions[role] ?? []
  return perms.includes('*') || perms.includes(moduleKey)
}

export function isWriteRole(role: Role | undefined): boolean {
  return role === 'platform_admin' || role === 'org_admin' || role === 'department_manager' || role === 'developer'
}

export { roleLabels }
