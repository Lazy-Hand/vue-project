<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Empty, Tag, message } from 'antdv-next'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@antdv-next/icons'

import {
  createProjectKnowledgeQuestion,
  deleteProjectKnowledgeQuestion,
  fetchProjectKnowledgeQuestions,
  fetchProjectRequirements,
  updateProjectKnowledgeQuestion,
} from '@/api/project-knowledge'
import type {
  KnowledgeQuestionStatus,
  ProjectKnowledgeQuestion,
  ProjectKnowledgeQuestionPayload,
  ProjectRequirement,
  UpdateProjectKnowledgeQuestionPayload,
} from '@/types/project-knowledge'
import KnowledgeFormDialog, { type KnowledgeFormField } from './KnowledgeFormDialog.vue'
import { confirmKnowledgeDelete, errorMessage, formatKnowledgeDate } from './knowledge-utils'

interface Props {
  projectId: string
  canManage: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{ changed: [] }>()
const { locale, t } = useI18n()

const rows = ref<ProjectKnowledgeQuestion[]>([])
const requirements = ref<ProjectRequirement[]>([])
const loading = ref(false)
const submitting = ref(false)
const deletingId = ref<string | null>(null)
const formOpen = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editing = ref<ProjectKnowledgeQuestion | null>(null)
const formModel = ref<Record<string, string>>({})

const statusOptions = computed(() =>
  (['OPEN', 'ANSWERED', 'CLOSED'] as const).map((value) => ({
    label: t(`projectKnowledge.questionStatus${value}`),
    value,
  })),
)

const requirementOptions = computed(() =>
  requirements.value.map((row) => ({
    label: row.code ? `${row.code} · ${row.title}` : row.title,
    value: row.id,
  })),
)

const fields = computed<KnowledgeFormField[]>(() => [
  {
    key: 'requirementId',
    label: t('projectKnowledge.questionRequirement'),
    placeholder: t('projectKnowledge.questionRequirementPlaceholder'),
    type: 'select',
    options: requirementOptions.value,
  },
  {
    key: 'question',
    label: t('projectKnowledge.questionText'),
    placeholder: t('projectKnowledge.questionTextPlaceholder'),
    type: 'textarea',
    rows: 4,
    required: true,
  },
  {
    key: 'answer',
    label: t('projectKnowledge.questionAnswer'),
    placeholder: t('projectKnowledge.questionAnswerPlaceholder'),
    type: 'textarea',
    rows: 4,
  },
  {
    key: 'status',
    label: t('projectKnowledge.questionStatus'),
    placeholder: t('projectKnowledge.questionStatusPlaceholder'),
    type: 'select',
    options: statusOptions.value,
    required: true,
  },
  {
    key: 'context',
    label: t('projectKnowledge.questionContext'),
    placeholder: t('projectKnowledge.questionContextPlaceholder'),
    type: 'textarea',
    rows: 3,
  },
  {
    key: 'priority',
    label: t('projectKnowledge.questionPriority'),
    placeholder: t('projectKnowledge.questionPriorityPlaceholder'),
    required: true,
  },
  {
    key: 'dueAt',
    label: t('projectKnowledge.questionDueAt'),
    placeholder: t('projectKnowledge.questionDueAtPlaceholder'),
  },
])

const formTitle = computed(() =>
  formMode.value === 'create'
    ? t('projectKnowledge.questionCreateTitle')
    : t('projectKnowledge.questionEditTitle'),
)

function resetForm(): void {
  formModel.value = {
    question: '',
    answer: '',
    status: 'OPEN',
    requirementId: '',
    context: '',
    priority: '',
    dueAt: '',
  }
}

function fillForm(row: ProjectKnowledgeQuestion): void {
  formModel.value = {
    question: row.question,
    answer: row.answer ?? '',
    status: row.status,
    requirementId: row.requirementId ?? '',
    context: row.context ?? '',
    priority: row.priority,
    dueAt: row.dueAt ?? '',
  }
}

async function load(): Promise<void> {
  if (!props.projectId) return
  loading.value = true
  try {
    const [loadedQuestions, loadedRequirements] = await Promise.all([
      fetchProjectKnowledgeQuestions(props.projectId),
      fetchProjectRequirements(props.projectId),
    ])
    rows.value = loadedQuestions
    requirements.value = loadedRequirements
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

function openEdit(row: ProjectKnowledgeQuestion): void {
  if (!props.canManage) return
  formMode.value = 'edit'
  editing.value = row
  fillForm(row)
  formOpen.value = true
}

function optionalValue(value: string): string | null {
  const normalized = value.trim()
  return normalized || null
}

function buildPayload(values: Record<string, string>): ProjectKnowledgeQuestionPayload {
  return {
    requirementId: optionalValue(values.requirementId ?? ''),
    question: values.question?.trim() ?? '',
    context: optionalValue(values.context ?? ''),
    answer: optionalValue(values.answer ?? ''),
    status: (values.status || 'OPEN') as KnowledgeQuestionStatus,
    priority: values.priority?.trim() ?? '',
    dueAt: optionalValue(values.dueAt ?? ''),
    origin: 'MANUAL',
  }
}

function statusColor(status: KnowledgeQuestionStatus): string {
  if (status === 'OPEN') return 'warning'
  if (status === 'ANSWERED') return 'processing'
  return 'success'
}

async function handleSubmit(values: Record<string, string>): Promise<void> {
  const payload = buildPayload(values)
  if (!payload.question || !payload.priority) {
    message.warning(
      !payload.question
        ? t('projectKnowledge.questionRequired')
        : t('projectKnowledge.questionPriorityRequired'),
    )
    return
  }
  submitting.value = true
  try {
    if (formMode.value === 'create') {
      await createProjectKnowledgeQuestion(props.projectId, payload)
      message.success(t('projectKnowledge.createSuccess'))
    } else if (editing.value) {
      const updatePayload: UpdateProjectKnowledgeQuestionPayload = payload
      await updateProjectKnowledgeQuestion(props.projectId, editing.value.id, updatePayload)
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

async function handleDelete(row: ProjectKnowledgeQuestion): Promise<void> {
  if (!props.canManage || deletingId.value) return
  const confirmed = await confirmKnowledgeDelete(
    t('common.tip'),
    t('projectKnowledge.questionDeleteConfirm', { question: row.question }),
    t('common.confirm'),
    t('common.cancel'),
  )
  if (!confirmed) return
  deletingId.value = row.id
  try {
    await deleteProjectKnowledgeQuestion(props.projectId, row.id)
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
  <section class="knowledge-section questions-section">
    <div class="knowledge-section__header">
      <div>
        <div class="knowledge-section__kicker">{{ t('projectKnowledge.questionsKicker') }}</div>
        <h2 class="knowledge-section__title">{{ t('projectKnowledge.questionsTitle') }}</h2>
        <p class="knowledge-section__description">
          {{ t('projectKnowledge.questionsDescription') }}
        </p>
      </div>
      <Button v-if="canManage" type="primary" size="small" @click="openCreate">
        <PlusOutlined />
        {{ t('projectKnowledge.questionCreate') }}
      </Button>
    </div>

    <div v-if="loading" class="knowledge-state">{{ t('common.loading') }}</div>
    <Empty v-else-if="!rows.length" :description="t('projectKnowledge.questionEmpty')" />
    <div v-else class="knowledge-ledger">
      <article v-for="row in rows" :key="row.id" class="knowledge-ledger__row">
        <div class="knowledge-ledger__main">
          <div class="knowledge-ledger__meta">
            <Tag :color="statusColor(row.status)">{{
              t(`projectKnowledge.questionStatus${row.status}`)
            }}</Tag>
            <span class="knowledge-origin">
              {{
                requirements.find((item) => item.id === row.requirementId)?.code ||
                t('projectKnowledge.questionRequirementUnset')
              }}
            </span>
          </div>
          <h3>{{ row.question }}</h3>
          <p>{{ row.answer || row.context || t('projectKnowledge.questionUnanswered') }}</p>
        </div>
        <div class="knowledge-ledger__date">
          {{ formatKnowledgeDate(row.dueAt || row.updatedAt, locale) }}
        </div>
        <div v-if="canManage" class="knowledge-ledger__actions">
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
  </section>
</template>

<style scoped lang="scss">
.knowledge-section {
  min-width: 0;
}

.knowledge-section__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 24px;
}

.knowledge-section__kicker {
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.knowledge-section__title {
  margin: 4px 0;
  color: #0f172a;
  font-size: 22px;
  font-weight: 650;
}

.knowledge-section__description {
  max-width: 620px;
  margin: 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
}

.knowledge-state {
  padding: 56px 20px;
  color: #94a3b8;
  text-align: center;
}

.knowledge-ledger {
  overflow: hidden;
  border-top: 1px solid #e2e8f0;
}

.knowledge-ledger__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 170px auto;
  gap: 20px;
  align-items: center;
  padding: 18px 4px;
  border-bottom: 1px solid #e2e8f0;
}

.knowledge-ledger__main {
  min-width: 0;
}

.knowledge-ledger__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.knowledge-ledger__main h3 {
  margin: 0;
  overflow: hidden;
  color: #1e293b;
  font-size: 15px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.knowledge-ledger__main p {
  margin: 5px 0 0;
  overflow: hidden;
  color: #64748b;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.knowledge-origin {
  color: #94a3b8;
  font-size: 12px;
}

.knowledge-ledger__date {
  color: #94a3b8;
  font-size: 12px;
}

.knowledge-ledger__actions {
  display: flex;
  gap: 2px;
  white-space: nowrap;
}

@media (max-width: 720px) {
  .knowledge-section__header {
    flex-direction: column;
  }

  .knowledge-ledger__row {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .knowledge-ledger__date {
    grid-column: 2;
    grid-row: 1;
  }

  .knowledge-ledger__actions {
    grid-column: 1 / -1;
  }
}
</style>
