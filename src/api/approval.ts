import type { PaginatedResult } from '@/types/common'
import type {
  AddSignTaskPayload,
  ApprovalCategory,
  ApprovalCategoryQuery,
  ApprovalDefinition,
  ApprovalDefinitionQuery,
  ApprovalInstance,
  ApprovalInstanceDetail,
  ApprovalInstanceQuery,
  ApprovalTaskQuery,
  CreateApprovalCategoryPayload,
  CreateApprovalDefinitionPayload,
  CreateApprovalInstancePayload,
  HandleTaskPayload,
  TransferTaskPayload,
  UpdateApprovalCategoryPayload,
  UpdateApprovalDefinitionPayload,
} from '@/types/approval'
import { request } from '@/utils/request'

function appendQueryParam(
  params: Record<string, string | number | boolean>,
  key: string,
  value: string | number | boolean | undefined,
): void {
  if (value !== undefined && value !== '' && value !== null) params[key] = value
}

// ================= 流程分类 =================

export function fetchApprovalCategoryList(
  query: ApprovalCategoryQuery = {},
): Promise<PaginatedResult<ApprovalCategory>> {
  const params: Record<string, string | number | boolean> = {
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 10,
  }
  appendQueryParam(params, 'keyword', query.keyword)
  if (query.enabled !== undefined) params.enabled = query.enabled

  return request.Get<PaginatedResult<ApprovalCategory>>('/approval/categories', {
    params,
    cacheFor: 0,
  })
}

export function fetchApprovalCategory(id: string): Promise<ApprovalCategory> {
  return request.Get<ApprovalCategory>(`/approval/categories/${id}`, { cacheFor: 0 })
}

export function createApprovalCategory(
  payload: CreateApprovalCategoryPayload,
): Promise<ApprovalCategory> {
  return request.Post<ApprovalCategory>('/approval/categories', payload, { cacheFor: 0 })
}

export function updateApprovalCategory(
  id: string,
  payload: UpdateApprovalCategoryPayload,
): Promise<ApprovalCategory> {
  return request.Put<ApprovalCategory>(`/approval/categories/${id}`, payload, { cacheFor: 0 })
}

export function toggleApprovalCategoryStatus(
  id: string,
  enabled: boolean,
): Promise<ApprovalCategory> {
  return request.Put<ApprovalCategory>(
    `/approval/categories/${id}/status`,
    { enabled },
    { cacheFor: 0 },
  )
}

export function deleteApprovalCategory(id: string): Promise<{ success: boolean }> {
  return request.Delete<{ success: boolean }>(`/approval/categories/${id}`, { cacheFor: 0 })
}

// ================= 流程定义 =================

export function fetchApprovalCategories(): Promise<{ category: string; count: number }[]> {
  return request.Get<{ category: string; count: number }[]>('/approval/definitions/categories', {
    cacheFor: 0,
  })
}

export function fetchApprovalDefinitions(
  query: ApprovalDefinitionQuery = {},
): Promise<PaginatedResult<ApprovalDefinition>> {
  const params: Record<string, string | number | boolean> = {
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 10,
  }
  appendQueryParam(params, 'keyword', query.keyword)
  appendQueryParam(params, 'category', query.category)
  if (query.enabled !== undefined) params.enabled = query.enabled

  return request.Get<PaginatedResult<ApprovalDefinition>>('/approval/definitions', {
    params,
    cacheFor: 0,
  })
}

export function fetchApprovalDefinition(id: string): Promise<ApprovalDefinition> {
  return request.Get<ApprovalDefinition>(`/approval/definitions/${id}`, { cacheFor: 0 })
}

export function createApprovalDefinition(
  payload: CreateApprovalDefinitionPayload,
): Promise<ApprovalDefinition> {
  return request.Post<ApprovalDefinition>('/approval/definitions', payload, { cacheFor: 0 })
}

export function copyApprovalDefinition(id: string): Promise<ApprovalDefinition> {
  return request.Post<ApprovalDefinition>(`/approval/definitions/${id}/copy`, {}, { cacheFor: 0 })
}

export function toggleApprovalDefinitionStatus(
  id: string,
  enabled: boolean,
): Promise<ApprovalDefinition> {
  return request.Put<ApprovalDefinition>(
    `/approval/definitions/${id}/status`,
    { enabled },
    { cacheFor: 0 },
  )
}

export function updateApprovalDefinition(
  id: string,
  payload: UpdateApprovalDefinitionPayload,
): Promise<ApprovalDefinition> {
  return request.Put<ApprovalDefinition>(`/approval/definitions/${id}`, payload, { cacheFor: 0 })
}

export function deleteApprovalDefinition(id: string): Promise<{ success: boolean }> {
  return request.Delete<{ success: boolean }>(`/approval/definitions/${id}`, {}, { cacheFor: 0 })
}

// ================= 审批实例 =================

export function createApprovalInstance(
  payload: CreateApprovalInstancePayload,
): Promise<ApprovalInstance> {
  return request.Post<ApprovalInstance>('/approval/instances', payload, { cacheFor: 0 })
}

export function fetchApprovalInstances(
  query: ApprovalInstanceQuery = {},
): Promise<PaginatedResult<ApprovalInstance>> {
  const params: Record<string, string | number | boolean> = {
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 10,
  }
  appendQueryParam(params, 'status', query.status)
  appendQueryParam(params, 'definitionId', query.definitionId)
  appendQueryParam(params, 'keyword', query.keyword)
  appendQueryParam(params, 'applicantId', query.applicantId)
  appendQueryParam(params, 'businessType', query.businessType)
  appendQueryParam(params, 'businessId', query.businessId)

  return request.Get<PaginatedResult<ApprovalInstance>>('/approval/instances', {
    params,
    cacheFor: 0,
  })
}

export function fetchMyApprovalInstances(
  query: ApprovalInstanceQuery = {},
): Promise<PaginatedResult<ApprovalInstance>> {
  const params: Record<string, string | number | boolean> = {
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 10,
  }
  appendQueryParam(params, 'status', query.status)
  appendQueryParam(params, 'definitionId', query.definitionId)
  appendQueryParam(params, 'keyword', query.keyword)
  appendQueryParam(params, 'businessType', query.businessType)

  return request.Get<PaginatedResult<ApprovalInstance>>('/approval/instances/my', {
    params,
    cacheFor: 0,
  })
}

export function fetchApprovalInstanceDetail(id: string): Promise<ApprovalInstanceDetail> {
  return request.Get<ApprovalInstanceDetail>(`/approval/instances/${id}`, { cacheFor: 0 })
}

export function cancelApprovalInstance(id: string): Promise<{ success: boolean }> {
  return request.Post<{ success: boolean }>(`/approval/instances/${id}/cancel`, {}, { cacheFor: 0 })
}

export function commentApprovalInstance(
  id: string,
  payload: HandleTaskPayload,
): Promise<{ success: boolean }> {
  return request.Post<{ success: boolean }>(`/approval/instances/${id}/comment`, payload, {
    cacheFor: 0,
  })
}

// ================= 待办/已办 =================

export function fetchTodoList(
  query: ApprovalTaskQuery = {},
): Promise<PaginatedResult<ApprovalInstance>> {
  const params: Record<string, string | number | boolean> = {
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 10,
  }
  appendQueryParam(params, 'keyword', query.keyword)
  appendQueryParam(params, 'instanceId', query.instanceId)

  return request.Get<PaginatedResult<ApprovalInstance>>('/approval/tasks/todo', {
    params,
    cacheFor: 0,
  })
}

export function fetchDoneList(
  query: ApprovalTaskQuery = {},
): Promise<PaginatedResult<ApprovalInstance>> {
  const params: Record<string, string | number | boolean> = {
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 10,
  }
  appendQueryParam(params, 'keyword', query.keyword)
  appendQueryParam(params, 'instanceId', query.instanceId)

  return request.Get<PaginatedResult<ApprovalInstance>>('/approval/tasks/done', {
    params,
    cacheFor: 0,
  })
}

// ================= 任务操作 =================

export function approveTask(
  id: string,
  payload: HandleTaskPayload = {},
): Promise<{ success: boolean }> {
  return request.Post<{ success: boolean }>(`/approval/tasks/${id}/approve`, payload, {
    cacheFor: 0,
  })
}

export function rejectTask(
  id: string,
  payload: HandleTaskPayload = {},
): Promise<{ success: boolean }> {
  return request.Post<{ success: boolean }>(`/approval/tasks/${id}/reject`, payload, {
    cacheFor: 0,
  })
}

export function transferTask(
  id: string,
  payload: TransferTaskPayload,
): Promise<{ success: boolean }> {
  return request.Post<{ success: boolean }>(`/approval/tasks/${id}/transfer`, payload, {
    cacheFor: 0,
  })
}

export function addSignTask(
  id: string,
  payload: AddSignTaskPayload,
): Promise<{ success: boolean }> {
  return request.Post<{ success: boolean }>(`/approval/tasks/${id}/add-sign`, payload, {
    cacheFor: 0,
  })
}
