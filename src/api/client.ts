import { request } from '@/utils/request'
import type { PaginatedResult, PaginationQuery } from '@/types/common'
import type { Client, ClientPayload, UpdateClientPayload } from '@/types/client'

export function fetchClients(): Promise<Client[]> {
  return request.Get<Client[]>('/client', { cacheFor: 0 })
}

export function fetchClientList(
  query: PaginationQuery & { keyword?: string; enabled?: boolean } = {},
): Promise<PaginatedResult<Client>> {
  return request.Get<PaginatedResult<Client>>('/client/list', {
    params: {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
      ...(query.keyword ? { keyword: query.keyword } : {}),
      ...(query.enabled !== undefined ? { enabled: query.enabled } : {}),
    },
    cacheFor: 0,
  })
}

export function fetchClient(id: string): Promise<Client> {
  return request.Get<Client>(`/client/${id}`, { cacheFor: 0 })
}

export function createClient(payload: ClientPayload): Promise<Client> {
  return request.Post<Client>('/client', payload, { cacheFor: 0 })
}

export function updateClient(id: string, payload: UpdateClientPayload): Promise<Client> {
  return request.Patch<Client>(`/client/${id}`, payload, { cacheFor: 0 })
}

export function deleteClient(id: string): Promise<void> {
  return request.Delete<void>(`/client/${id}`, {}, { cacheFor: 0 })
}
