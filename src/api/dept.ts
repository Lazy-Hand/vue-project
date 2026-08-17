import { request } from '@/utils/request'
import type { Dept, DeptPayload, DeptTreeNode, UpdateDeptPayload } from '@/types/dept'

export function fetchDepts(): Promise<Dept[]> {
  return request.Get<Dept[]>('/dept', { cacheFor: 0 })
}

export function fetchDeptTree(): Promise<DeptTreeNode[]> {
  return request.Get<DeptTreeNode[]>('/dept/tree', { cacheFor: 0 })
}

export function fetchDept(id: string): Promise<Dept> {
  return request.Get<Dept>(`/dept/${id}`, { cacheFor: 0 })
}

export function createDept(payload: DeptPayload): Promise<Dept> {
  return request.Post<Dept>('/dept', payload, { cacheFor: 0 })
}

export function updateDept(id: string, payload: UpdateDeptPayload): Promise<Dept> {
  return request.Patch<Dept>(`/dept/${id}`, payload, { cacheFor: 0 })
}

export function deleteDept(id: string): Promise<void> {
  return request.Delete<void>(`/dept/${id}`, {}, { cacheFor: 0 })
}
