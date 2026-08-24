import type { PaginationQuery } from './common'

export type ApprovalNodeType =
  | 'SEQ'
  | 'AND_SIGN'
  | 'OR_SIGN'
  | 'CC'
  | 'START'
  | 'CONDITION'
  | 'FORK'
  | 'JOIN'
export type ApprovalAssigneeType =
  | 'USER'
  | 'ROLE'
  | 'POST'
  | 'DEPT'
  | 'DEPT_LEADER'
  | 'INITIATOR_LEADER'
  | 'SELF'

export type ApprovalInstanceStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
export type ApprovalTaskStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'TRANSFERRED'
  | 'CANCELLED'
  | 'SUSPENDED'
export type ApprovalAction =
  | 'SUBMIT'
  | 'APPROVE'
  | 'REJECT'
  | 'TRANSFER'
  | 'ADD_SIGN'
  | 'CANCEL'
  | 'COMMENT'
  | 'CC'
  | 'RESUBMIT'
  | 'ROUTE'
  | 'URGE'
  | 'TIMEOUT_NOTIFY'
  | 'TIMEOUT_TRANSFER'
  | 'TIMEOUT_ESCALATE'
  | 'ADMIN_INTERVENE'

export type FormFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'radio'
  | 'checkbox'
  | 'select'
  | 'date'
  | 'daterange'
  | 'upload'
  | 'switch'
  | 'money'
  | 'dept'
  | 'user'

export interface FormFieldOption {
  label: string
  value: string | number
}

export interface FormFieldSchema {
  id: string
  type: FormFieldType
  label: string
  placeholder?: string
  required?: boolean
  defaultValue?: unknown
  options?: FormFieldOption[]
  min?: number
  max?: number
  precision?: number
  description?: string
  width?: string
}

export interface FormSchemaConfig {
  fields: FormFieldSchema[]
}

export interface FlowConditionRule {
  fieldId: string
  operator: 'EQ' | 'NEQ' | 'GT' | 'GTE' | 'LT' | 'LTE' | 'CONTAINS'
  value: string | number | boolean
}

export interface FlowBranchConfig {
  branchId: string
  name: string
  isDefault?: boolean
  conditions: FlowConditionRule[]
}

export interface FlowNodeConfig {
  nodeKey: string
  name: string
  type: ApprovalNodeType
  assigneeType: ApprovalAssigneeType
  assigneeValue?: string
  assigneeConfig?: Record<string, unknown>
  conditionConfig?: {
    branches: FlowBranchConfig[]
  }
  formPermissions?: Record<string, 'READ' | 'WRITE' | 'HIDE'>
  allowTransfer?: boolean
  allowAddSign?: boolean
  allowReject?: boolean
  rejectTarget?: string
}

export interface FlowConfig {
  nodes: FlowNodeConfig[]
}

export interface AdvancedConfig {
  titleTemplate?: string
  dedup?: 'NONE' | 'NODE' | 'FLOW'
  emptyAssigneePolicy?: 'FAIL' | 'SKIP' | 'TO_ADMIN' | 'BACKUP'
  backupAssigneeValue?: string
  allowCancel?: boolean
  allowComment?: boolean
  requireCommentOnReject?: boolean
}

export interface ApprovalNode {
  id: string
  definitionId: string
  nodeKey?: string | null
  sort: number
  name: string
  type: ApprovalNodeType
  assigneeType: ApprovalAssigneeType
  assigneeValue: string | null
  assigneeConfig?: Record<string, unknown> | null
  conditionConfig?: Record<string, unknown> | null
  formPermissions?: Record<string, unknown> | null
  allowTransfer: boolean
  allowAddSign: boolean
  allowReject: boolean
  rejectTarget?: string | null
  createdAt: string
  updatedAt: string
}

export type ApprovalVersionStatus = 'DRAFT' | 'PUBLISHED' | 'RETIRED'

export interface ApprovalDefinitionVersionSummary {
  id: string
  version: number
  status: ApprovalVersionStatus
  publishedAt: string | null
}

export interface ApprovalSceneBinding {
  id: string
  sceneCode: string
  businessType: string
  versionId: string
  definitionId: string
  definitionName: string
  version: number
  versionStatus: ApprovalVersionStatus
  enabled: boolean
  remark: string | null
  updatedAt: string
}

export type ApprovalOutboxStatus = 'PENDING' | 'PROCESSING' | 'PUBLISHED' | 'FAILED'

export interface ApprovalOutboxEvent {
  id: string
  eventId: string
  aggregateId: string
  eventType: string
  status: ApprovalOutboxStatus
  retryCount: number
  nextRetryAt: string | null
  lastError: string | null
  processedAt: string | null
  createdAt: string
}

export interface ApprovalDefinition {
  id: string
  code: string
  name: string
  category: string | null
  categoryId?: string | null
  icon: string | null
  color: string | null
  version: number
  enabled: boolean
  formSchema: FormSchemaConfig | Record<string, unknown> | null
  flowConfig: FlowConfig | Record<string, unknown> | null
  advancedConfig: AdvancedConfig | Record<string, unknown> | null
  remark: string | null
  createdAt: string
  updatedAt: string
  nodes?: ApprovalNode[]
  edges?: ApprovalEdgeInput[]
  draftVersion?: number | null
  publishedVersion?: number | null
  versions?: ApprovalDefinitionVersionSummary[]
}

export interface ApprovalCategory {
  id: string
  code: string
  name: string
  icon?: string | null
  color?: string | null
  sort: number
  enabled: boolean
  remark?: string | null
  definitionCount?: number
  createdAt: string
  updatedAt: string
}

export interface ApprovalCategoryQuery extends PaginationQuery {
  keyword?: string
  enabled?: boolean
}

export interface CreateApprovalCategoryPayload {
  code: string
  name: string
  icon?: string
  color?: string
  sort?: number
  remark?: string
  enabled?: boolean
}

export interface UpdateApprovalCategoryPayload {
  name?: string
  icon?: string
  color?: string
  sort?: number
  remark?: string
  enabled?: boolean
}

export interface ApprovalCategoryCount {
  category: string
  count: number
}

export type ApprovalDefinitionCategory = ApprovalCategoryCount

export interface ApprovalInstance {
  id: string
  definitionId: string
  definitionVersion: number
  flowSnapshot?: Record<string, unknown> | null
  businessType: string | null
  businessId: string | null
  sceneCode?: string | null
  businessRevision?: string | null
  title: string
  formData: Record<string, unknown> | null
  status: ApprovalInstanceStatus
  applicantId: string | null
  currentNodeId: string | null
  currentNodeKey?: string | null
  finishedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface ApprovalTask {
  id: string
  instanceId: string
  nodeId: string | null
  nodeKey?: string | null
  nodeName?: string | null
  taskType?: string | null
  assigneeId: string | null
  status: ApprovalTaskStatus
  comment: string | null
  arrivedAt: string
  handledAt: string | null
  durationMs: number | null
  version?: number
  sourceTaskId?: string | null
  signType?: 'PRE' | 'PARALLEL' | 'POST' | null
}

export interface ApprovalLog {
  id: string
  instanceId: string
  taskId: string | null
  operatorId: string | null
  action: ApprovalAction
  detail: Record<string, unknown> | null
  comment: string | null
  createdAt: string
}

export interface ApprovalCapabilities {
  canApprove: boolean
  canReject: boolean
  canTransfer: boolean
  canAddSign: boolean
  canCancel: boolean
  canComment: boolean
}

export interface ApprovalInstanceDetail {
  instance: ApprovalInstance
  tasks: ApprovalTask[]
  logs: ApprovalLog[]
  /** 当前用户在实例上的待办任务；无则返回 null */
  myPendingTask: ApprovalTask | null
  capabilities: ApprovalCapabilities
}

/** 我的待办列表项：直接携带本人待办任务 ID 与可操作能力 */
export interface ApprovalTodoItem {
  instance: ApprovalInstance
  myPendingTaskId: string | null
  capabilities: ApprovalCapabilities
}

export interface ApprovalDefinitionQuery extends PaginationQuery {
  keyword?: string
  category?: string
  enabled?: boolean
}

export interface ApprovalNodeInput {
  id?: string
  nodeKey?: string
  name: string
  type?: ApprovalNodeType
  assigneeType: ApprovalAssigneeType
  assigneeValue?: string
  assigneeConfig?: Record<string, unknown>
  conditionConfig?: Record<string, unknown>
  formPermissions?: Record<string, unknown>
  allowTransfer?: boolean
  allowAddSign?: boolean
  allowReject?: boolean
  rejectTarget?: string
  parallelGroup?: string
  branchIndex?: number
  x?: number
  y?: number
}

/** 流程边条件：B3-01 字段比较，仅支持白名单运算符 */
export interface ApprovalEdgeCondition {
  conditions: {
    field: string
    operator: 'EQ' | 'NEQ' | 'GT' | 'GTE' | 'LT' | 'LTE' | 'CONTAINS' | 'IN' | 'EMPTY'
    value?: string | number | boolean
  }[]
  logic?: 'AND' | 'OR'
  priority?: number
  /** 默认分支：所有条件分支都不命中时兜底 */
  isDefault?: boolean
}

/** 流程边：真实节点+边模型；toNodeKey 为空表示指向流程结束 */
export interface ApprovalEdgeInput {
  fromNodeKey: string
  toNodeKey?: string | null
  conditionConfig?: ApprovalEdgeCondition
}

export interface CreateApprovalDefinitionPayload {
  code: string
  name: string
  category?: string
  icon?: string
  color?: string
  formSchema?: FormSchemaConfig | Record<string, unknown>
  flowConfig?: FlowConfig | Record<string, unknown>
  advancedConfig?: AdvancedConfig | Record<string, unknown>
  remark?: string
  enabled?: boolean
  nodes: ApprovalNodeInput[]
  edges?: ApprovalEdgeInput[]
}

export interface UpdateApprovalDefinitionPayload {
  name?: string
  category?: string
  icon?: string
  color?: string
  formSchema?: FormSchemaConfig | Record<string, unknown>
  flowConfig?: FlowConfig | Record<string, unknown>
  advancedConfig?: AdvancedConfig | Record<string, unknown>
  remark?: string
  enabled?: boolean
  nodes?: ApprovalNodeInput[]
  edges?: ApprovalEdgeInput[]
}

export interface ApprovalInstanceQuery extends PaginationQuery {
  status?: ApprovalInstanceStatus
  definitionId?: string
  keyword?: string
  applicantId?: string
  businessType?: string
  businessId?: string
}

export interface ApprovalTaskQuery extends PaginationQuery {
  keyword?: string
  instanceId?: string
}

export interface CreateApprovalInstancePayload {
  definitionId: string
  title: string
  businessType?: string
  businessId?: string
  formData?: Record<string, unknown>
}

export interface HandleTaskPayload {
  comment?: string
}

export interface TransferTaskPayload {
  targetUserId: string
  comment?: string
}

export interface AddSignTaskPayload {
  targetUserId: string
  /** 加签类型：PRE=前加签（原审批人挂起等待）；POST=后加签（原审批人先处理）；PARALLEL=并加签 */
  signType?: 'PRE' | 'POST' | 'PARALLEL'
  comment?: string
}
