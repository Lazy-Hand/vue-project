import { request } from '@/utils/request'
import type { PaginatedResult, PaginationQuery } from '@/types/common'
import type {
  DictItem,
  DictItemPayload,
  DictType,
  DictTypePayload,
  DictTypeWithItems,
  UpdateDictItemPayload,
  UpdateDictTypePayload,
} from '@/types/dict'

export function fetchDictTypeList(
  query: PaginationQuery & { keyword?: string } = {},
): Promise<PaginatedResult<DictType>> {
  return request.Get<PaginatedResult<DictType>>('/dict-type/list', {
    params: {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
      ...(query.keyword ? { keyword: query.keyword } : {}),
    },
    cacheFor: 0,
  })
}

export function fetchDictTypes(): Promise<DictType[]> {
  return request.Get<DictType[]>('/dict-type', { cacheFor: 0 })
}

export function fetchDictByCode(code: string): Promise<DictTypeWithItems> {
  return request.Get<DictTypeWithItems>(`/dict-type/code/${encodeURIComponent(code)}/items`, {
    cacheFor: 0,
  })
}

export function createDictType(payload: DictTypePayload): Promise<DictType> {
  return request.Post<DictType>('/dict-type', payload, { cacheFor: 0 })
}

export function updateDictType(id: string, payload: UpdateDictTypePayload): Promise<DictType> {
  return request.Patch<DictType>(`/dict-type/${id}`, payload, { cacheFor: 0 })
}

export function deleteDictType(id: string): Promise<void> {
  return request.Delete<void>(`/dict-type/${id}`, {}, { cacheFor: 0 })
}

export function fetchDictItemList(
  query: PaginationQuery & { dictTypeId?: string; keyword?: string } = {},
): Promise<PaginatedResult<DictItem>> {
  return request.Get<PaginatedResult<DictItem>>('/dict-item/list', {
    params: {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
      ...(query.dictTypeId ? { dictTypeId: query.dictTypeId } : {}),
      ...(query.keyword ? { keyword: query.keyword } : {}),
    },
    cacheFor: 0,
  })
}

export function createDictItem(payload: DictItemPayload): Promise<DictItem> {
  return request.Post<DictItem>('/dict-item', payload, { cacheFor: 0 })
}

export function updateDictItem(id: string, payload: UpdateDictItemPayload): Promise<DictItem> {
  return request.Patch<DictItem>(`/dict-item/${id}`, payload, { cacheFor: 0 })
}

export function deleteDictItem(id: string): Promise<void> {
  return request.Delete<void>(`/dict-item/${id}`, {}, { cacheFor: 0 })
}
