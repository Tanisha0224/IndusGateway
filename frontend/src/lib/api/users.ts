import { api } from './client'
import type { BackendAppRole, BackendUser, BackendUserStatus } from './types'

export interface UserInput {
  name: string
  email: string
  app_role: BackendAppRole
  status: BackendUserStatus
  department_id?: string | null
  team_id?: string | null
  project_ids: string[]
}

export function listUsers(filters?: { search?: string; role?: string; status?: string; department?: string }) {
  const query = new URLSearchParams()
  if (filters?.search) query.set('search', filters.search)
  if (filters?.role) query.set('role', filters.role)
  if (filters?.status) query.set('status', filters.status)
  if (filters?.department) query.set('department', filters.department)
  return api.get<BackendUser[]>(`/api/users${query.toString() ? `?${query}` : ''}`)
}

export function createUser(input: UserInput) {
  return api.post<BackendUser>('/api/users', input)
}

export function updateUser(id: string, input: Partial<Omit<UserInput, 'email'>>) {
  return api.patch<BackendUser>(`/api/users/${id}`, input)
}

export function activateUser(id: string) {
  return api.post<BackendUser>(`/api/users/${id}/activate`, {})
}

export function disableUser(id: string) {
  return api.post<BackendUser>(`/api/users/${id}/disable`, {})
}

export function deleteUser(id: string) {
  return api.delete<void>(`/api/users/${id}`)
}
