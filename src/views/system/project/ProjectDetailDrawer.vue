<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Button,
  Descriptions,
  DescriptionsItem,
  Drawer,
  Modal,
  Table,
  Tabs,
  TabPane,
  Tag,
  message,
} from 'antdv-next'

import { buildFileUrl, fetchFileList } from '@/api/file'
import {
  createProjectApproval,
  createProjectDeliverable,
  createProjectStage,
  deleteProjectDeliverable,
  deleteProjectStage,
  fetchProjectDetail,
  updateProjectDeliverable,
  updateProjectStage,
} from '@/api/project'
import FileUpload from '@/components/FileUpload/index.vue'
import type { Client } from '@/types/client'
import type { ManagedUser } from '@/types/user'
import type {
  ApprovalType,
  Project,
  ProjectApprovalPayload,
  ProjectAttachment,
  ProjectDeliverable,
  ProjectDeliverablePayload,
  ProjectDetail,
  ProjectFile,
  ProjectMember,
  ProjectMemberHistory,
  ProjectStage,
  ProjectStagePayload,
  UpdateProjectDeliverablePayload,
  UpdateProjectStagePayload,
} from '@/types/project'
import { getProjectApprovalType } from '@/types/project'
import { ApiRequestError } from '@/utils/request'
import ProjectApprovalDialog from './ProjectApprovalDialog.vue'
import ProjectDeliverableDialog from './ProjectDeliverableDialog.vue'
import ProjectStageDialog from './ProjectStageDialog.vue'

interface Props {
  open: boolean
  project: Project | null
  clients: Client[]
  users: ManagedUser[]
}

const props = defineProps<Props>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const { t, locale } = useI18n()

const visible = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
})

const detail = ref<ProjectDetail | null>(null)
const stages = ref<ProjectStage[]>([])
const deliverables = ref<ProjectDeliverable[]>([])
const attachments = ref<ProjectAttachment[]>([])
const loading = ref(false)
const activeTab = ref('overview')

const stageDialogVisible = ref(false)
const stageMode = ref<'create' | 'edit'>('create')
const editingStage = ref<ProjectStage | null>(null)
const stageDialogRef = ref<InstanceType<typeof ProjectStageDialog> | null>(null)

const deliverableDialogVisible = ref(false)
const deliverableMode = ref<'create' | 'edit'>('create')
const editingDeliverable = ref<ProjectDeliverable | null>(null)
const deliverableDialogRef = ref<InstanceType<typeof ProjectDeliverableDialog> | null>(null)

const approvalDialogVisible = ref(false)
const approvalDialogRef = ref<InstanceType<typeof ProjectApprovalDialog> | null>(null)

const clientName = computed(() => {
  if (!detail.value) return '-'
  if (detail.value.client?.name) return detail.value.client.name
  const client = props.clients.find((item) => item.id === detail.value?.clientId)
  return client?.name ?? detail.value.clientId
})

const managerName = computed(() => {
  if (!detail.value) return '-'
  return (
    detail.value.manager?.nickname?.trim() ||
    detail.value.manager?.name?.trim() ||
    detail.value.manager?.username?.trim() ||
    detail.value.managerId ||
    '-'
  )
})

const userMap = computed(
  () => new Map(props.users.map((user) => [user.id, user.nickname ?? user.username])),
)

const approvalType = computed<ApprovalType | null>(() =>
  getProjectApprovalType(detail.value?.status ?? ''),
)

const canStartApproval = computed(() => approvalType.value !== null)

/** 审批进行中：项目数据锁定，所有写入口禁用并给出原因 */
const approvalLocked = computed(
  () =>
    detail.value?.status === 'PENDING_INITIATION_APPROVAL' ||
    detail.value?.status === 'PENDING_CLOSURE_APPROVAL',
)

function guardLockedAction(): boolean {
  if (!approvalLocked.value) return false
  message.warning(t('project.approvalLockedTip'))
  return true
}

const approvalTypeLabel = computed(() =>
  approvalType.value ? t(`project.approvalType${approvalType.value}` as never) : '',
)

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  try {
    return new Intl.DateTimeFormat(locale.value, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date)
  } catch {
    return value
  }
}

function statusLabel(status: string): string {
  const key = `project.status${status}` as never
  const label = t(key)
  return label === key ? status : label
}

function statusColor(status: string): string {
  if (status === 'DRAFT' || status === 'ARCHIVED') return 'default'
  if (status === 'PENDING_INITIATION_APPROVAL' || status === 'PENDING_CLOSURE_APPROVAL') {
    return 'processing'
  }
  if (status === 'IN_PROGRESS') return 'blue'
  if (status === 'COMPLETED') return 'success'
  if (status === 'CANCELLED') return 'error'
  return 'default'
}

function approvalStatusLabel(status: string | null | undefined): string {
  if (!status) return '-'
  const key = `project.approval${status}` as never
  const label = t(key)
  return label === key ? status : label
}

function settlementLabel(value: string): string {
  const key = `project.settlement${value}` as never
  const label = t(key)
  return label === key ? value : label
}

function stageStatusLabel(value: string): string {
  const key = `project.stageStatus${value}` as never
  const label = t(key)
  return label === key ? value : label
}

function deliverableStatusLabel(value: string): string {
  const key = `project.deliverableStatus${value}` as never
  const label = t(key)
  return label === key ? value : label
}

function memberName(member: ProjectMember | ProjectMemberHistory): string {
  return (
    member.user?.nickname?.trim() ||
    member.user?.name?.trim() ||
    member.user?.username?.trim() ||
    userMap.value.get(member.userId) ||
    member.userId
  )
}

function memberLabel(member: ProjectMember | ProjectMemberHistory): string {
  const key = `project.role${member.role}` as never
  const role = t(key)
  return `${memberName(member)} (${role === key ? member.role : role})`
}

function attachmentFile(attachment: ProjectAttachment): ProjectFile {
  return attachment.file ?? attachment
}

function fileUrl(file: ProjectFile | null | undefined): string {
  if (!file) return ''
  return file.url || (file.path ? buildFileUrl(file.path) : '')
}

function fileName(file: ProjectFile | null | undefined): string {
  if (!file) return '-'
  return file.originalName || file.filename || file.id
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message
  if (error instanceof Error) return error.message
  return t('project.requestFailed')
}

async function loadAttachments(projectId: string): Promise<void> {
  try {
    const result = await fetchFileList({
      businessType: 'PROJECT_ATTACHMENT',
      businessId: projectId,
      page: 1,
      pageSize: 100,
    })
    attachments.value = result.items
  } catch {
    // The detail payload remains the fallback when the generic file list is unavailable.
  }
}

async function load(): Promise<void> {
  if (!props.project) return
  loading.value = true
  try {
    const result = await fetchProjectDetail(props.project.id)
    detail.value = result
    stages.value = result.stages ?? []
    deliverables.value = result.deliverables ?? []
    attachments.value = result.attachments ?? []
    await loadAttachments(result.id)
  } catch (error) {
    message.error(errorMessage(error))
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.open, props.project?.id] as const,
  ([open]) => {
    if (open) void load()
    else {
      detail.value = null
      stages.value = []
      deliverables.value = []
      attachments.value = []
    }
  },
)

function openCreateStage(): void {
  if (guardLockedAction()) return
  stageMode.value = 'create'
  editingStage.value = null
  stageDialogVisible.value = true
}

function openEditStage(row: ProjectStage): void {
  if (guardLockedAction()) return
  stageMode.value = 'edit'
  editingStage.value = row
  stageDialogVisible.value = true
}

async function handleStageSubmit(
  payload: ProjectStagePayload | UpdateProjectStagePayload,
): Promise<void> {
  if (!props.project) return
  stageDialogRef.value?.setSubmitting(true)
  try {
    if (stageMode.value === 'create') {
      await createProjectStage(props.project.id, payload as ProjectStagePayload)
      message.success(t('project.stageCreateSuccess'))
    } else if (editingStage.value) {
      await updateProjectStage(
        props.project.id,
        editingStage.value.id,
        payload as UpdateProjectStagePayload,
      )
      message.success(t('project.stageUpdateSuccess'))
    }
    stageDialogVisible.value = false
    await load()
  } catch (error) {
    message.error(errorMessage(error))
  } finally {
    stageDialogRef.value?.setSubmitting(false)
  }
}

async function handleDeleteStage(row: ProjectStage): Promise<void> {
  if (!props.project) return
  if (guardLockedAction()) return
  const confirmed = await new Promise<boolean>((resolve) => {
    Modal.confirm({
      title: t('common.tip'),
      content: t('project.stageDeleteConfirm', { name: row.name }),
      okType: 'danger',
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
  if (!confirmed) return
  try {
    await deleteProjectStage(props.project.id, row.id)
    message.success(t('project.stageDeleteSuccess'))
    await load()
  } catch (error) {
    message.error(errorMessage(error))
  }
}

function openCreateDeliverable(): void {
  if (guardLockedAction()) return
  deliverableMode.value = 'create'
  editingDeliverable.value = null
  deliverableDialogVisible.value = true
}

function openEditDeliverable(row: ProjectDeliverable): void {
  if (guardLockedAction()) return
  deliverableMode.value = 'edit'
  editingDeliverable.value = row
  deliverableDialogVisible.value = true
}

async function handleDeliverableSubmit(
  payload: ProjectDeliverablePayload | UpdateProjectDeliverablePayload,
): Promise<void> {
  if (!props.project) return
  deliverableDialogRef.value?.setSubmitting(true)
  try {
    if (deliverableMode.value === 'create') {
      await createProjectDeliverable(props.project.id, payload as ProjectDeliverablePayload)
      message.success(t('project.deliverableCreateSuccess'))
    } else if (editingDeliverable.value) {
      await updateProjectDeliverable(
        props.project.id,
        editingDeliverable.value.id,
        payload as UpdateProjectDeliverablePayload,
      )
      message.success(t('project.deliverableUpdateSuccess'))
    }
    deliverableDialogVisible.value = false
    await load()
  } catch (error) {
    message.error(errorMessage(error))
  } finally {
    deliverableDialogRef.value?.setSubmitting(false)
  }
}

async function handleDeleteDeliverable(row: ProjectDeliverable): Promise<void> {
  if (!props.project) return
  if (guardLockedAction()) return
  const confirmed = await new Promise<boolean>((resolve) => {
    Modal.confirm({
      title: t('common.tip'),
      content: t('project.deliverableDeleteConfirm', { name: row.name }),
      okType: 'danger',
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
  if (!confirmed) return
  try {
    await deleteProjectDeliverable(props.project.id, row.id)
    message.success(t('project.deliverableDeleteSuccess'))
    await load()
  } catch (error) {
    message.error(errorMessage(error))
  }
}

function openApproval(): void {
  if (approvalType.value) approvalDialogVisible.value = true
}

async function handleApprovalSubmit(payload: ProjectApprovalPayload): Promise<void> {
  if (!props.project) return
  approvalDialogRef.value?.setSubmitting(true)
  try {
    await createProjectApproval(props.project.id, payload)
    message.success(t('project.approvalSuccess'))
    approvalDialogVisible.value = false
    await load()
  } catch (error) {
    message.error(errorMessage(error))
  } finally {
    approvalDialogRef.value?.setSubmitting(false)
  }
}

async function handleAttachmentUpload(): Promise<void> {
  if (!detail.value) return
  await loadAttachments(detail.value.id)
  message.success(t('project.attachmentUploadSuccess'))
}
</script>

<template>
  <Drawer
    :open="visible"
    :title="t('project.detailTitle')"
    :size="980"
    destroy-on-hidden
    @close="visible = false"
  >
    <div v-if="loading" class="py-10 text-center text-slate-500">{{ t('common.loading') }}</div>
    <template v-else-if="detail">
      <div
        v-if="approvalLocked"
        class="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700"
      >
        {{ t('project.approvalLockedTip') }}
      </div>
      <div class="mb-4 flex justify-end">
        <Button v-if="canStartApproval" type="primary" size="small" @click="openApproval">
          {{ t('project.approvalCreate', { type: approvalTypeLabel }) }}
        </Button>
      </div>

      <Descriptions :column="2" bordered size="small" class="mb-4">
        <DescriptionsItem :label="t('project.code')">{{ detail.code }}</DescriptionsItem>
        <DescriptionsItem :label="t('project.name')">{{ detail.name }}</DescriptionsItem>
        <DescriptionsItem :label="t('project.client')">{{ clientName }}</DescriptionsItem>
        <DescriptionsItem :label="t('project.manager')">{{ managerName }}</DescriptionsItem>
        <DescriptionsItem :label="t('project.status')">
          <Tag :color="statusColor(detail.status)">{{ statusLabel(detail.status) }}</Tag>
        </DescriptionsItem>
        <DescriptionsItem :label="t('project.initiationApprovalStatus')">
          {{ approvalStatusLabel(detail.initiationApprovalStatus) }}
        </DescriptionsItem>
        <DescriptionsItem :label="t('project.closureApprovalStatus')">
          {{ approvalStatusLabel(detail.closureApprovalStatus) }}
        </DescriptionsItem>
        <DescriptionsItem :label="t('project.settlementStatus')">
          {{ settlementLabel(detail.settlementStatus) }}
        </DescriptionsItem>
        <DescriptionsItem :label="t('project.contractAmount')">
          {{ detail.contractAmount ?? '-' }}
        </DescriptionsItem>
        <DescriptionsItem :label="t('project.budgetedCost')">
          {{ detail.budgetedCost ?? '-' }}
        </DescriptionsItem>
        <DescriptionsItem :label="t('project.actualCost')">
          {{ detail.actualCost ?? '-' }}
        </DescriptionsItem>
        <DescriptionsItem :label="t('project.startDate')">
          {{ formatDateTime(detail.startDate) }}
        </DescriptionsItem>
        <DescriptionsItem :label="t('project.endDate')">
          {{ formatDateTime(detail.endDate) }}
        </DescriptionsItem>
        <DescriptionsItem :label="t('project.description')" :span="2">
          {{ detail.description ?? '-' }}
        </DescriptionsItem>
      </Descriptions>

      <Tabs v-model:active-key="activeTab">
        <TabPane key="overview" :tab="t('project.tabOverview')">
          <div class="grid gap-3 md:grid-cols-2">
            <div class="rounded border border-slate-100 px-3 py-2">
              <div class="mb-2 text-sm font-semibold text-slate-700">
                {{ t('project.members') }}
              </div>
              <div v-if="detail.members.length" class="flex flex-wrap gap-1.5">
                <Tag v-for="member in detail.members" :key="`${member.userId}-${member.joinedAt}`">
                  {{ memberLabel(member) }}
                </Tag>
              </div>
              <span v-else class="text-sm text-slate-400">{{ t('project.memberEmpty') }}</span>
            </div>
            <div class="rounded border border-slate-100 px-3 py-2">
              <div class="mb-2 text-sm font-semibold text-slate-700">
                {{ t('project.memberHistory') }}
              </div>
              <div
                v-if="detail.memberHistory.length"
                class="flex flex-col gap-1 text-sm text-slate-600"
              >
                <div
                  v-for="history in detail.memberHistory"
                  :key="history.id ?? `${history.userId}-${history.joinedAt}`"
                >
                  {{ memberLabel(history) }} · {{ formatDateTime(history.joinedAt) }} →
                  {{ formatDateTime(history.leftAt) }}
                </div>
              </div>
              <span v-else class="text-sm text-slate-400">{{
                t('project.memberHistoryEmpty')
              }}</span>
            </div>
          </div>
        </TabPane>

        <TabPane key="stages" :tab="t('project.tabStages')">
          <div class="mb-2 flex justify-end">
            <Button type="primary" size="small" :disabled="approvalLocked" @click="openCreateStage">
              {{ t('project.stageCreate') }}
            </Button>
          </div>
          <Table
            :data-source="stages"
            :columns="[
              { title: t('project.stageName'), dataIndex: 'name', key: 'name' },
              { title: t('project.stageSort'), dataIndex: 'sort', key: 'sort', width: 80 },
              { title: t('project.stageStatus'), dataIndex: 'status', key: 'status', width: 120 },
              { title: t('project.stagePlannedRangeLabel'), key: 'plannedRange', width: 210 },
              { title: t('project.stageActualRangeLabel'), key: 'actualRange', width: 210 },
              { title: t('common.actions'), key: 'actions', width: 160 },
            ]"
            row-key="id"
            :pagination="false"
            size="small"
          >
            <template #bodyCell="{ column, record, text }">
              <template v-if="column.key === 'status'">
                {{ stageStatusLabel(String(text ?? '')) }}
              </template>
              <template v-else-if="column.key === 'plannedRange'">
                {{ formatDateTime((record as ProjectStage).plannedStartAt) }} →
                {{ formatDateTime((record as ProjectStage).plannedEndAt) }}
              </template>
              <template v-else-if="column.key === 'actualRange'">
                {{ formatDateTime((record as ProjectStage).actualStartAt) }} →
                {{ formatDateTime((record as ProjectStage).actualEndAt) }}
              </template>
              <template v-else-if="column.key === 'actions'">
                <Button
                  type="link"
                  size="small"
                  :disabled="approvalLocked"
                  @click="openEditStage(record as ProjectStage)"
                >
                  {{ t('common.edit') }}
                </Button>
                <Button
                  type="link"
                  size="small"
                  danger
                  :disabled="approvalLocked"
                  @click="handleDeleteStage(record as ProjectStage)"
                >
                  {{ t('common.delete') }}
                </Button>
              </template>
            </template>
          </Table>
        </TabPane>

        <TabPane key="deliverables" :tab="t('project.tabDeliverables')">
          <div class="mb-2 flex justify-end">
            <Button
              type="primary"
              size="small"
              :disabled="approvalLocked"
              @click="openCreateDeliverable"
            >
              {{ t('project.deliverableCreate') }}
            </Button>
          </div>
          <Table
            :data-source="deliverables"
            :columns="[
              { title: t('project.deliverableName'), dataIndex: 'name', key: 'name' },
              {
                title: t('project.deliverableVersion'),
                dataIndex: 'version',
                key: 'version',
                width: 100,
              },
              {
                title: t('project.deliverableStatus'),
                dataIndex: 'status',
                key: 'status',
                width: 110,
              },
              { title: t('project.deliverableFile'), key: 'file', width: 220 },
              { title: t('common.actions'), key: 'actions', width: 160 },
            ]"
            row-key="id"
            :pagination="false"
            size="small"
          >
            <template #bodyCell="{ column, record, text }">
              <template v-if="column.key === 'status'">
                {{ deliverableStatusLabel(String(text ?? '')) }}
              </template>
              <template v-else-if="column.key === 'file'">
                <a
                  v-if="(record as ProjectDeliverable).file"
                  :href="fileUrl((record as ProjectDeliverable).file)"
                  target="_blank"
                  rel="noreferrer"
                  class="text-blue-600 hover:text-blue-700"
                >
                  {{ fileName((record as ProjectDeliverable).file) }}
                </a>
                <span v-else class="text-slate-400">{{ t('project.deliverableFileEmpty') }}</span>
              </template>
              <template v-else-if="column.key === 'actions'">
                <Button
                  type="link"
                  size="small"
                  :disabled="approvalLocked"
                  @click="openEditDeliverable(record as ProjectDeliverable)"
                >
                  {{ t('common.edit') }}
                </Button>
                <Button
                  type="link"
                  size="small"
                  danger
                  :disabled="approvalLocked"
                  @click="handleDeleteDeliverable(record as ProjectDeliverable)"
                >
                  {{ t('common.delete') }}
                </Button>
              </template>
            </template>
          </Table>
        </TabPane>

        <TabPane key="attachments" :tab="t('project.tabAttachments')">
          <FileUpload
            v-if="!approvalLocked"
            category="FILE"
            multiple
            :max-count="20"
            :business-type="'PROJECT_ATTACHMENT'"
            :business-id="detail.id"
            @success="handleAttachmentUpload"
          />
          <div v-else class="mb-2 text-sm text-slate-400">{{ t('project.approvalLockedTip') }}</div>
          <div v-if="attachments.length" class="mt-4 flex flex-col gap-2">
            <a
              v-for="attachment in attachments"
              :key="attachment.id"
              :href="fileUrl(attachmentFile(attachment))"
              target="_blank"
              rel="noreferrer"
              class="text-sm text-blue-600 hover:text-blue-700"
            >
              {{ fileName(attachmentFile(attachment)) }}
            </a>
          </div>
          <div v-else class="mt-4 text-sm text-slate-400">{{ t('project.attachmentEmpty') }}</div>
        </TabPane>
      </Tabs>

      <ProjectStageDialog
        ref="stageDialogRef"
        v-model="stageDialogVisible"
        :mode="stageMode"
        :editing="editingStage"
        @submit="handleStageSubmit"
      />
      <ProjectDeliverableDialog
        ref="deliverableDialogRef"
        v-model="deliverableDialogVisible"
        :mode="deliverableMode"
        :project-id="detail.id"
        :editing="editingDeliverable"
        :stages="stages"
        @submit="handleDeliverableSubmit"
      />
      <ProjectApprovalDialog
        ref="approvalDialogRef"
        v-model="approvalDialogVisible"
        :approval-type="approvalType ?? 'INITIATION'"
        :default-title="detail.name"
        @submit="handleApprovalSubmit"
      />
    </template>
  </Drawer>
</template>
