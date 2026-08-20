import type { PaginationQuery } from './common'

export type ApprovalNodeType = 'SEQ' | 'AND_SIGN' | 'OR_SIGN' | 'CC' | 'START' | 'CONDITION'
export type ApprovalAssigneeType =
  | 'USER'
  | 'ROLE'
  | 'POST'
  | 'DEPT'
  | 'DEPT_LEADER'
  | 'INITIATOR_LEADER'
  | 'SELF'

export type ApprovalInstanceStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
export type ApprovalTaskStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'TRANSFERRED' | 'CANCELLED'
export type ApprovalAction =
  | 'SUBMIT'
  | 'APPROVE'
  | 'REJECT'
  | 'TRANSFER'
  | 'ADD_SIGN'
  | 'CANCEL'
  | 'COMMENT'
  | 'CC'

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
  titleRule?: string
  autoDeduplication?: boolean
  allowRevoke?: boolean
  notifyTypes?: string[]
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

export interface ApprovalDefinition {
  id: string
  code: string
  name: string
  category: string | null
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
  nodeId: string
  nodeKey?: string | null
  nodeName?: string | null
  taskType?: string | null
  assigneeId: string | null
  status: ApprovalTaskStatus
  comment: string | null
  arrivedAt: string
  handledAt: string | null
  durationMs: number | null
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

export interface ApprovalInstanceDetail {
  instance: ApprovalInstance
  tasks: ApprovalTask[]
  logs: ApprovalLog[]
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
}

export interface ApprovalInstanceQuery extends PaginationQuery {
  status?: ApprovalInstanceStatus
  definitionId?: string
  keyword?: string
  applicantId?: string
  businessType?: string
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
  comment?: string
}
