import { request } from '@/utils/request'
import type { PaginatedResult, PaginationQuery } from '@/types/common'
import type {
  AssignMembersPayload,
  ProjectApprovalPayload,
  Project,
  ProjectDeliverable,
  ProjectDeliverablePayload,
  ProjectDetail,
  ProjectMember,
  ProjectPayload,
  ProjectStage,
  ProjectStagePayload,
  UpdateProjectDeliverablePayload,
  UpdateProjectPayload,
  UpdateProjectStagePayload,
} from '@/types/project'

export function fetchProjects(): Promise<Project[]> {
  return request.Get<Project[]>('/project', { cacheFor: 0 })
}

export function fetchProjectList(
  query: PaginationQuery & {
    keyword?: string
    clientId?: string
    status?: string
    settlementStatus?: string
    managerId?: string
  } = {},
): Promise<PaginatedResult<Project>> {
  return request.Get<PaginatedResult<Project>>('/project/list', {
    params: {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
      ...(query.keyword ? { keyword: query.keyword } : {}),
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.settlementStatus ? { settlementStatus: query.settlementStatus } : {}),
      ...(query.managerId ? { managerId: query.managerId } : {}),
    },
    cacheFor: 0,
  })
}

export function fetchProject(id: string): Promise<Project> {
  return request.Get<Project>(`/project/${id}`, { cacheFor: 0 })
}

export function fetchProjectDetail(id: string): Promise<ProjectDetail> {
  return request.Get<ProjectDetail>(`/project/${id}/detail`, { cacheFor: 0 })
}

export function createProject(payload: ProjectPayload): Promise<Project> {
  return request.Post<Project>('/project', payload, { cacheFor: 0 })
}

export function updateProject(id: string, payload: UpdateProjectPayload): Promise<Project> {
  return request.Patch<Project>(`/project/${id}`, payload, { cacheFor: 0 })
}

export function deleteProject(id: string): Promise<void> {
  return request.Delete<void>(`/project/${id}`, {}, { cacheFor: 0 })
}

// Members

export function fetchProjectMembers(id: string): Promise<ProjectMember[]> {
  return request.Get<ProjectMember[]>(`/project/${id}/members`, { cacheFor: 0 })
}

export function assignProjectMembers(
  id: string,
  payload: AssignMembersPayload,
): Promise<ProjectMember[]> {
  return request.Put<ProjectMember[]>(`/project/${id}/members`, payload, { cacheFor: 0 })
}

// Stages

export function fetchProjectStages(id: string): Promise<ProjectStage[]> {
  return request.Get<ProjectStage[]>(`/project/${id}/stages`, { cacheFor: 0 })
}

export function createProjectStage(
  id: string,
  payload: ProjectStagePayload,
): Promise<ProjectStage> {
  return request.Post<ProjectStage>(`/project/${id}/stages`, payload, { cacheFor: 0 })
}

export function updateProjectStage(
  id: string,
  stageId: string,
  payload: UpdateProjectStagePayload,
): Promise<ProjectStage> {
  return request.Patch<ProjectStage>(`/project/${id}/stages/${stageId}`, payload, { cacheFor: 0 })
}

export function deleteProjectStage(id: string, stageId: string): Promise<void> {
  return request.Delete<void>(`/project/${id}/stages/${stageId}`, {}, { cacheFor: 0 })
}

// Deliverables

export function fetchProjectDeliverables(id: string): Promise<ProjectDeliverable[]> {
  return request.Get<ProjectDeliverable[]>(`/project/${id}/deliverables`, { cacheFor: 0 })
}

export function createProjectDeliverable(
  id: string,
  payload: ProjectDeliverablePayload,
): Promise<ProjectDeliverable> {
  return request.Post<ProjectDeliverable>(`/project/${id}/deliverables`, payload, { cacheFor: 0 })
}

export function updateProjectDeliverable(
  id: string,
  deliverableId: string,
  payload: UpdateProjectDeliverablePayload,
): Promise<ProjectDeliverable> {
  return request.Patch<ProjectDeliverable>(
    `/project/${id}/deliverables/${deliverableId}`,
    payload,
    {
      cacheFor: 0,
    },
  )
}

export function deleteProjectDeliverable(id: string, deliverableId: string): Promise<void> {
  return request.Delete<void>(`/project/${id}/deliverables/${deliverableId}`, {}, { cacheFor: 0 })
}

// Approval

export function createProjectApproval(
  id: string,
  payload: ProjectApprovalPayload,
): Promise<{ approvalInstanceId: string }> {
  return request.Post<{ approvalInstanceId: string }>(`/project/${id}/approval`, payload, {
    cacheFor: 0,
  })
}
