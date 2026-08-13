import { request } from '@/utils/request'
import type { PaginatedResult } from '@/types/common'
import type {
  AccountSet,
  AccountSetMember,
  AccountSetPayload,
  AccountSetUserAssignment,
  UpdateAccountSetPayload,
} from '@/types/account-set'

export function fetchAccountSets(): Promise<AccountSet[]> {
  return request.Get<AccountSet[]>('/account-set', { cacheFor: 0 })
}

export function createAccountSet(payload: AccountSetPayload): Promise<AccountSet> {
  return request.Post<AccountSet>('/account-set', payload, { cacheFor: 0 })
}

export function fetchAccountSetList(
  query: { page?: number; pageSize?: number; keyword?: string } = {},
): Promise<PaginatedResult<AccountSet>> {
  return request.Get<PaginatedResult<AccountSet>>('/account-set/list', {
    params: {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
      ...(query.keyword ? { keyword: query.keyword } : {}),
    },
    cacheFor: 0,
  })
}

export function fetchAccountSet(id: string): Promise<AccountSet> {
  return request.Get<AccountSet>(`/account-set/${id}`, { cacheFor: 0 })
}

export function updateAccountSet(
  id: string,
  payload: UpdateAccountSetPayload,
): Promise<AccountSet> {
  return request.Patch<AccountSet>(`/account-set/${id}`, payload, { cacheFor: 0 })
}

export function deleteAccountSet(id: string): Promise<void> {
  return request.Delete<void>(`/account-set/${id}`, { cacheFor: 0 })
}

export function fetchAccountSetUsers(id: string): Promise<AccountSetMember[]> {
  return request.Get<AccountSetMember[]>(`/account-set/${id}/users`, { cacheFor: 0 })
}

export function assignAccountSetUsers(
  id: string,
  payload: AccountSetUserAssignment,
): Promise<AccountSetMember[]> {
  return request.Put<AccountSetMember[]>(`/account-set/${id}/users`, payload, { cacheFor: 0 })
}
