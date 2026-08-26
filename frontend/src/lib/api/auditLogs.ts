import { api } from './client'
import type { BackendAuditLog } from './types'

export function listAuditLogs() {
  return api.get<BackendAuditLog[]>('/api/audit-logs')
}
