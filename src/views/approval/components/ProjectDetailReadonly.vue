<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Descriptions, DescriptionsItem, Tag, message } from 'antdv-next'

import { buildFileUrl } from '@/api/file'
import { downloadProjectFileAsset } from '@/api/project-file'
import type {
  ApprovalType,
  ProjectApprovalFormData,
  ProjectAttachment,
  ProjectDetail,
  ProjectMember,
  ProjectMemberHistory,
  ProjectStage,
} from '@/types/project'
import type { ProjectFileAsset } from '@/types/project-file'

interface Props {
  businessId: string
  formData?: Record<string, unknown> | null
}

const props = defineProps<Props>()

const { t, locale } = useI18n()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isApprovalType(value: unknown): value is ApprovalType {
  return value === 'INITIATION' || value === 'CLOSURE'
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isProjectStatus(value: unknown): boolean {
  return (
    value === 'DRAFT' ||
    value === 'PENDING_INITIATION_APPROVAL' ||
    value === 'IN_PROGRESS' ||
    value === 'PENDING_CLOSURE_APPROVAL' ||
    value === 'COMPLETED' ||
    value === 'ARCHIVED' ||
    value === 'CANCELLED'
  )
}

function isApprovalStatus(value: unknown): boolean {
  return (
    value === null ||
    value === 'PENDING' ||
    value === 'APPROVED' ||
    value === 'REJECTED' ||
    value === 'CANCELLED'
  )
}

function isProjectSnapshot(value: unknown): value is ProjectDetail {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.code === 'string' &&
    typeof value.name === 'string' &&
    typeof value.clientId === 'string' &&
    isProjectStatus(value.status) &&
    isApprovalStatus(value.initiationApprovalStatus) &&
    isApprovalStatus(value.closureApprovalStatus) &&
    isNullableString(value.description) &&
    isNullableString(value.contractAmount) &&
    isNullableString(value.budgetedCost) &&
    isNullableString(value.actualCost) &&
    typeof value.settlementStatus === 'string' &&
    isNullableString(value.startDate) &&
    isNullableString(value.endDate) &&
    isNullableString(value.actualEndDate) &&
    isNullableString(value.managerId) &&
    isNullableString(value.deptId) &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string' &&
    Array.isArray(value.members) &&
    Array.isArray(value.memberHistory) &&
    Array.isArray(value.stages) &&
    Array.isArray(value.attachments) &&
    Array.isArray(value.deliverables)
  )
}

function parseSnapshot(
  value: Record<string, unknown> | null | undefined,
): ProjectApprovalFormData | null {
  if (!value || value.snapshotVersion !== 1) return null
  if (!isApprovalType(value.approvalType) || typeof value.submittedAt !== 'string') return null
  if (!isProjectSnapshot(value.project)) return null
  return {
    snapshotVersion: 1,
    approvalType: value.approvalType,
    submittedAt: value.submittedAt,
    project: value.project,
  }
}

const snapshot = computed(() => parseSnapshot(props.formData))
const project = computed<ProjectDetail | null>(() => snapshot.value?.project ?? null)

function memberUserName(member: ProjectMember | ProjectMemberHistory): string {
  return (
    member.user?.nickname?.trim() ||
    member.user?.name?.trim() ||
    member.user?.username?.trim() ||
    member.userId
  )
}

function memberLabel(member: ProjectMember | ProjectMemberHistory): string {
  const roleKey = `project.role${member.role}` as never
  const role = t(roleKey)
  return `${memberUserName(member)} (${role === roleKey ? member.role : role})`
}

function clientName(projectData: ProjectDetail): string {
  return projectData.client?.name ?? projectData.clientId
}

function managerName(projectData: ProjectDetail): string {
  return (
    projectData.manager?.nickname?.trim() ||
    projectData.manager?.name?.trim() ||
    projectData.manager?.username?.trim() ||
    projectData.managerId ||
    '-'
  )
}

function statusLabel(status: string): string {
  const key = `project.status${status}` as never
  const label = t(key)
  return label === key ? status : label
}

function approvalTypeLabel(type: ApprovalType): string {
  return t(`project.approvalType${type}` as never)
}

function approvalStatusLabel(status: string | null | undefined): string {
  if (!status) return '-'
  const key = `project.approval${status}` as never
  const label = t(key)
  return label === key ? status : label
}

function stageStatusLabel(status: string): string {
  const key = `project.stageStatus${status}` as never
  const label = t(key)
  return label === key ? status : label
}

function deliverableStatusLabel(status: string): string {
  const key = `project.deliverableStatus${status}` as never
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

function attachmentRecord(attachment: ProjectAttachment): Record<string, unknown> {
  return attachment as unknown as Record<string, unknown>
}

function attachmentFile(attachment: ProjectAttachment): Record<string, unknown> {
  const record = attachmentRecord(attachment)
  return isRecord(record.file) ? record.file : record
}

function fileUrl(attachment: ProjectAttachment): string {
  const record = attachmentRecord(attachment)
  if (typeof record.downloadUrl === 'string') return record.downloadUrl
  const file = attachmentFile(attachment)
  if (typeof file.url === 'string') return file.url
  return typeof file.path === 'string' ? buildFileUrl(file.path) : ''
}

function fileName(attachment: ProjectAttachment): string {
  const file = attachmentFile(attachment)
  if (typeof file.originalName === 'string') return file.originalName
  if (typeof file.filename === 'string') return file.filename
  return typeof file.id === 'string' ? file.id : '-'
}

function isProtectedAsset(attachment: ProjectAttachment): attachment is ProjectFileAsset {
  const record = attachmentRecord(attachment)
  return typeof record.downloadUrl === 'string' && isRecord(record.file)
}

async function handleDownload(attachment: ProjectAttachment): Promise<void> {
  if (!isProtectedAsset(attachment)) return
  try {
    await downloadProjectFileAsset(project.value?.id ?? props.businessId, attachment)
  } catch {
    message.error(t('projectFile.downloadFailed'))
  }
}

function deliverableFiles(deliverable: ProjectDetail['deliverables'][number]): ProjectAttachment[] {
  const record = deliverable as unknown as Record<string, unknown>
  if (Array.isArray(record.assets)) return record.assets as ProjectAttachment[]
  return isRecord(record.file) ? [record.file as unknown as ProjectAttachment] : []
}

const memberRows = computed(() => project.value?.members ?? [])
const memberHistoryRows = computed(() => project.value?.memberHistory ?? [])
const stageRows = computed<ProjectStage[]>(() => project.value?.stages ?? [])
const attachmentRows = computed(() => project.value?.attachments ?? [])
const deliverableRows = computed(() => project.value?.deliverables ?? [])
</script>

<template>
  <div class="rounded-xl border border-slate-200 bg-white p-4">
    <div v-if="snapshot && project">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <span class="text-sm font-bold text-slate-800">{{ project.name }}</span>
        <Tag>{{ approvalTypeLabel(snapshot.approvalType) }}</Tag>
        <span class="text-xs text-slate-500">
          {{ t('project.snapshotSubmittedAt', { date: formatDateTime(snapshot.submittedAt) }) }}
        </span>
      </div>

      <Descriptions :column="2" bordered size="small">
        <DescriptionsItem :label="t('project.code')">{{ project.code }}</DescriptionsItem>
        <DescriptionsItem :label="t('project.status')">
          <Tag :color="statusColor(project.status)">{{ statusLabel(project.status) }}</Tag>
        </DescriptionsItem>
        <DescriptionsItem :label="t('project.client')">{{ clientName(project) }}</DescriptionsItem>
        <DescriptionsItem :label="t('project.manager')">{{
          managerName(project)
        }}</DescriptionsItem>
        <DescriptionsItem :label="t('project.initiationApprovalStatus')">
          {{ approvalStatusLabel(project.initiationApprovalStatus) }}
        </DescriptionsItem>
        <DescriptionsItem :label="t('project.closureApprovalStatus')">
          {{ approvalStatusLabel(project.closureApprovalStatus) }}
        </DescriptionsItem>
        <DescriptionsItem :label="t('project.contractAmount')">
          {{ project.contractAmount ?? '-' }}
        </DescriptionsItem>
        <DescriptionsItem :label="t('project.budgetedCost')">
          {{ project.budgetedCost ?? '-' }}
        </DescriptionsItem>
        <DescriptionsItem :label="t('project.actualCost')">
          {{ project.actualCost ?? '-' }}
        </DescriptionsItem>
        <DescriptionsItem :label="t('project.settlementStatus')">
          {{ project.settlementStatus }}
        </DescriptionsItem>
        <DescriptionsItem :label="t('project.startDate')">
          {{ formatDateTime(project.startDate) }}
        </DescriptionsItem>
        <DescriptionsItem :label="t('project.endDate')">
          {{ formatDateTime(project.endDate) }}
        </DescriptionsItem>
        <DescriptionsItem :label="t('project.description')" :span="2">
          {{ project.description ?? '-' }}
        </DescriptionsItem>
      </Descriptions>

      <section class="mt-4">
        <h4 class="mb-2 text-sm font-semibold text-slate-800">{{ t('project.members') }}</h4>
        <div v-if="memberRows.length" class="flex flex-wrap gap-1.5">
          <Tag v-for="member in memberRows" :key="`${member.userId}-${member.joinedAt}`">
            {{ memberLabel(member) }}
          </Tag>
        </div>
        <span v-else class="text-sm text-slate-400">{{ t('project.memberEmpty') }}</span>
      </section>

      <section class="mt-4">
        <h4 class="mb-2 text-sm font-semibold text-slate-800">{{ t('project.memberHistory') }}</h4>
        <div v-if="memberHistoryRows.length" class="flex flex-col gap-1 text-sm text-slate-600">
          <div
            v-for="history in memberHistoryRows"
            :key="history.id ?? `${history.userId}-${history.joinedAt}`"
            class="flex flex-wrap items-center gap-2"
          >
            <span>{{ memberLabel(history) }}</span>
            <span>{{ formatDateTime(history.joinedAt) }}</span>
            <span>→</span>
            <span>{{ formatDateTime(history.leftAt) }}</span>
          </div>
        </div>
        <span v-else class="text-sm text-slate-400">{{ t('project.memberHistoryEmpty') }}</span>
      </section>

      <section class="mt-4">
        <h4 class="mb-2 text-sm font-semibold text-slate-800">{{ t('project.stages') }}</h4>
        <div v-if="stageRows.length" class="flex flex-col gap-2">
          <div
            v-for="stage in stageRows"
            :key="stage.id"
            class="rounded border border-slate-100 px-3 py-2 text-sm"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="font-medium text-slate-700">{{ stage.name }}</span>
              <Tag>{{ stageStatusLabel(stage.status) }}</Tag>
            </div>
            <div class="mt-1 text-xs text-slate-500">
              {{
                t('project.stagePlannedRange', {
                  start: formatDateTime(stage.plannedStartAt),
                  end: formatDateTime(stage.plannedEndAt),
                })
              }}
            </div>
            <div class="text-xs text-slate-500">
              {{
                t('project.stageActualRange', {
                  start: formatDateTime(stage.actualStartAt),
                  end: formatDateTime(stage.actualEndAt),
                })
              }}
            </div>
          </div>
        </div>
        <span v-else class="text-sm text-slate-400">{{ t('project.stageEmpty') }}</span>
      </section>

      <section class="mt-4">
        <h4 class="mb-2 text-sm font-semibold text-slate-800">{{ t('project.attachments') }}</h4>
        <div v-if="attachmentRows.length" class="flex flex-col gap-1 text-sm">
          <template v-for="attachment in attachmentRows" :key="attachment.id">
            <Button
              v-if="isProtectedAsset(attachment)"
              type="link"
              size="small"
              @click="void handleDownload(attachment)"
            >
              {{ fileName(attachment) }}
            </Button>
            <a
              v-else
              :href="fileUrl(attachment)"
              target="_blank"
              rel="noreferrer"
              class="text-blue-600 hover:text-blue-700"
            >
              {{ fileName(attachment) }}
            </a>
          </template>
        </div>
        <span v-else class="text-sm text-slate-400">{{ t('project.attachmentEmpty') }}</span>
      </section>

      <section class="mt-4">
        <h4 class="mb-2 text-sm font-semibold text-slate-800">{{ t('project.deliverables') }}</h4>
        <div v-if="deliverableRows.length" class="flex flex-col gap-2">
          <div
            v-for="deliverable in deliverableRows"
            :key="deliverable.id"
            class="flex flex-wrap items-center gap-2 text-sm"
          >
            <span class="font-medium text-slate-700">{{ deliverable.name }}</span>
            <Tag>{{ deliverableStatusLabel(deliverable.status) }}</Tag>
            <template v-if="deliverableFiles(deliverable).length">
              <template v-for="file in deliverableFiles(deliverable)" :key="file.id">
                <Button
                  v-if="isProtectedAsset(file)"
                  type="link"
                  size="small"
                  @click="void handleDownload(file)"
                >
                  {{ fileName(file) }}
                </Button>
                <a
                  v-else
                  :href="fileUrl(file)"
                  target="_blank"
                  rel="noreferrer"
                  class="text-blue-600 hover:text-blue-700"
                >
                  {{ fileName(file) }}
                </a>
              </template>
            </template>
            <span v-else class="text-slate-400">{{ t('project.deliverableFileEmpty') }}</span>
          </div>
        </div>
        <span v-else class="text-sm text-slate-400">{{ t('project.deliverableEmpty') }}</span>
      </section>
    </div>
    <div v-else class="py-4 text-sm text-slate-500" role="alert">
      {{ t('project.snapshotInvalid') }}
    </div>
  </div>
</template>
