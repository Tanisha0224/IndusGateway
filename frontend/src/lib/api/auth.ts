import { api } from './client'
import type { BackendUser } from './types'

export function login(email: string, password: string) {
  return api.post<{ user: BackendUser }>('/api/auth/session', { email, password })
}

export function logout() {
  return api.delete<void>('/api/auth/session')
}

export function me() {
  return api.get<BackendUser>('/api/auth/me')
}
