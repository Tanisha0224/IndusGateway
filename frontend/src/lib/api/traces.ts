import { api } from './client'
import type { BackendGatewayRequest } from './types'

export function listGatewayRequests() {
  return api.get<BackendGatewayRequest[]>('/api/gateway-requests')
}

export function getGatewayRequest(id: string) {
  return api.get<BackendGatewayRequest>(`/api/gateway-requests/${id}`)
}
