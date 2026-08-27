<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Card, Drawer, Empty, Select, Space, Tag, Tabs, TabPane, message } from 'antdv-next'
import {
  CheckSquareOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  LinkOutlined,
  PlusOutlined,
} from '@antdv-next/icons'

import {
  createProjectRequirementEvidence,
  createProjectRequirementTrace,
  deleteProjectRequirementEvidence,
  deleteProjectRequirementTrace,
  fetchProjectKnowledgeMaterials,
  fetchProjectPrdDocuments,
  fetchProjectRequirementEvidence,
  fetchProjectRequirementTraces,
  fetchProjectResearchRecords,
  updateProjectRequirement,
  updateProjectRequirementEvidence,
  updateProjectRequirementTrace,
} from '@/api/project-knowledge'
import type {
  ProjectKnowledgeMaterial,
  ProjectPrdDocument,
  ProjectRequirement,
  ProjectRequirementEvidence,
  ProjectRequirementEvidencePayload,
  ProjectRequirementTrace,
  ProjectRequirementTracePayload,
  ProjectResearchRecord,
  RequirementTraceRelation,
  RequirementTraceTarget,
  UpdateProjectRequirementEvidencePayload,
  UpdateProjectRequirementTracePayload,
} from '@/types/project-knowledge'
import KnowledgeFormDialog, { type KnowledgeFormField } from './KnowledgeFormDialog.vue'
import { confirmKnowledgeDelete, errorMessage, formatKnowledgeDate } from './knowledge-utils'

interface Props {
  open: boolean
  projectId: string
  requirement: ProjectRequirement | null
  canManage: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  changed: []
}>()
const { locale, t } = useI18n()

const activeTab = ref('evidence')
const loading = ref(false)
const evidence = ref<ProjectRequirementEvidence[]>([])
const traces = ref<ProjectRequirementTrace[]>([])
const materials = ref<ProjectKnowledgeMaterial[]>([])
const researchRecords = ref<ProjectResearchRecord[]>([])
const prdDocuments = ref<ProjectPrdDocument[]>([])
const documentSaving = ref(false)
const deletingId = ref<string | null>(null)
const evidenceFormOpen = ref(false)
const evidenceFormMode = ref<'create' | 'edit'>('create')
const editingEvidence = ref<ProjectRequirementEvidence | null>(null)
const evidenceFormModel = ref<Record<string, string>>({})
const traceFormOpen = ref(false)
const traceFormMode = ref<'create' | 'edit'>('create')
const editingTrace = ref<ProjectRequirementTrace | null>(null)
const traceFormModel = ref<Record<string, string>>({})
const submitting = ref(false)

const visible = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
})

const materialOptions = computed(() =>
  materials.value.map((row) => ({ label: row.title, value: row.id })),
)

const researchOptions = computed(() =>
  researchRecords.value.map((row) => ({ label: row.title, value: row.id })),
)

const documentOptions = computed(() =>
  prdDocuments.value.map((row) => ({
    label: `${row.title}（${t(`projectKnowledge.prdType${row.type}`)}）`,
    value: row.id,
  })),
)

const requirementDocumentLabel = computed(() => {
  const documentId = props.requirement?.documentId
  if (!documentId) return null
  return prdDocuments.value.find((document) => document.id === documentId)?.title ?? documentId
})

const traceTargetOptions = computed(() =>
  (['TASK', 'API', 'TEST_CASE', 'PRD', 'DELIVERABLE', 'OTHER'] as const).map((value) => ({
    label: t(`projectKnowledge.traceTarget${value}`),
    value,
  })),
)

const traceRelationOptions = computed(() =>
  (['IMPLEMENTS', 'VERIFIES', 'DOCUMENTS', 'DEPENDS_ON'] as const).map((value) => ({
    label: t(`projectKnowledge.traceRelation${value}`),
    value,
  })),
)

const evidenceFields = computed<KnowledgeFormField[]>(() => [
  {
    key: 'materialId',
    label: t('projectKnowledge.evidenceMaterial'),
    placeholder: t('projectKnowledge.evidenceMaterialPlaceholder'),
    type: 'select',
    options: materialOptions.value,
  },
  {
    key: 'researchRecordId',
    label: t('projectKnowledge.evidenceResearch'),
    placeholder: t('projectKnowledge.evidenceResearchPlaceholder'),
    type: 'select',
    options: researchOptions.value,
  },
  {
    key: 'quote',
    label: t('projectKnowledge.evidenceQuote'),
    placeholder: t('projectKnowledge.evidenceQuotePlaceholder'),
    type: 'textarea',
    rows: 4,
  },
  {
    key: 'content',
    label: t('projectKnowledge.evidenceContent'),
    placeholder: t('projectKnowledge.evidenceContentPlaceholder'),
    type: 'textarea',
    rows: 4,
  },
  {
    key: 'locator',
    label: t('projectKnowledge.evidenceLocator'),
    placeholder: t('projectKnowledge.evidenceLocatorPlaceholder'),
  },
])

const traceFields = computed<KnowledgeFormField[]>(() => [
  {
    key: 'targetType',
    label: t('projectKnowledge.traceTargetType'),
    placeholder: t('projectKnowledge.traceTargetTypePlaceholder'),
    type: 'select',
    options: traceTargetOptions.value,
    required: true,
  },
  {
    key: 'targetKey',
    label: t('projectKnowledge.traceTargetKey'),
    placeholder: t('projectKnowledge.traceTargetKeyPlaceholder'),
    required: true,
  },
  {
    key: 'targetName',
    label: t('projectKnowledge.traceTargetName'),
    placeholder: t('projectKnowledge.traceTargetNamePlaceholder'),
    required: true,
  },
  {
    key: 'relationType',
    label: t('projectKnowledge.traceRelationType'),
    placeholder: t('projectKnowledge.traceRelationTypePlaceholder'),
    type: 'select',
    options: traceRelationOptions.value,
    required: true,
  },
  {
    key: 'targetUrl',
    label: t('projectKnowledge.traceTargetUrl'),
    placeholder: t('projectKnowledge.traceTargetUrlPlaceholder'),
  },
])

const evidenceFormTitle = computed(() =>
  evidenceFormMode.value === 'create'
    ? t('projectKnowledge.evidenceCreateTitle')
    : t('projectKnowledge.evidenceEditTitle'),
)

const traceFormTitle = computed(() =>
  traceFormMode.value === 'create'
    ? t('projectKnowledge.traceCreateTitle')
    : t('projectKnowledge.traceEditTitle'),
)

function optionalValue(value: string): string | null {
  const normalized = value.trim()
  return normalized || null
}

function resetEvidenceForm(): void {
  evidenceFormModel.value = {
    materialId: '',
    researchRecordId: '',
    quote: '',
    content: '',
    locator: '',
  }
}

function fillEvidenceForm(row: ProjectRequirementEvidence): void {
  evidenceFormModel.value = {
    materialId: row.materialId ?? '',
    researchRecordId: row.researchRecordId ?? '',
    quote: row.quote ?? '',
    content: row.content ?? '',
    locator: row.locator ?? '',
  }
}

function resetTraceForm(): void {
  traceFormModel.value = {
    targetType: 'TASK',
    targetKey: '',
    targetName: '',
    targetUrl: '',
    relationType: 'IMPLEMENTS',
  }
}

function fillTraceForm(row: ProjectRequirementTrace): void {
  traceFormModel.value = {
    targetType: row.targetType,
    targetKey: row.targetKey,
    targetName: row.targetName,
    targetUrl: row.targetUrl ?? '',
    relationType: row.relationType,
  }
}

async function load(): Promise<void> {
  const requirementId = props.requirement?.id
  if (!props.open || !props.projectId || !requirementId) return
  loading.value = true
  try {
    const [loadedEvidence, loadedTraces, loadedMaterials, loadedResearch, loadedDocuments] =
      await Promise.all([
        fetchProjectRequirementEvidence(props.projectId, requirementId),
        fetchProjectRequirementTraces(props.projectId, requirementId),
        fetchProjectKnowledgeMaterials(props.projectId),
        fetchProjectResearchRecords(props.projectId),
        fetchProjectPrdDocuments(props.projectId),
      ])
    evidence.value = loadedEvidence
    traces.value = loadedTraces
    materials.value = loadedMaterials
    researchRecords.value = loadedResearch
    prdDocuments.value = loadedDocuments
  } catch (error) {
    message.error(errorMessage(error, t('projectKnowledge.requestFailed')))
  } finally {
    loading.value = false
  }
}

async function handleDocumentChange(value: string | undefined): Promise<void> {
  const requirementId = props.requirement?.id
  if (!props.canManage || !requirementId) return
  documentSaving.value = true
  try {
    await updateProjectRequirement(props.projectId, requirementId, {
      documentId: value ?? null,
    })
    message.success(t('projectKnowledge.updateSuccess'))
    emit('changed')
  } catch (error) {
    message.error(errorMessage(error, t('projectKnowledge.requestFailed')))
  } finally {
    documentSaving.value = false
  }
}

function openCreateEvidence(): void {
  if (!props.canManage) return
  evidenceFormMode.value = 'create'
  editingEvidence.value = null
  resetEvidenceForm()
  evidenceFormOpen.value = true
}

function openEditEvidence(row: ProjectRequirementEvidence): void {
  if (!props.canManage) return
  evidenceFormMode.value = 'edit'
  editingEvidence.value = row
  fillEvidenceForm(row)
  evidenceFormOpen.value = true
}

function openCreateTrace(): void {
  if (!props.canManage) return
  traceFormMode.value = 'create'
  editingTrace.value = null
  resetTraceForm()
  traceFormOpen.value = true
}

function openEditTrace(row: ProjectRequirementTrace): void {
  if (!props.canManage) return
  traceFormMode.value = 'edit'
  editingTrace.value = row
  fillTraceForm(row)
  traceFormOpen.value = true
}

function buildEvidencePayload(values: Record<string, string>): ProjectRequirementEvidencePayload {
  return {
    materialId: optionalValue(values.materialId ?? ''),
    researchRecordId: optionalValue(values.researchRecordId ?? ''),
    quote: optionalValue(values.quote ?? ''),
    content: optionalValue(values.content ?? ''),
    locator: optionalValue(values.locator ?? ''),
    origin: 'MANUAL',
  }
}

function buildTracePayload(values: Record<string, string>): ProjectRequirementTracePayload {
  return {
    targetType: (values.targetType || 'TASK') as RequirementTraceTarget,
    targetKey: values.targetKey?.trim() ?? '',
    targetName: values.targetName?.trim() ?? '',
    targetUrl: optionalValue(values.targetUrl ?? ''),
    relationType: (values.relationType || 'IMPLEMENTS') as RequirementTraceRelation,
    origin: 'MANUAL',
  }
}

async function handleEvidenceSubmit(values: Record<string, string>): Promise<void> {
  const requirementId = props.requirement?.id
  if (!requirementId) return
  const payload = buildEvidencePayload(values)
  if (!payload.materialId && !payload.researchRecordId) {
    message.warning(t('projectKnowledge.evidenceSourceRequired'))
    return
  }
  if (!payload.quote && !payload.content) {
    message.warning(t('projectKnowledge.evidenceBodyRequired'))
    return
  }
  submitting.value = true
  try {
    if (evidenceFormMode.value === 'create') {
      await createProjectRequirementEvidence(props.projectId, requirementId, payload)
      message.success(t('projectKnowledge.createSuccess'))
    } else if (editingEvidence.value) {
      const updatePayload: UpdateProjectRequirementEvidencePayload = payload
      await updateProjectRequirementEvidence(
        props.projectId,
        requirementId,
        editingEvidence.value.id,
        updatePayload,
      )
      message.success(t('projectKnowledge.updateSuccess'))
    }
    evidenceFormOpen.value = false
    await load()
    emit('changed')
  } catch (error) {
    message.error(errorMessage(error, t('projectKnowledge.requestFailed')))
  } finally {
    submitting.value = false
  }
}

async function handleTraceSubmit(values: Record<string, string>): Promise<void> {
  const requirementId = props.requirement?.id
  if (!requirementId) return
  const payload = buildTracePayload(values)
  if (!payload.targetKey) {
    message.warning(t('projectKnowledge.traceTargetKeyRequired'))
    return
  }
  if (!payload.targetName) {
    message.warning(t('projectKnowledge.traceTargetNameRequired'))
    return
  }
  submitting.value = true
  try {
    if (traceFormMode.value === 'create') {
      await createProjectRequirementTrace(props.projectId, requirementId, payload)
      message.success(t('projectKnowledge.createSuccess'))
    } else if (editingTrace.value) {
      const updatePayload: UpdateProjectRequirementTracePayload = payload
      await updateProjectRequirementTrace(
        props.projectId,
        requirementId,
        editingTrace.value.id,
        updatePayload,
      )
      message.success(t('projectKnowledge.updateSuccess'))
    }
    traceFormOpen.value = false
    await load()
    emit('changed')
  } catch (error) {
    message.error(errorMessage(error, t('projectKnowledge.requestFailed')))
  } finally {
    submitting.value = false
  }
}

function evidenceSourceLabel(row: ProjectRequirementEvidence): string {
  if (row.materialId) {
    return materials.value.find((source) => source.id === row.materialId)?.title ?? row.materialId
  }
  if (row.researchRecordId) {
    return (
      researchRecords.value.find((source) => source.id === row.researchRecordId)?.title ??
      row.researchRecordId
    )
  }
  return t('projectKnowledge.evidenceSourceUnset')
}

async function handleDeleteEvidence(row: ProjectRequirementEvidence): Promise<void> {
  const requirementId = props.requirement?.id
  if (!props.canManage || !requirementId || deletingId.value) return
  const confirmed = await confirmKnowledgeDelete(
    t('common.tip'),
    t('projectKnowledge.evidenceDeleteConfirm', { source: evidenceSourceLabel(row) }),
    t('common.confirm'),
    t('common.cancel'),
  )
  if (!confirmed) return
  deletingId.value = row.id
  try {
    await deleteProjectRequirementEvidence(props.projectId, requirementId, row.id)
    message.success(t('projectKnowledge.deleteSuccess'))
    await load()
    emit('changed')
  } catch (error) {
    message.error(errorMessage(error, t('projectKnowledge.requestFailed')))
  } finally {
    deletingId.value = null
  }
}

async function handleDeleteTrace(row: ProjectRequirementTrace): Promise<void> {
  const requirementId = props.requirement?.id
  if (!props.canManage || !requirementId || deletingId.value) return
  const confirmed = await confirmKnowledgeDelete(
    t('common.tip'),
    t('projectKnowledge.traceDeleteConfirm', { target: row.targetName || row.targetKey }),
    t('common.confirm'),
    t('common.cancel'),
  )
  if (!confirmed) return
  deletingId.value = row.id
  try {
    await deleteProjectRequirementTrace(props.projectId, requirementId, row.id)
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
  () => [props.open, props.projectId, props.requirement?.id] as const,
  () => void load(),
  { immediate: true },
)
</script>

<template>
  <Drawer
    v-model:open="visible"
    :title="requirement?.title ?? t('projectKnowledge.requirementDetail')"
    :size="760"
    destroy-on-hidden
  >
    <template v-if="requirement">
      <div class="requirement-detail__intro mb-4">
        <div class="requirement-detail__eyebrow flex flex-wrap items-center gap-2">
          <Tag v-if="requirement.code" color="blue" class="font-mono font-semibold">
            {{ requirement.code }}
          </Tag>
          <span v-else class="text-xs text-slate-400">{{
            t('projectKnowledge.requirementCodeUnset')
          }}</span>
          <Tag>{{ t(`projectKnowledge.requirementType${requirement.type}`) }}</Tag>
          <Tag color="processing">{{
            t(`projectKnowledge.requirementStatus${requirement.status}`)
          }}</Tag>
          <span v-if="requirement.priority" class="text-xs text-slate-400"
            >P: {{ requirement.priority }}</span
          >
        </div>

        <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {{ requirement.description || t('projectKnowledge.noDescription') }}
        </p>

        <div class="requirement-detail__document mt-3 flex items-center gap-2 text-xs">
          <span class="requirement-detail__document-label text-slate-500"
            >{{ t('projectKnowledge.requirementDocument') }}:</span
          >
          <Select
            v-if="canManage"
            :value="requirement.documentId ?? undefined"
            :placeholder="t('projectKnowledge.requirementDocumentPlaceholder')"
            :options="documentOptions"
            :loading="documentSaving"
            allow-clear
            class="requirement-detail__document-select min-w-56"
            @change="handleDocumentChange"
          />
          <Tag v-else-if="requirementDocumentLabel" color="blue">
            {{ requirementDocumentLabel }}
          </Tag>
          <span v-else class="requirement-detail__document-unset text-slate-400">{{
            t('projectKnowledge.requirementDocumentUnset')
          }}</span>
        </div>

        <div
          v-if="requirement.acceptanceCriteria"
          class="requirement-detail__acceptance mt-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/60"
        >
          <div
            class="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            <CheckSquareOutlined class="text-teal-600 dark:text-teal-400" />
            <span>{{ t('projectKnowledge.requirementAcceptanceCriteria') }}</span>
          </div>
          <pre
            class="m-0 mt-1.5 whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-600 dark:text-slate-300"
            >{{ requirement.acceptanceCriteria }}</pre>
        </div>
      </div>

      <div v-if="loading" class="knowledge-state">{{ t('common.loading') }}</div>
      <Tabs v-else v-model:active-key="activeTab" class="requirement-detail__tabs">
        <TabPane key="evidence" :tab="t('projectKnowledge.evidenceTitle')">
          <div class="knowledge-subsection__header flex items-center justify-between mb-3">
            <p class="m-0 text-xs text-slate-500 dark:text-slate-400">
              {{ t('projectKnowledge.evidenceDescription') }}
            </p>
            <Button v-if="canManage" type="primary" size="small" @click="openCreateEvidence">
              <PlusOutlined />{{ t('projectKnowledge.evidenceCreate') }}
            </Button>
          </div>
          <Empty v-if="!evidence.length" :description="t('projectKnowledge.evidenceEmpty')" />
          <div v-else class="detail-ledger space-y-3">
            <Card
              v-for="row in evidence"
              :key="row.id"
              size="small"
              class="detail-ledger__row transition-all hover:border-teal-500/40 hover:shadow-xs"
            >
              <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div class="min-w-0 flex-1">
                  <div class="detail-ledger__meta flex flex-wrap items-center gap-2">
                    <Tag color="blue" class="text-xs">
                      {{
                        row.materialId
                          ? t('projectKnowledge.evidenceMaterial')
                          : t('projectKnowledge.evidenceResearch')
                      }}
                    </Tag>
                    <span class="text-xs font-medium text-slate-700 dark:text-slate-200">{{
                      evidenceSourceLabel(row)
                    }}</span>
                    <Tag v-if="row.locator" color="default" class="text-[11px]">
                      {{ row.locator }}
                    </Tag>
                  </div>
                  <p class="mt-1.5 text-xs text-slate-600 dark:text-slate-300">
                    {{
                      row.quote || row.content || row.locator || t('projectKnowledge.noDescription')
                    }}
                  </p>
                  <div class="mt-1 flex items-center gap-1 text-xs text-slate-400">
                    <ClockCircleOutlined class="text-[11px]" />
                    <span>{{ formatKnowledgeDate(row.updatedAt, locale) }}</span>
                  </div>
                </div>

                <div v-if="canManage" class="detail-ledger__actions shrink-0 pt-1 sm:pt-0">
                  <Space :size="4">
                    <Button type="link" size="small" @click="openEditEvidence(row)">
                      <EditOutlined />{{ t('common.edit') }}
                    </Button>
                    <Button
                      type="link"
                      danger
                      size="small"
                      :loading="deletingId === row.id"
                      @click="handleDeleteEvidence(row)"
                    >
                      <DeleteOutlined />{{ t('common.delete') }}
                    </Button>
                  </Space>
                </div>
              </div>
            </Card>
          </div>
        </TabPane>

        <TabPane key="traces" :tab="t('projectKnowledge.tracesTitle')">
          <div class="knowledge-subsection__header flex items-center justify-between mb-3">
            <p class="m-0 text-xs text-slate-500 dark:text-slate-400">
              {{ t('projectKnowledge.tracesDescription') }}
            </p>
            <Button v-if="canManage" type="primary" size="small" @click="openCreateTrace">
              <PlusOutlined />{{ t('projectKnowledge.traceCreate') }}
            </Button>
          </div>
          <Empty v-if="!traces.length" :description="t('projectKnowledge.traceEmpty')" />
          <div v-else class="detail-ledger space-y-3">
            <Card
              v-for="row in traces"
              :key="row.id"
              size="small"
              class="detail-ledger__row transition-all hover:border-teal-500/40 hover:shadow-xs"
            >
              <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div class="min-w-0 flex-1">
                  <div class="detail-ledger__meta flex flex-wrap items-center gap-2">
                    <Tag color="cyan" class="text-xs">
                      {{ t(`projectKnowledge.traceRelation${row.relationType}`) }}
                    </Tag>
                    <Tag color="purple" class="text-xs">
                      {{ t(`projectKnowledge.traceTarget${row.targetType}`) }}
                    </Tag>
                  </div>
                  <h3 class="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {{ row.targetName || row.targetKey }}
                  </h3>
                  <div
                    v-if="row.targetUrl"
                    class="mt-1 flex items-center gap-1 text-xs text-teal-600 dark:text-teal-400"
                  >
                    <LinkOutlined />
                    <a
                      :href="row.targetUrl"
                      target="_blank"
                      rel="noreferrer"
                      class="truncate hover:underline"
                    >
                      {{ row.targetUrl }}
                    </a>
                  </div>
                  <div class="mt-1 flex items-center gap-1 text-xs text-slate-400">
                    <ClockCircleOutlined class="text-[11px]" />
                    <span>{{ formatKnowledgeDate(row.updatedAt, locale) }}</span>
                  </div>
                </div>

                <div v-if="canManage" class="detail-ledger__actions shrink-0 pt-1 sm:pt-0">
                  <Space :size="4">
                    <Button type="link" size="small" @click="openEditTrace(row)">
                      <EditOutlined />{{ t('common.edit') }}
                    </Button>
                    <Button
                      type="link"
                      danger
                      size="small"
                      :loading="deletingId === row.id"
                      @click="handleDeleteTrace(row)"
                    >
                      <DeleteOutlined />{{ t('common.delete') }}
                    </Button>
                  </Space>
                </div>
              </div>
            </Card>
          </div>
        </TabPane>
      </Tabs>
    </template>

    <KnowledgeFormDialog
      v-model:open="evidenceFormOpen"
      :title="evidenceFormTitle"
      :fields="evidenceFields"
      :model-value="evidenceFormModel"
      :submitting="submitting"
      @submit="handleEvidenceSubmit"
    />
    <KnowledgeFormDialog
      v-model:open="traceFormOpen"
      :title="traceFormTitle"
      :fields="traceFields"
      :model-value="traceFormModel"
      :submitting="submitting"
      @submit="handleTraceSubmit"
    />
  </Drawer>
</template>

<style scoped lang="scss">
.knowledge-state {
  padding: 48px 20px;
  color: #94a3b8;
  text-align: center;
}
</style>
