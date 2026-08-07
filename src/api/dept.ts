import { request } from '@/utils/request'
import type { DeptTreeNode } from '@/types/dept'

export function fetchDeptTree(): Promise<DeptTreeNode[]> {
  return request.Get<DeptTreeNode[]>('/dept/tree', { cacheFor: 0 })
}
