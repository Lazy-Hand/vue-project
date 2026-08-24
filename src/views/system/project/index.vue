<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Modal, Tag, message } from 'antdv-next'

import { fetchApprovalDefinitions } from '@/api/approval'
import { fetchClients } from '@/api/client'
import { fetchDeptTree } from '@/api/dept'
import {
  assignProjectMembers,
  createProject,
  deleteProject,
  fetchProjectList,
  fetchProjectMembers,
  updateProject,
} from '@/api/project'
import { fetchUserList } from '@/api/user'
import ProTable from '@/components/ProTable/index.vue'
import ProTableActions from '@/components/ProTableActions/index.vue'
import { usePermission } from '@/composables/usePermission'
import type { ApprovalDefinition } from '@/types/approval'
import type { Client } from '@/types/client'
import type { DeptTreeNode } from '@/types/dept'
import type {
  ProTableAction,
  ProTableColumn,
  ProTableExpose,
  ProTableRequestParams,
  ProTableSearchField,
} from '@/types/pro-table'
import type {
  Project,
  ProjectApprovalStatus,
  ProjectPayload,
  UpdateProjectPayload,
} from '@/types/project'
import type { ManagedUser } from '@/types/user'
import { ApiRequestError } from '@/utils/request'
import ApprovalRecordsDrawer from '../../approval/components/ApprovalRecordsDrawer.vue'
import ProjectDetailDrawer from './ProjectDetailDrawer.vue'
import ProjectFormDialog from './ProjectFormDialog.vue'
import ProjectMembersDialog from './ProjectMembersDialog.vue'

const { locale, t } = useI18n()
const { hasPermission } = usePermission()

const tableRef = ref<ProTableExpose<Project> | null>(null)
const clients = ref<Client[]>([])
const users = ref<ManagedUser[]>([])
const deptTree = ref<DeptTreeNode[]>([])
const definitions = ref<ApprovalDefinition[]>([])

const formVisible = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editingProject = ref<Project | null>(null)
const formDialogRef = ref<InstanceType<typeof ProjectFormDialog> | null>(null)

const detailOpen = ref(false)
const detailProject = ref<Project | null>(null)

const selectedProject = ref<Project | null>(null)
const approvalsOpen = ref(false)

const membersVisible = ref(false)
const membersProject = ref<Project | null>(null)
const initialMembers = ref<
  { userId: string; role: 'PM' | 'DEV' | 'TEST' | 'DESIGN' | 'OPS' | 'OTHER' }[]
>([])
const membersDialogRef = ref<InstanceType<typeof ProjectMembersDialog> | null>(null)

const canQuery = computed(() => hasPermission('system:project:query'))
const canCreate = computed(() => hasPermission('system:project:create'))
const canUpdate = computed(() => hasPermission('system:project:update'))
const canDelete = computed(() => hasPermission('system:project:delete'))
const canAssignMembers = computed(() => hasPermission('system:project:assignMembers'))

const clientMap = computed(() => new Map(clients.value.map((c) => [c.id, c.name])))
const clientOptions = computed(() => clients.value.map((c) => ({ label: c.name, value: c.id })))

const statusOptions = computed(() => [
  { label: t('project.statusDRAFT'), value: 'DRAFT' },
  {
    label: t('project.statusPENDING_INITIATION_APPROVAL'),
    value: 'PENDING_INITIATION_APPROVAL',
  },
  { label: t('project.statusIN_PROGRESS'), value: 'IN_PROGRESS' },
  { label: t('project.statusPENDING_CLOSURE_APPROVAL'), value: 'PENDING_CLOSURE_APPROVAL' },
  { label: t('project.statusCOMPLETED'), value: 'COMPLETED' },
  { label: t('project.statusARCHIVED'), value: 'ARCHIVED' },
  { label: t('project.statusCANCELLED'), value: 'CANCELLED' },
])

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  try {
    return new Intl.DateTimeFormat(locale.value, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d)
  } catch {
    return value
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'DRAFT':
      return 'default'
    case 'PENDING_INITIATION_APPROVAL':
    case 'PENDING_CLOSURE_APPROVAL':
      return 'processing'
    case 'IN_PROGRESS':
      return 'blue'
    case 'COMPLETED':
      return 'success'
    case 'ARCHIVED':
      return 'default'
    case 'CANCELLED':
      return 'error'
    default:
      return 'default'
  }
}

function statusLabel(status: string): string {
  const key = `project.status${status}` as never
  const label = t(key)
  return label === key ? status : label
}

function approvalColor(status: ProjectApprovalStatus | null): string {
  if (!status) return 'default'
  switch (status) {
    case 'PENDING':
      return 'processing'
    case 'APPROVED':
      return 'success'
    case 'REJECTED':
      return 'error'
    case 'CANCELLED':
      return 'default'
    default:
      return 'default'
  }
}

const searchFields = computed<ProTableSearchField[]>(() => [
  {
    prop: 'keyword',
    label: t('project.keyword'),
    type: 'input',
    placeholder: t('project.searchPlaceholder'),
    defaultValue: '',
  },
  {
    prop: 'clientId',
    label: t('project.client'),
    type: 'select',
    options: clientOptions.value,
    placeholder: t('project.clientPlaceholder'),
    defaultValue: null,
  },
  {
    prop: 'status',
    label: t('project.status'),
    type: 'select',
    options: statusOptions.value,
    placeholder: t('project.statusPlaceholder'),
    defaultValue: null,
  },
])

const columns = computed<ProTableColumn<Project>[]>(() => [
  { type: 'selection', width: 48 },
  { prop: 'code', label: t('project.code'), minWidth: 130, showOverflowTooltip: true },
  { prop: 'name', label: t('project.name'), minWidth: 160, showOverflowTooltip: true },
  {
    prop: 'clientId',
    label: t('project.client'),
    minWidth: 130,
    showOverflowTooltip: true,
    formatter: (row) => clientMap.value.get(row.clientId) ?? row.clientId,
  },
  {
    prop: 'status',
    label: t('project.status'),
    width: 110,
    type: 'slot',
    slot: 'status',
  },
  {
    prop: 'initiationApprovalStatus',
    label: t('project.initiationApprovalStatus'),
    width: 130,
    type: 'slot',
    slot: 'initiationApprovalStatus',
  },
  {
    prop: 'closureApprovalStatus',
    label: t('project.closureApprovalStatus'),
    width: 130,
    type: 'slot',
    slot: 'closureApprovalStatus',
  },
  {
    prop: 'settlementStatus',
    label: t('project.settlementStatus'),
    width: 110,
    formatter: (row) => {
      const key = `project.settlement${row.settlementStatus}` as never
      const v = t(key)
      return v === key ? row.settlementStatus : v
    },
  },
  {
    prop: 'createdAt',
    label: t('project.createdAt'),
    minWidth: 165,
    formatter: (row) => formatDateTime(row.createdAt),
  },
  {
    key: 'actions',
    label: t('common.actions'),
    width: 280,
    fixed: 'right',
    type: 'slot',
    slot: 'actions',
  },
])

const projectActions = computed<ProTableAction<Project>[]>(() => [
  {
    key: 'detail',
    label: t('project.detail'),
    placement: 'inline',
    onClick: openDetail,
  },
  {
    key: 'edit',
    label: t('common.edit'),
    placement: 'inline',
    visible: canUpdate.value,
    // 审批进行中的项目锁定编辑入口
    disabled: (row) => isApprovalLocked(row.status),
    onClick: openEdit,
  },
  {
    key: 'members',
    label: t('project.members'),
    visible: canAssignMembers.value,
    disabled: (row) => isApprovalLocked(row.status),
    onClick: openMembers,
  },
  {
    key: 'delete',
    label: t('common.delete'),
    danger: true,
    visible: canDelete.value,
    disabled: (row) => isApprovalLocked(row.status),
    onClick: handleDelete,
  },
])

function isApprovalLocked(status: string): boolean {
  return status === 'PENDING_INITIATION_APPROVAL' || status === 'PENDING_CLOSURE_APPROVAL'
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message
  if (error instanceof Error) return error.message
  return t('project.requestFailed')
}

function handleRequestError(error: unknown): void {
  message.error(errorMessage(error))
}

async function ensureClients(): Promise<void> {
  if (clients.value.length) return
  try {
    clients.value = await fetchClients()
  } catch {
    clients.value = []
  }
}

async function ensureUsers(): Promise<void> {
  if (users.value.length) return
  try {
    const res = await fetchUserList({ page: 1, pageSize: 100 })
    users.value = res.items
  } catch {
    users.value = []
  }
}

async function ensureDeptTree(): Promise<void> {
  if (deptTree.value.length) return
  try {
    deptTree.value = await fetchDeptTree()
  } catch {
    deptTree.value = []
  }
}

async function ensureDefinitions(): Promise<void> {
  if (definitions.value.length) return
  try {
    const res = await fetchApprovalDefinitions({ page: 1, pageSize: 100 })
    definitions.value = res.items
  } catch {
    definitions.value = []
  }
}

async function requestProjects(params: ProTableRequestParams) {
  if (!canQuery.value) return { items: [], total: 0 }
  await ensureClients()
  return fetchProjectList({
    page: params.page,
    pageSize: params.pageSize,
    keyword: String(params.keyword ?? '').trim() || undefined,
    clientId: params.clientId ? String(params.clientId) : undefined,
    status: params.status ? String(params.status) : undefined,
  })
}

async function openCreate(): Promise<void> {
  await Promise.all([ensureClients(), ensureUsers(), ensureDeptTree()])
  formMode.value = 'create'
  editingProject.value = null
  formVisible.value = true
}

async function openEdit(row: Project): Promise<void> {
  await Promise.all([ensureClients(), ensureUsers(), ensureDeptTree()])
  formMode.value = 'edit'
  editingProject.value = row
  formVisible.value = true
}

function openDetail(row: Project): void {
  detailProject.value = row
  void Promise.all([ensureClients(), ensureUsers(), ensureDefinitions()])
  detailOpen.value = true
}

function handleSelectionChange(rows: Project[]): void {
  // 勾选多条时以最后一条作为审批记录目标（列表行项目审批按单据查看）
  selectedProject.value = rows[rows.length - 1] ?? null
}

function openSelectedApprovals(): void {
  if (!selectedProject.value) {
    message.warning(t('project.approvalSelectFirst'))
    return
  }
  approvalsOpen.value = true
}

async function openMembers(row: Project): Promise<void> {
  await ensureUsers()
  try {
    const members = await fetchProjectMembers(row.id)
    membersProject.value = row
    initialMembers.value = members.map((m) => ({ userId: m.userId, role: m.role }))
    membersVisible.value = true
  } catch (error) {
    message.error(errorMessage(error))
  }
}

async function handleFormSubmit(payload: ProjectPayload | UpdateProjectPayload): Promise<void> {
  formDialogRef.value?.setSubmitting(true)
  try {
    if (formMode.value === 'create') {
      await createProject(payload as ProjectPayload)
      message.success(t('project.createSuccess'))
    } else if (editingProject.value) {
      await updateProject(editingProject.value.id, payload as UpdateProjectPayload)
      message.success(t('project.updateSuccess'))
    }
    formVisible.value = false
    await tableRef.value?.reload()
  } catch (error) {
    message.error(errorMessage(error))
  } finally {
    formDialogRef.value?.setSubmitting(false)
  }
}

async function handleMembersSubmit(
  members: { userId: string; role: 'PM' | 'DEV' | 'TEST' | 'DESIGN' | 'OPS' | 'OTHER' }[],
): Promise<void> {
  if (!membersProject.value) return
  membersDialogRef.value?.setSubmitting(true)
  try {
    await assignProjectMembers(membersProject.value.id, { members })
    message.success(t('project.assignSuccess'))
    membersVisible.value = false
  } catch (error) {
    message.error(errorMessage(error))
  } finally {
    membersDialogRef.value?.setSubmitting(false)
  }
}

async function handleDelete(row: Project): Promise<void> {
  const confirmed = await new Promise<boolean>((resolve) => {
    Modal.confirm({
      title: t('common.tip'),
      content: t('project.deleteConfirm', { name: row.name }),
      okType: 'danger',
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
  if (!confirmed) return
  try {
    await deleteProject(row.id)
    message.success(t('project.deleteSuccess'))
    await tableRef.value?.reload()
  } catch (error) {
    message.error(errorMessage(error))
  }
}
</script>

<template>
  <div class="project-page">
    <ProTable
      ref="tableRef"
      :columns="columns"
      :search-fields="searchFields"
      :request="requestProjects"
      :show-request-error="false"
      @request-error="handleRequestError"
      @selection-change="handleSelectionChange"
    >
      <template #toolbar-actions>
        <Button v-if="canCreate" type="primary" @click="openCreate">
          {{ t('project.create') }}
        </Button>
        <Button type="default" :disabled="!selectedProject" @click="openSelectedApprovals">
          {{ t('project.approvalRecords') }}
        </Button>
      </template>

      <template #column-status="{ row }">
        <Tag :color="statusColor(row.status)">{{ statusLabel(row.status) }}</Tag>
      </template>

      <template #column-initiationApprovalStatus="{ row }">
        <Tag
          v-if="row.initiationApprovalStatus"
          :color="approvalColor(row.initiationApprovalStatus)"
        >
          {{ t(`project.approval${row.initiationApprovalStatus}` as never) }}
        </Tag>
        <span v-else class="text-slate-400">-</span>
      </template>

      <template #column-closureApprovalStatus="{ row }">
        <Tag v-if="row.closureApprovalStatus" :color="approvalColor(row.closureApprovalStatus)">
          {{ t(`project.approval${row.closureApprovalStatus}` as never) }}
        </Tag>
        <span v-else class="text-slate-400">-</span>
      </template>

      <template #column-actions="{ row }">
        <ProTableActions :row="row" :actions="projectActions" />
      </template>
    </ProTable>

    <ProjectFormDialog
      ref="formDialogRef"
      v-model="formVisible"
      :mode="formMode"
      :editing="editingProject"
      :clients="clients"
      :users="users"
      :dept-tree="deptTree"
      @submit="handleFormSubmit"
    />

    <ProjectMembersDialog
      ref="membersDialogRef"
      v-model="membersVisible"
      :users="users"
      :initial-members="initialMembers"
      :title="
        membersProject ? t('project.membersAssignTitle', { name: membersProject.name }) : undefined
      "
      @submit="handleMembersSubmit"
    />

    <ProjectDetailDrawer
      v-model:open="detailOpen"
      :project="detailProject"
      :clients="clients"
      :users="users"
    />

    <ApprovalRecordsDrawer
      v-model:open="approvalsOpen"
      :business-type="'project'"
      :business-id="selectedProject?.id ?? null"
    />
  </div>
</template>

<style scoped lang="scss">
.project-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  min-height: 0;
}
</style>
