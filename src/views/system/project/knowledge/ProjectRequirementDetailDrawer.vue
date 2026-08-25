<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Drawer, Empty, Tag, Tabs, TabPane, message } from 'antdv-next'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@antdv-next/icons'

import {
  createProjectRequirementEvidence,
  createProjectRequirementTrace,
  deleteProjectRequirementEvidence,
  deleteProjectRequirementTrace,
  fetchProjectKnowledgeMaterials,
  fetchProjectRequirementEvidence,
  fetchProjectRequirementTraces,
  fetchProjectResearchRecords,
  updateProjectRequirementEvidence,
  updateProjectRequirementTrace,
} from '@/api/project-knowledge'
import type {
  ProjectKnowledgeMaterial,
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
    const [loadedEvidence, loadedTraces, loadedMaterials, loadedResearch] = await Promise.all([
      fetchProjectRequirementEvidence(props.projectId, requirementId),
      fetchProjectRequirementTraces(props.projectId, requirementId),
      fetchProjectKnowledgeMaterials(props.projectId),
      fetchProjectResearchRecords(props.projectId),
    ])
    evidence.value = loadedEvidence
    traces.value = loadedTraces
    materials.value = loadedMaterials
    researchRecords.value = loadedResearch
  } catch (error) {
    message.error(errorMessage(error, t('projectKnowledge.requestFailed')))
  } finally {
    loading.value = false
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
      <div class="requirement-detail__intro">
        <div class="requirement-detail__eyebrow">
          {{ requirement.code || t('projectKnowledge.requirementCodeUnset') }}
          <Tag>{{ t(`projectKnowledge.requirementType${requirement.type}`) }}</Tag>
          <Tag color="processing">{{
            t(`projectKnowledge.requirementStatus${requirement.status}`)
          }}</Tag>
        </div>
        <p>{{ requirement.description || t('projectKnowledge.noDescription') }}</p>
        <div v-if="requirement.acceptanceCriteria" class="requirement-detail__acceptance">
          <span>{{ t('projectKnowledge.requirementAcceptanceCriteria') }}</span>
          <pre>{{ requirement.acceptanceCriteria }}</pre>
        </div>
      </div>

      <div v-if="loading" class="knowledge-state">{{ t('common.loading') }}</div>
      <Tabs v-else v-model:active-key="activeTab">
        <TabPane key="evidence" :tab="t('projectKnowledge.evidenceTitle')">
          <div class="knowledge-subsection__header">
            <p>{{ t('projectKnowledge.evidenceDescription') }}</p>
            <Button v-if="canManage" type="primary" size="small" @click="openCreateEvidence">
              <PlusOutlined />{{ t('projectKnowledge.evidenceCreate') }}
            </Button>
          </div>
          <Empty v-if="!evidence.length" :description="t('projectKnowledge.evidenceEmpty')" />
          <div v-else class="detail-ledger">
            <article v-for="row in evidence" :key="row.id" class="detail-ledger__row">
              <div>
                <div class="detail-ledger__meta">
                  <Tag color="blue">
                    {{
                      row.materialId
                        ? t('projectKnowledge.evidenceMaterial')
                        : t('projectKnowledge.evidenceResearch')
                    }}
                  </Tag>
                  <span>{{ evidenceSourceLabel(row) }}</span>
                </div>
                <p>
                  {{
                    row.quote || row.content || row.locator || t('projectKnowledge.noDescription')
                  }}
                </p>
                <small>{{ formatKnowledgeDate(row.updatedAt, locale) }}</small>
              </div>
              <div v-if="canManage" class="detail-ledger__actions">
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
              </div>
            </article>
          </div>
        </TabPane>
        <TabPane key="traces" :tab="t('projectKnowledge.tracesTitle')">
          <div class="knowledge-subsection__header">
            <p>{{ t('projectKnowledge.tracesDescription') }}</p>
            <Button v-if="canManage" type="primary" size="small" @click="openCreateTrace">
              <PlusOutlined />{{ t('projectKnowledge.traceCreate') }}
            </Button>
          </div>
          <Empty v-if="!traces.length" :description="t('projectKnowledge.traceEmpty')" />
          <div v-else class="detail-ledger">
            <article v-for="row in traces" :key="row.id" class="detail-ledger__row">
              <div>
                <div class="detail-ledger__meta">
                  <Tag color="cyan">{{
                    t(`projectKnowledge.traceRelation${row.relationType}`)
                  }}</Tag>
                  <span>{{ t(`projectKnowledge.traceTarget${row.targetType}`) }}</span>
                </div>
                <h3>{{ row.targetName || row.targetKey }}</h3>
                <p>{{ row.targetUrl || t('projectKnowledge.noDescription') }}</p>
              </div>
              <div v-if="canManage" class="detail-ledger__actions">
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
              </div>
            </article>
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
.requirement-detail__intro {
  padding-bottom: 20px;
  border-bottom: 1px solid #e2e8f0;
}

.requirement-detail__eyebrow {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.requirement-detail__intro p {
  margin: 12px 0 0;
  color: #475569;
  font-size: 14px;
  line-height: 1.65;
  white-space: pre-wrap;
}

.requirement-detail__acceptance {
  margin-top: 16px;
  padding: 12px 14px;
  border-left: 3px solid #0f766e;
  background: #f0fdfa;
}

.requirement-detail__acceptance span {
  color: #0f766e;
  font-size: 12px;
  font-weight: 700;
}

.requirement-detail__acceptance pre {
  margin: 8px 0 0;
  color: #334155;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.knowledge-state {
  padding: 48px 20px;
  color: #94a3b8;
  text-align: center;
}

.knowledge-subsection__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin: 8px 0 16px;
}

.knowledge-subsection__header p {
  margin: 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.55;
}

.detail-ledger {
  border-top: 1px solid #e2e8f0;
}

.detail-ledger__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  padding: 16px 0;
  border-bottom: 1px solid #e2e8f0;
}

.detail-ledger__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #475569;
  font-size: 13px;
}

.detail-ledger__row h3 {
  margin: 7px 0 0;
  color: #1e293b;
  font-size: 14px;
  font-weight: 650;
}

.detail-ledger__row p {
  margin: 7px 0 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.detail-ledger__row small {
  display: block;
  margin-top: 8px;
  color: #94a3b8;
  font-size: 11px;
}

.detail-ledger__actions {
  display: flex;
  gap: 2px;
  white-space: nowrap;
}

@media (max-width: 560px) {
  .knowledge-subsection__header,
  .detail-ledger__row {
    display: flex;
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
