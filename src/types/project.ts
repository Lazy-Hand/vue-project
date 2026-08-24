export type ProjectStatus =
  | 'DRAFT'
  | 'PENDING_INITIATION_APPROVAL'
  | 'IN_PROGRESS'
  | 'PENDING_CLOSURE_APPROVAL'
  | 'COMPLETED'
  | 'ARCHIVED'
  | 'CANCELLED'

export type ApprovalType = 'INITIATION' | 'CLOSURE'

export type ProjectApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

export type SettlementStatus = 'UNSETTLED' | 'PARTIAL' | 'SETTLED'

export type MemberRole = 'PM' | 'DEV' | 'TEST' | 'DESIGN' | 'OPS' | 'OTHER'

export type StageStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED'

export type DeliverableStatus = 'DRAFT' | 'SUBMITTED' | 'ACCEPTED' | 'REJECTED'

export interface ProjectFile {
  id: string
  originalName: string
  filename?: string | null
  path: string
  url?: string | null
  mimeType?: string | null
  mimetype?: string | null
  category?: string | null
  size?: number
  businessType?: string | null
  businessId?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface ProjectAttachment extends ProjectFile {
  fileId?: string | null
  file?: ProjectFile | null
}

export interface ProjectMemberUser {
  id: string
  username?: string | null
  nickname?: string | null
  name?: string | null
  email?: string | null
  phone?: string | null
}

export interface ProjectClientSummary {
  id: string
  code?: string | null
  name: string
  contactName?: string | null
  contactPhone?: string | null
  contactEmail?: string | null
}

export interface Project {
  id: string
  code: string
  name: string
  clientId: string
  description: string | null
  status: ProjectStatus
  initiationApprovalStatus: ProjectApprovalStatus | null
  initiationApprovalInstanceId?: string | null
  closureApprovalStatus: ProjectApprovalStatus | null
  closureApprovalInstanceId?: string | null
  contractAmount: string | null
  budgetedCost: string | null
  actualCost: string | null
  settlementStatus: SettlementStatus
  startDate: string | null
  endDate: string | null
  actualEndDate: string | null
  managerId: string | null
  deptId: string | null
  createdAt: string
  updatedAt: string
}

export interface ProjectMember {
  id: string
  projectId: string
  userId: string
  role: MemberRole
  joinedAt: string
  leftAt?: string | null
  user?: ProjectMemberUser | null
}

export interface ProjectMemberHistory {
  id: string
  projectId: string
  userId: string
  role: MemberRole
  joinedAt: string
  leftAt: string | null
  user?: ProjectMemberUser | null
}

export interface ProjectStage {
  id: string
  projectId: string
  name: string
  sort: number
  status: StageStatus
  plannedStartAt: string | null
  plannedEndAt: string | null
  actualStartAt: string | null
  actualEndAt: string | null
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface ProjectDeliverable {
  id: string
  projectId: string
  stageId: string | null
  name: string
  fileId: string | null
  file: ProjectFile | null
  version: string | null
  status: DeliverableStatus
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface ProjectDetail extends Project {
  client?: ProjectClientSummary | null
  manager?: ProjectMemberUser | null
  members: ProjectMember[]
  memberHistory: ProjectMemberHistory[]
  stages: ProjectStage[]
  attachments: ProjectAttachment[]
  deliverables: ProjectDeliverable[]
}

export type ProjectSnapshot = ProjectDetail

export interface ProjectApprovalFormData {
  snapshotVersion: 1
  approvalType: ApprovalType
  submittedAt: string
  project: ProjectSnapshot
}

export interface ProjectPayload {
  code: string
  name: string
  clientId: string
  description?: string
  contractAmount?: string
  budgetedCost?: string
  actualCost?: string
  settlementStatus?: SettlementStatus
  startDate?: string
  endDate?: string
  managerId?: string | null
  deptId?: string | null
}

export interface UpdateProjectPayload {
  code?: string
  name?: string
  clientId?: string
  description?: string
  contractAmount?: string
  budgetedCost?: string
  actualCost?: string
  settlementStatus?: SettlementStatus
  startDate?: string
  endDate?: string
  actualEndDate?: string
  managerId?: string | null
  deptId?: string | null
}

export interface AssignMembersPayload {
  members: { userId: string; role: MemberRole }[]
}

export interface ProjectStagePayload {
  name: string
  sort?: number
  status?: StageStatus
  plannedStartAt?: string
  plannedEndAt?: string
  actualStartAt?: string | null
  actualEndAt?: string | null
  description?: string
}

export interface UpdateProjectStagePayload extends Partial<ProjectStagePayload> {
  actualStartAt?: string | null
  actualEndAt?: string | null
}

export interface ProjectDeliverablePayload {
  name: string
  stageId?: string | null
  fileId?: string | null
  version?: string
  status?: DeliverableStatus
  description?: string
}

export type UpdateProjectDeliverablePayload = Partial<ProjectDeliverablePayload>

// B2-03：流程版本由服务端按场景绑定解析，前端不再传递 definitionId
export interface ProjectApprovalPayload {
  approvalType: ApprovalType
  title?: string
}

export function buildProjectApprovalPayload(
  approvalType: ApprovalType,
  title?: string,
): ProjectApprovalPayload {
  const payload: ProjectApprovalPayload = { approvalType }
  const normalizedTitle = title?.trim()
  if (normalizedTitle) payload.title = normalizedTitle
  return payload
}

export function getProjectApprovalType(status: string): ApprovalType | null {
  if (status === 'DRAFT') return 'INITIATION'
  if (status === 'IN_PROGRESS') return 'CLOSURE'
  return null
}
