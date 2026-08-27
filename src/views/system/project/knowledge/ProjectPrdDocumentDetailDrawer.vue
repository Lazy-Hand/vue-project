<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Card, Drawer, Empty, Modal, Space, Tag, message } from 'antdv-next'
import {
  ClockCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
} from '@antdv-next/icons'

import { downloadProjectFileAsset } from '@/api/project-file'
import {
  createProjectPrdDocumentVersion,
  deleteProjectPrdDocumentVersion,
  fetchProjectPrdDocumentVersions,
  fetchProjectRequirements,
  updateProjectPrdDocumentVersion,
} from '@/api/project-knowledge'
import type {
  ProjectPrdDocument,
  ProjectPrdDocumentVersion,
  ProjectPrdDocumentVersionPayload,
  ProjectRequirement,
  UpdateProjectPrdDocumentVersionPayload,
} from '@/types/project-knowledge'
import type { ProjectFileAsset } from '@/types/project-file'
import KnowledgeFormDialog, { type KnowledgeFormField } from './KnowledgeFormDialog.vue'
import { confirmKnowledgeDelete, errorMessage, formatKnowledgeDate } from './knowledge-utils'

interface Props {
  open: boolean
  projectId: string
  document: ProjectPrdDocument | null
  canManage: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  changed: []
}>()
const { locale, t } = useI18n()

const visible = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
})
const versions = ref<ProjectPrdDocumentVersion[]>([])
const coveredRequirements = ref<ProjectRequirement[]>([])
const loading = ref(false)
const submitting = ref(false)
const deletingId = ref<string | null>(null)
const versionFormOpen = ref(false)
const versionFormMode = ref<'create' | 'edit'>('create')
const editingVersion = ref<ProjectPrdDocumentVersion | null>(null)
const versionFormModel = ref<Record<string, string>>({})
const viewOpen = ref(false)
const viewingVersion = ref<ProjectPrdDocumentVersion | null>(null)
const formDialogRef = ref<InstanceType<typeof KnowledgeFormDialog> | null>(null)
const formAssets = computed(() => editingVersion.value?.assets ?? [])

const versionFields = computed<KnowledgeFormField[]>(() => [
  {
    key: 'content',
    label: t('projectKnowledge.prdVersionContent'),
    placeholder: t('projectKnowledge.prdVersionContentPlaceholder'),
    type: 'textarea',
    rows: 12,
    required: true,
  },
  {
    key: 'changeSummary',
    label: t('projectKnowledge.prdChangeSummary'),
    placeholder: t('projectKnowledge.prdChangeSummaryPlaceholder'),
    type: 'textarea',
    rows: 3,
  },
  {
    key: 'status',
    label: t('projectKnowledge.prdVersionStatus'),
    placeholder: t('projectKnowledge.prdVersionStatusPlaceholder'),
    type: 'select',
    options: [
      { label: t('projectKnowledge.prdVersionStatusDRAFT'), value: 'DRAFT' },
      { label: t('projectKnowledge.prdVersionStatusPUBLISHED'), value: 'PUBLISHED' },
    ],
  },
])

const versionFormTitle = computed(() =>
  versionFormMode.value === 'create'
    ? t('projectKnowledge.prdVersionCreateTitle')
    : t('projectKnowledge.prdVersionEditTitle'),
)

function resetForm(): void {
  versionFormModel.value = {
    content: '',
    changeSummary: '',
    status: 'DRAFT',
  }
}

function fillForm(row: ProjectPrdDocumentVersion): void {
  versionFormModel.value = {
    content: row.content,
    changeSummary: row.changeSummary ?? '',
    status: row.status,
  }
}

async function load(): Promise<void> {
  if (!props.open || !props.projectId || !props.document?.id) return
  loading.value = true
  try {
    const [loadedVersions, loadedRequirements] = await Promise.all([
      fetchProjectPrdDocumentVersions(props.projectId, props.document.id),
      fetchProjectRequirements(props.projectId),
    ])
    versions.value = loadedVersions
    coveredRequirements.value = loadedRequirements.filter(
      (requirement) => requirement.documentId === props.document?.id,
    )
  } catch (error) {
    message.error(errorMessage(error, t('projectKnowledge.requestFailed')))
  } finally {
    loading.value = false
  }
}

function openCreateVersion(): void {
  if (!props.canManage) return
  versionFormMode.value = 'create'
  editingVersion.value = null
  resetForm()
  versionFormOpen.value = true
}

function openEditVersion(row: ProjectPrdDocumentVersion): void {
  if (!props.canManage || row.status === 'PUBLISHED') return
  versionFormMode.value = 'edit'
  editingVersion.value = row
  fillForm(row)
  versionFormOpen.value = true
}

function openViewVersion(row: ProjectPrdDocumentVersion): void {
  viewingVersion.value = row
  viewOpen.value = true
}

function optionalValue(value: string): string | null {
  const normalized = value.trim()
  return normalized || null
}

function buildPayload(
  values: Record<string, string>,
  assetIds?: string[],
): ProjectPrdDocumentVersionPayload {
  return {
    content: values.content?.trim() ?? '',
    changeSummary: optionalValue(values.changeSummary ?? ''),
    status: (values.status || 'DRAFT') as ProjectPrdDocumentVersionPayload['status'],
    origin: 'MANUAL',
    ...(assetIds !== undefined ? { assetIds } : {}),
  }
}

async function handleSubmit(values: Record<string, string>, assetIds?: string[]): Promise<void> {
  const documentId = props.document?.id
  if (!documentId) {
    await formDialogRef.value?.rollbackFiles()
    return
  }
  const payload = buildPayload(values, assetIds)
  if (!payload.content) {
    await formDialogRef.value?.rollbackFiles()
    message.warning(t('projectKnowledge.prdVersionContentRequired'))
    return
  }
  submitting.value = true
  try {
    if (versionFormMode.value === 'create') {
      await createProjectPrdDocumentVersion(props.projectId, documentId, payload)
      message.success(t('projectKnowledge.createSuccess'))
    } else if (editingVersion.value) {
      const updatePayload: UpdateProjectPrdDocumentVersionPayload = payload
      await updateProjectPrdDocumentVersion(
        props.projectId,
        documentId,
        editingVersion.value.id,
        updatePayload,
      )
      message.success(t('projectKnowledge.updateSuccess'))
    }
    formDialogRef.value?.commitFiles()
    versionFormOpen.value = false
    await load()
    emit('changed')
  } catch (error) {
    await formDialogRef.value?.rollbackFiles()
    message.error(errorMessage(error, t('projectKnowledge.requestFailed')))
  } finally {
    submitting.value = false
  }
}

async function handleDownload(asset: ProjectFileAsset): Promise<void> {
  try {
    await downloadProjectFileAsset(props.projectId, asset)
  } catch (error) {
    message.error(errorMessage(error, t('projectFile.downloadFailed')))
  }
}

async function handleDelete(row: ProjectPrdDocumentVersion): Promise<void> {
  const documentId = props.document?.id
  if (!props.canManage || !documentId || row.status === 'PUBLISHED' || deletingId.value) return
  const confirmed = await confirmKnowledgeDelete(
    t('common.tip'),
    t('projectKnowledge.prdVersionDeleteConfirm', { version: row.version }),
    t('common.confirm'),
    t('common.cancel'),
  )
  if (!confirmed) return
  deletingId.value = row.id
  try {
    await deleteProjectPrdDocumentVersion(props.projectId, documentId, row.id)
    message.success(t('projectKnowledge.deleteSuccess'))
    await load()
    emit('changed')
  } catch (error) {
    message.error(errorMessage(error, t('projectKnowledge.requestFailed')))
  } finally {
    deletingId.value = null
  }
}

watch(
  () => [props.open, props.projectId, props.document?.id] as const,
  () => void load(),
  { immediate: true },
)
</script>

<template>
  <Drawer
    v-model:open="visible"
    :title="document?.title ?? t('projectKnowledge.prdDetail')"
    :size="760"
    destroy-on-hidden
  >
    <template v-if="document">
      <div class="prd-detail__intro mb-4">
        <div class="prd-detail__meta flex flex-wrap items-center gap-2">
          <Tag color="blue">{{ t(`projectKnowledge.prdType${document.type}`) }}</Tag>
          <Tag color="processing">{{ t(`projectKnowledge.prdStatus${document.status}`) }}</Tag>
        </div>
      </div>

      <Card size="small" class="prd-detail__covered mb-4 bg-slate-50/70 dark:bg-slate-900/50">
        <div class="prd-detail__covered-header flex items-center justify-between mb-2">
          <span class="text-xs font-semibold text-slate-700 dark:text-slate-200">{{
            t('projectKnowledge.documentCoveredRequirements')
          }}</span>
          <Tag v-if="coveredRequirements.length" color="blue" class="text-xs">
            {{ coveredRequirements.length }}
          </Tag>
        </div>
        <Empty
          v-if="!coveredRequirements.length"
          :description="t('projectKnowledge.documentCoveredRequirementsEmpty')"
          :image="Empty.PRESENTED_IMAGE_SIMPLE"
        />
        <div v-else class="covered-requirement-list space-y-1.5">
          <div
            v-for="row in coveredRequirements"
            :key="row.id"
            class="covered-requirement-row flex items-center justify-between rounded-md bg-white p-2 text-xs shadow-2xs dark:bg-slate-800"
          >
            <div class="flex items-center gap-2 min-w-0 flex-1">
              <span class="covered-requirement-row__code font-mono font-medium text-slate-500">{{
                row.code
              }}</span>
              <span
                class="covered-requirement-row__title truncate text-slate-800 dark:text-slate-100"
                >{{ row.title }}</span
              >
            </div>
            <Tag class="text-xs shrink-0">{{
              t(`projectKnowledge.requirementStatus${row.status}`)
            }}</Tag>
          </div>
        </div>
      </Card>

      <div class="prd-detail__versions-header flex items-center justify-between mb-3">
        <div>
          <div
            class="prd-detail__kicker text-[11px] font-bold tracking-wider text-teal-600 uppercase"
          >
            {{ t('projectKnowledge.prdVersionsKicker') }}
          </div>
          <h2 class="text-lg font-bold text-slate-800 dark:text-slate-100">
            {{ t('projectKnowledge.prdVersionsTitle') }}
          </h2>
        </div>
        <Button v-if="canManage" type="primary" size="small" @click="openCreateVersion">
          <PlusOutlined />{{ t('projectKnowledge.prdVersionCreate') }}
        </Button>
      </div>

      <div v-if="loading" class="knowledge-state">{{ t('common.loading') }}</div>
      <Empty v-else-if="!versions.length" :description="t('projectKnowledge.prdVersionEmpty')" />
      <div v-else class="version-ledger space-y-3">
        <Card
          v-for="row in versions"
          :key="row.id"
          size="small"
          class="version-ledger__row transition-all hover:border-teal-500/40 hover:shadow-xs"
        >
          <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0 flex-1">
              <div class="version-ledger__meta flex flex-wrap items-center gap-2">
                <Tag color="blue" class="font-mono font-semibold">
                  {{ t('projectKnowledge.prdVersionLabel', { version: row.version }) }}
                </Tag>
                <Tag v-if="row.status === 'PUBLISHED'" color="success">{{
                  t('projectKnowledge.prdPublished')
                }}</Tag>
                <Tag v-else>{{ t('projectKnowledge.prdUnpublished') }}</Tag>
                <Tag v-if="row.assets.length" color="blue">
                  {{ t('projectFile.fileCount', { count: row.assets.length }) }}
                </Tag>
              </div>
              <p class="mt-1.5 text-xs text-slate-600 line-clamp-2 dark:text-slate-300">
                {{ row.changeSummary || t('projectKnowledge.prdNoChangeSummary') }}
              </p>
              <div class="mt-1 flex items-center gap-1 text-xs text-slate-400">
                <ClockCircleOutlined class="text-[11px]" />
                <span>{{ formatKnowledgeDate(row.updatedAt, locale) }}</span>
              </div>
            </div>

            <div class="version-ledger__actions shrink-0 pt-1 sm:pt-0">
              <Space :size="4">
                <Button type="link" size="small" @click="openViewVersion(row)">
                  <EyeOutlined />{{ t('projectKnowledge.prdVersionView') }}
                </Button>
                <Button
                  v-if="canManage && row.status !== 'PUBLISHED'"
                  type="link"
                  size="small"
                  @click="openEditVersion(row)"
                >
                  <EditOutlined />{{ t('common.edit') }}
                </Button>
                <Button
                  v-if="canManage && row.status !== 'PUBLISHED'"
                  type="link"
                  size="small"
                  danger
                  :loading="deletingId === row.id"
                  @click="handleDelete(row)"
                >
                  <DeleteOutlined />{{ t('common.delete') }}
                </Button>
              </Space>
            </div>
          </div>
        </Card>
      </div>
    </template>

    <KnowledgeFormDialog
      ref="formDialogRef"
      v-model:open="versionFormOpen"
      :title="versionFormTitle"
      :fields="versionFields"
      :model-value="versionFormModel"
      :submitting="submitting"
      :project-id="props.projectId"
      file-kind="PRD_VERSION"
      :file-assets="formAssets"
      @submit="handleSubmit"
    />
    <Modal
      v-model:open="viewOpen"
      :title="t('projectKnowledge.prdVersionLabel', { version: viewingVersion?.version ?? '-' })"
      width="760px"
    >
      <div class="space-y-3 pt-1">
        <div
          class="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-700 dark:bg-slate-900/60"
        >
          <pre
            class="prd-version-view m-0 max-h-96 overflow-y-auto whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-800 dark:text-slate-200"
            >{{ viewingVersion?.content || t('projectKnowledge.prdNoContent') }}</pre>
        </div>
        <div
          v-if="viewingVersion?.assets.length"
          class="prd-version-view__files flex flex-wrap gap-2 pt-1"
        >
          <Button
            v-for="asset in viewingVersion.assets"
            :key="asset.id"
            size="small"
            class="flex items-center gap-1 text-xs"
            @click="void handleDownload(asset)"
          >
            <DownloadOutlined />{{ asset.file.originalName }}
          </Button>
        </div>
        <div
          v-if="viewingVersion?.changeSummary"
          class="rounded-md bg-slate-100 p-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
        >
          <span class="font-semibold text-slate-700 dark:text-slate-200"
            >{{ t('projectKnowledge.prdChangeSummary') }}:
          </span>
          {{ viewingVersion.changeSummary }}
        </div>
      </div>
    </Modal>
  </Drawer>
</template>

<style scoped lang="scss">
.knowledge-state {
  padding: 48px 20px;
  color: #94a3b8;
  text-align: center;
}
</style>
