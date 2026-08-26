import { api } from './client'
import type { BackendProject } from './types'

export function listProjects() {
  return api.get<BackendProject[]>('/api/projects')
}

export function createProject(input: {
  name: string
  description?: string
  policy_id: string
  monthly_budget_inr?: number | null
}) {
  return api.post<BackendProject>('/api/projects', input)
}

export function updateProject(
  id: string,
  input: { name?: string; description?: string; monthly_budget_inr?: number | null }
) {
  return api.patch<BackendProject>(`/api/projects/${id}`, input)
}
