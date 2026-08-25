<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Empty, Tag, message } from 'antdv-next'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@antdv-next/icons'

import {
  createProjectRequirement,
  deleteProjectRequirement,
  fetchProjectRequirements,
  updateProjectRequirement,
} from '@/api/project-knowledge'
import type {
  ProjectRequirement,
  ProjectRequirementPayload,
  RequirementStatus,
  RequirementType,
  UpdateProjectRequirementPayload,
} from '@/types/project-knowledge'
import KnowledgeFormDialog, { type KnowledgeFormField } from './KnowledgeFormDialog.vue'
import ProjectRequirementDetailDrawer from './ProjectRequirementDetailDrawer.vue'
import { confirmKnowledgeDelete, errorMessage, formatKnowledgeDate } from './knowledge-utils'

interface Props {
  projectId: string
  canManage: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{ changed: [] }>()
const { locale, t } = useI18n()

const rows = ref<ProjectRequirement[]>([])
const loading = ref(false)
const submitting = ref(false)
const deletingId = ref<string | null>(null)
const formOpen = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editing = ref<ProjectRequirement | null>(null)
const formModel = ref<Record<string, string>>({})
const detailOpen = ref(false)
const detailRequirement = ref<ProjectRequirement | null>(null)

const typeOptions = computed(() =>
  (['BUSINESS', 'FUNCTIONAL', 'NON_FUNCTIONAL', 'CONSTRAINT'] as const).map((value) => ({
    label: t(`projectKnowledge.requirementType${value}`),
    value,
  })),
)

const statusOptions = computed(() =>
  (['DRAFT', 'CONFIRMED', 'CHANGED', 'REJECTED'] as const).map((value) => ({
    label: t(`projectKnowledge.requirementStatus${value}`),
    value,
  })),
)

const fields = computed<KnowledgeFormField[]>(() => [
  {
    key: 'code',
    label: t('projectKnowledge.requirementCode'),
    placeholder: t('projectKnowledge.requirementCodePlaceholder'),
    required: true,
  },
  {
    key: 'title',
    label: t('projectKnowledge.requirementTitle'),
    placeholder: t('projectKnowledge.requirementTitlePlaceholder'),
    required: true,
  },
  {
    key: 'type',
    label: t('projectKnowledge.requirementType'),
    placeholder: t('projectKnowledge.requirementTypePlaceholder'),
    type: 'select',
    options: typeOptions.value,
    required: true,
  },
  {
    key: 'status',
    label: t('projectKnowledge.requirementStatus'),
    placeholder: t('projectKnowledge.requirementStatusPlaceholder'),
    type: 'select',
    options: statusOptions.value,
    required: true,
  },
  {
    key: 'priority',
    label: t('projectKnowledge.requirementPriority'),
    placeholder: t('projectKnowledge.requirementPriorityPlaceholder'),
    required: true,
  },
  {
    key: 'description',
    label: t('projectKnowledge.requirementDescription'),
    placeholder: t('projectKnowledge.requirementDescriptionPlaceholder'),
    type: 'textarea',
    rows: 4,
  },
  {
    key: 'content',
    label: t('projectKnowledge.requirementContent'),
    placeholder: t('projectKnowledge.requirementContentPlaceholder'),
    type: 'textarea',
    rows: 5,
  },
  {
    key: 'acceptanceCriteria',
    label: t('projectKnowledge.requirementAcceptanceCriteria'),
    placeholder: t('projectKnowledge.requirementAcceptanceCriteriaPlaceholder'),
    type: 'textarea',
    rows: 4,
  },
])

const formTitle = computed(() =>
  formMode.value === 'create'
    ? t('projectKnowledge.requirementCreateTitle')
    : t('projectKnowledge.requirementEditTitle'),
)

function resetForm(): void {
  formModel.value = {
    code: '',
    title: '',
    type: 'FUNCTIONAL',
    status: 'DRAFT',
    priority: '',
    description: '',
    content: '',
    acceptanceCriteria: '',
  }
}

function fillForm(row: ProjectRequirement): void {
  formModel.value = {
    code: row.code,
    title: row.title,
    type: row.type,
    status: row.status,
    priority: row.priority ?? '',
    description: row.description ?? '',
    content: row.content ?? '',
    acceptanceCriteria: row.acceptanceCriteria ?? '',
  }
}

async function load(): Promise<void> {
  if (!props.projectId) return
  loading.value = true
  try {
    rows.value = await fetchProjectRequirements(props.projectId)
  } catch (error) {
    message.error(errorMessage(error, t('projectKnowledge.requestFailed')))
  } finally {
    loading.value = false
  }
}

function openCreate(): void {
  if (!props.canManage) return
  formMode.value = 'create'
  editing.value = null
  resetForm()
  formOpen.value = true
}

function openEdit(row: ProjectRequirement): void {
  if (!props.canManage) return
  formMode.value = 'edit'
  editing.value = row
  fillForm(row)
  formOpen.value = true
}

function openDetail(row: ProjectRequirement): void {
  detailRequirement.value = row
  detailOpen.value = true
}

function optionalValue(value: string): string | null {
  const normalized = value.trim()
  return normalized || null
}

function buildPayload(values: Record<string, string>): ProjectRequirementPayload {
  return {
    code: values.code?.trim() ?? '',
    title: values.title?.trim() ?? '',
    type: (values.type || 'FUNCTIONAL') as RequirementType,
    status: (values.status || 'DRAFT') as RequirementStatus,
    priority: values.priority?.trim() ?? '',
    description: optionalValue(values.description ?? ''),
    content: optionalValue(values.content ?? ''),
    acceptanceCriteria: optionalValue(values.acceptanceCriteria ?? ''),
    origin: 'MANUAL',
  }
}

function statusColor(status: RequirementStatus): string {
  if (status === 'CONFIRMED') return 'success'
  if (status === 'CHANGED') return 'warning'
  if (status === 'REJECTED') return 'error'
  return 'default'
}

async function handleSubmit(values: Record<string, string>): Promise<void> {
  const payload = buildPayload(values)
  if (!payload.code || !payload.title || !payload.priority) {
    const key = !payload.code
      ? 'projectKnowledge.requirementCodeRequired'
      : !payload.title
        ? 'projectKnowledge.requirementTitleRequired'
        : 'projectKnowledge.requirementPriorityRequired'
    message.warning(t(key))
    return
  }
  if (!payload.description && !payload.content) {
    message.warning(t('projectKnowledge.requirementBodyRequired'))
    return
  }
  submitting.value = true
  try {
    if (formMode.value === 'create') {
      await createProjectRequirement(props.projectId, payload)
      message.success(t('projectKnowledge.createSuccess'))
    } else if (editing.value) {
      const updatePayload: UpdateProjectRequirementPayload = payload
      await updateProjectRequirement(props.projectId, editing.value.id, updatePayload)
      message.success(t('projectKnowledge.updateSuccess'))
    }
    formOpen.value = false
    await load()
    emit('changed')
  } catch (error) {
    message.error(errorMessage(error, t('projectKnowledge.requestFailed')))
  } finally {
    submitting.value = false
  }
}

async function handleDelete(row: ProjectRequirement): Promise<void> {
  if (!props.canManage || deletingId.value) return
  const confirmed = await confirmKnowledgeDelete(
    t('common.tip'),
    t('projectKnowledge.requirementDeleteConfirm', { name: row.title }),
    t('common.confirm'),
    t('common.cancel'),
  )
  if (!confirmed) return
  deletingId.value = row.id
  try {
    await deleteProjectRequirement(props.projectId, row.id)
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
  () => props.projectId,
  () => void load(),
  { immediate: true },
)
</script>

<template>
  <section class="requirements-section">
    <div class="requirements-section__header">
      <div>
        <div class="requirements-section__kicker">
          {{ t('projectKnowledge.requirementsKicker') }}
        </div>
        <h2 class="requirements-section__title">{{ t('projectKnowledge.requirementsTitle') }}</h2>
        <p class="requirements-section__description">
          {{ t('projectKnowledge.requirementsDescription') }}
        </p>
      </div>
      <Button v-if="canManage" type="primary" size="small" @click="openCreate">
        <PlusOutlined />
        {{ t('projectKnowledge.requirementCreate') }}
      </Button>
    </div>

    <div class="requirement-chain-legend">
      <span class="requirement-chain-legend__node">{{ t('projectKnowledge.chainEvidence') }}</span>
      <span class="requirement-chain-legend__line" aria-hidden="true"></span>
      <span class="requirement-chain-legend__node requirement-chain-legend__node--active">
        {{ t('projectKnowledge.chainRequirement') }}
      </span>
      <span class="requirement-chain-legend__line" aria-hidden="true"></span>
      <span class="requirement-chain-legend__node">{{
        t('projectKnowledge.chainDeliverable')
      }}</span>
    </div>

    <div v-if="loading" class="knowledge-state">{{ t('common.loading') }}</div>
    <Empty v-else-if="!rows.length" :description="t('projectKnowledge.requirementEmpty')" />
    <div v-else class="requirement-ledger">
      <article v-for="row in rows" :key="row.id" class="requirement-ledger__row">
        <Button type="text" block class="requirement-ledger__main" @click="openDetail(row)">
          <div class="requirement-ledger__meta">
            <span v-if="row.code" class="requirement-ledger__code">{{ row.code }}</span>
            <Tag :color="statusColor(row.status)">{{
              t(`projectKnowledge.requirementStatus${row.status}`)
            }}</Tag>
            <span>{{ t(`projectKnowledge.requirementType${row.type}`) }}</span>
          </div>
          <h3>{{ row.title }}</h3>
          <p>{{ row.description || t('projectKnowledge.noDescription') }}</p>
        </Button>
        <div class="requirement-ledger__date">
          {{ formatKnowledgeDate(row.updatedAt, locale) }}
        </div>
        <div class="requirement-ledger__actions">
          <Button type="link" size="small" @click="openDetail(row)">
            {{ t('projectKnowledge.requirementDetail') }}
          </Button>
          <template v-if="canManage">
            <Button type="link" size="small" @click="openEdit(row)">
              <EditOutlined />{{ t('common.edit') }}
            </Button>
            <Button
              type="link"
              size="small"
              danger
              :loading="deletingId === row.id"
              @click="handleDelete(row)"
            >
              <DeleteOutlined />{{ t('common.delete') }}
            </Button>
          </template>
        </div>
      </article>
    </div>

    <KnowledgeFormDialog
      v-model:open="formOpen"
      :title="formTitle"
      :fields="fields"
      :model-value="formModel"
      :submitting="submitting"
      @submit="handleSubmit"
    />
    <ProjectRequirementDetailDrawer
      v-model:open="detailOpen"
      :project-id="projectId"
      :requirement="detailRequirement"
      :can-manage="canManage"
      @changed="emit('changed')"
    />
  </section>
</template>

<style scoped lang="scss">
.requirements-section {
  min-width: 0;
}

.requirements-section__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 20px;
}

.requirements-section__kicker {
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.requirements-section__title {
  margin: 4px 0;
  color: #0f172a;
  font-size: 22px;
  font-weight: 650;
}

.requirements-section__description {
  max-width: 640px;
  margin: 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
}

.requirement-chain-legend {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 20px;
  color: #94a3b8;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.requirement-chain-legend__node {
  padding: 5px 8px;
  border: 1px solid #cbd5e1;
  color: #64748b;
}

.requirement-chain-legend__node--active {
  border-color: #0f766e;
  background: #f0fdfa;
  color: #0f766e;
}

.requirement-chain-legend__line {
  width: 30px;
  height: 1px;
  background: #cbd5e1;
}

.knowledge-state {
  padding: 56px 20px;
  color: #94a3b8;
  text-align: center;
}

.requirement-ledger {
  border-top: 1px solid #e2e8f0;
}

.requirement-ledger__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 170px auto;
  gap: 20px;
  align-items: center;
  padding: 16px 4px;
  border-bottom: 1px solid #e2e8f0;
}

.requirement-ledger__main {
  display: block;
  width: 100%;
  min-width: 0;
  height: auto;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  cursor: pointer;
  color: inherit;
  font: inherit;
  line-height: inherit;
  text-align: left;
  white-space: normal;
}

.requirement-ledger__main:hover {
  background: #f8fafc;
}

.requirement-ledger__main:focus-visible {
  outline: 2px solid #0f766e;
  outline-offset: 4px;
}

.requirement-ledger__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  color: #64748b;
  font-size: 12px;
}

.requirement-ledger__code {
  color: #0f766e;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-weight: 700;
}

.requirement-ledger__main h3 {
  margin: 7px 0 0;
  color: #1e293b;
  font-size: 15px;
  font-weight: 650;
}

.requirement-ledger__main p {
  margin: 5px 0 0;
  overflow: hidden;
  color: #64748b;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.requirement-ledger__date {
  color: #94a3b8;
  font-size: 12px;
}

.requirement-ledger__actions {
  display: flex;
  gap: 2px;
  white-space: nowrap;
}

@media (max-width: 780px) {
  .requirements-section__header {
    flex-direction: column;
  }

  .requirement-ledger__row {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .requirement-ledger__date {
    grid-column: 2;
    grid-row: 1;
  }

  .requirement-ledger__actions {
    grid-column: 1 / -1;
  }
}

@media (max-width: 480px) {
  .requirement-chain-legend {
    align-items: flex-start;
    flex-wrap: wrap;
  }
}
</style>
