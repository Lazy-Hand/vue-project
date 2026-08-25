<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Drawer, Empty, Modal, Tag, message } from 'antdv-next'
import {
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
      <div class="prd-detail__intro">
        <div class="prd-detail__meta">
          <Tag>{{ t(`projectKnowledge.prdType${document.type}`) }}</Tag>
          <Tag color="processing">{{ t(`projectKnowledge.prdStatus${document.status}`) }}</Tag>
        </div>
      </div>

      <div class="prd-detail__covered">
        <div class="prd-detail__covered-header">
          <span>{{ t('projectKnowledge.documentCoveredRequirements') }}</span>
          <Tag v-if="coveredRequirements.length" color="blue">
            {{ coveredRequirements.length }}
          </Tag>
        </div>
        <Empty
          v-if="!coveredRequirements.length"
          :description="t('projectKnowledge.documentCoveredRequirementsEmpty')"
          :image="Empty.PRESENTED_IMAGE_SIMPLE"
        />
        <div v-else class="covered-requirement-list">
          <div v-for="row in coveredRequirements" :key="row.id" class="covered-requirement-row">
            <span class="covered-requirement-row__code">{{ row.code }}</span>
            <span class="covered-requirement-row__title">{{ row.title }}</span>
            <Tag>{{ t(`projectKnowledge.requirementStatus${row.status}`) }}</Tag>
          </div>
        </div>
      </div>

      <div class="prd-detail__versions-header">
        <div>
          <div class="prd-detail__kicker">{{ t('projectKnowledge.prdVersionsKicker') }}</div>
          <h2>{{ t('projectKnowledge.prdVersionsTitle') }}</h2>
        </div>
        <Button v-if="canManage" type="primary" size="small" @click="openCreateVersion">
          <PlusOutlined />{{ t('projectKnowledge.prdVersionCreate') }}
        </Button>
      </div>

      <div v-if="loading" class="knowledge-state">{{ t('common.loading') }}</div>
      <Empty v-else-if="!versions.length" :description="t('projectKnowledge.prdVersionEmpty')" />
      <div v-else class="version-ledger">
        <article v-for="row in versions" :key="row.id" class="version-ledger__row">
          <div>
            <div class="version-ledger__meta">
              <strong>{{ t('projectKnowledge.prdVersionLabel', { version: row.version }) }}</strong>
              <Tag v-if="row.status === 'PUBLISHED'" color="success">{{
                t('projectKnowledge.prdPublished')
              }}</Tag>
              <Tag v-else>{{ t('projectKnowledge.prdUnpublished') }}</Tag>
              <Tag v-if="row.assets.length" color="blue">
                {{ t('projectFile.fileCount', { count: row.assets.length }) }}
              </Tag>
            </div>
            <p>{{ row.changeSummary || t('projectKnowledge.prdNoChangeSummary') }}</p>
            <small>{{ formatKnowledgeDate(row.updatedAt, locale) }}</small>
          </div>
          <div class="version-ledger__actions">
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
          </div>
        </article>
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
      <pre class="prd-version-view">{{
        viewingVersion?.content || t('projectKnowledge.prdNoContent')
      }}</pre>
      <div v-if="viewingVersion?.assets.length" class="prd-version-view__files">
        <Button
          v-for="asset in viewingVersion.assets"
          :key="asset.id"
          size="small"
          @click="void handleDownload(asset)"
        >
          <DownloadOutlined />{{ asset.file.originalName }}
        </Button>
      </div>
      <div class="prd-version-view__note">
        {{ viewingVersion?.changeSummary || t('projectKnowledge.prdNoChangeSummary') }}
      </div>
    </Modal>
  </Drawer>
</template>

<style scoped lang="scss">
.prd-detail__intro {
  padding-bottom: 22px;
  border-bottom: 1px solid #e2e8f0;
}

.prd-detail__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.prd-detail__covered {
  margin: 16px 0;
  padding: 12px 14px;
  background: #f8fafc;
  border-radius: 8px;
}

.prd-detail__covered-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  color: #334155;
  font-size: 13px;
  font-weight: 650;
}

.covered-requirement-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.covered-requirement-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.covered-requirement-row__code {
  color: #64748b;
  font-family: ui-monospace, monospace;
  font-size: 12px;
}

.covered-requirement-row__title {
  flex: 1;
  overflow: hidden;
  color: #1e293b;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.prd-detail__intro p {
  margin: 12px 0 0;
  color: #475569;
  font-size: 14px;
  line-height: 1.6;
}

.prd-detail__intro pre {
  max-height: 220px;
  margin: 16px 0 0;
  overflow: auto;
  color: #334155;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.65;
  white-space: pre-wrap;
}

.prd-detail__versions-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  padding: 24px 0 16px;
}

.prd-detail__kicker {
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.prd-detail__versions-header h2 {
  margin: 4px 0 0;
  color: #0f172a;
  font-size: 20px;
  font-weight: 650;
}

.knowledge-state {
  padding: 48px 20px;
  color: #94a3b8;
  text-align: center;
}

.version-ledger {
  border-top: 1px solid #e2e8f0;
}

.version-ledger__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  padding: 16px 0;
  border-bottom: 1px solid #e2e8f0;
}

.version-ledger__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  color: #1e293b;
}

.version-ledger__row p {
  margin: 7px 0 0;
  color: #64748b;
  font-size: 13px;
}

.version-ledger__row small {
  display: block;
  margin-top: 8px;
  color: #94a3b8;
  font-size: 11px;
}

.version-ledger__actions {
  display: flex;
  gap: 2px;
  white-space: nowrap;
}

.prd-version-view {
  max-height: 60vh;
  margin: 0;
  overflow: auto;
  color: #334155;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
}

.prd-version-view__note {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #e2e8f0;
  color: #64748b;
  font-size: 12px;
}

.prd-version-view__files {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

@media (max-width: 560px) {
  .prd-detail__versions-header,
  .version-ledger__row {
    align-items: flex-start;
    flex-direction: column;
  }

  .version-ledger__row {
    display: flex;
  }
}
</style>
