<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Card, Empty, Space, Tag, message } from 'antdv-next'
import {
  ArrowRightOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  LinkOutlined,
  PlusOutlined,
} from '@antdv-next/icons'

import {
  createProjectRequirementTrace,
  deleteProjectRequirementTrace,
  fetchProjectRequirementTraces,
  fetchProjectRequirements,
  updateProjectRequirementTrace,
} from '@/api/project-knowledge'
import type {
  ProjectRequirement,
  ProjectRequirementTrace,
  ProjectRequirementTracePayload,
  RequirementTraceRelation,
  RequirementTraceTarget,
  UpdateProjectRequirementTracePayload,
} from '@/types/project-knowledge'
import KnowledgeFormDialog, { type KnowledgeFormField } from './KnowledgeFormDialog.vue'
import { confirmKnowledgeDelete, errorMessage, formatKnowledgeDate } from './knowledge-utils'

interface Props {
  projectId: string
  canManage: boolean
}

interface TraceRow {
  requirement: ProjectRequirement
  trace: ProjectRequirementTrace
}

const props = defineProps<Props>()
const emit = defineEmits<{ changed: [] }>()
const { locale, t } = useI18n()

const rows = ref<TraceRow[]>([])
const requirements = ref<ProjectRequirement[]>([])
const loading = ref(false)
const submitting = ref(false)
const deletingId = ref<string | null>(null)
const formOpen = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editing = ref<TraceRow | null>(null)
const formModel = ref<Record<string, string>>({})

const requirementOptions = computed(() =>
  requirements.value.map((row) => ({
    label: row.code ? `${row.code} · ${row.title}` : row.title,
    value: row.id,
  })),
)

const targetOptions = computed(() =>
  (['TASK', 'API', 'TEST_CASE', 'PRD', 'DELIVERABLE', 'OTHER'] as const).map((value) => ({
    label: t(`projectKnowledge.traceTarget${value}`),
    value,
  })),
)

const relationOptions = computed(() =>
  (['IMPLEMENTS', 'VERIFIES', 'DOCUMENTS', 'DEPENDS_ON'] as const).map((value) => ({
    label: t(`projectKnowledge.traceRelation${value}`),
    value,
  })),
)

const fields = computed<KnowledgeFormField[]>(() => [
  {
    key: 'requirementId',
    label: t('projectKnowledge.traceRequirement'),
    placeholder: t('projectKnowledge.traceRequirementPlaceholder'),
    type: 'select',
    options: requirementOptions.value,
    required: true,
  },
  {
    key: 'targetType',
    label: t('projectKnowledge.traceTargetType'),
    placeholder: t('projectKnowledge.traceTargetTypePlaceholder'),
    type: 'select',
    options: targetOptions.value,
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
    key: 'targetUrl',
    label: t('projectKnowledge.traceTargetUrl'),
    placeholder: t('projectKnowledge.traceTargetUrlPlaceholder'),
  },
  {
    key: 'relationType',
    label: t('projectKnowledge.traceRelationType'),
    placeholder: t('projectKnowledge.traceRelationTypePlaceholder'),
    type: 'select',
    options: relationOptions.value,
    required: true,
  },
])

const formTitle = computed(() =>
  formMode.value === 'create'
    ? t('projectKnowledge.traceCreateTitle')
    : t('projectKnowledge.traceEditTitle'),
)

function resetForm(): void {
  formModel.value = {
    requirementId: '',
    targetType: 'TASK',
    targetKey: '',
    targetName: '',
    targetUrl: '',
    relationType: 'IMPLEMENTS',
  }
}

function fillForm(row: TraceRow): void {
  formModel.value = {
    requirementId: row.requirement.id,
    targetType: row.trace.targetType,
    targetKey: row.trace.targetKey,
    targetName: row.trace.targetName,
    targetUrl: row.trace.targetUrl ?? '',
    relationType: row.trace.relationType,
  }
}

async function load(): Promise<void> {
  if (!props.projectId) return
  loading.value = true
  try {
    const loadedRequirements = await fetchProjectRequirements(props.projectId)
    const traceGroups = await Promise.all(
      loadedRequirements.map(async (requirement) => {
        const traces = await fetchProjectRequirementTraces(props.projectId, requirement.id)
        return traces.map((trace) => ({ requirement, trace }))
      }),
    )
    requirements.value = loadedRequirements
    rows.value = traceGroups.flat()
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

function openEdit(row: TraceRow): void {
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

function buildPayload(values: Record<string, string>): ProjectRequirementTracePayload {
  return {
    targetType: (values.targetType || 'TASK') as RequirementTraceTarget,
    targetKey: values.targetKey?.trim() ?? '',
    targetName: values.targetName?.trim() ?? '',
    targetUrl: optionalValue(values.targetUrl ?? ''),
    relationType: (values.relationType || 'IMPLEMENTS') as RequirementTraceRelation,
    origin: 'MANUAL',
  }
}

async function handleSubmit(values: Record<string, string>): Promise<void> {
  const requirementId = values.requirementId?.trim() ?? ''
  const payload = buildPayload(values)
  if (!requirementId) {
    message.warning(t('projectKnowledge.traceRequirementRequired'))
    return
  }
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
    if (formMode.value === 'create') {
      await createProjectRequirementTrace(props.projectId, requirementId, payload)
      message.success(t('projectKnowledge.createSuccess'))
    } else if (editing.value) {
      const updatePayload: UpdateProjectRequirementTracePayload = payload
      await updateProjectRequirementTrace(
        props.projectId,
        editing.value.requirement.id,
        editing.value.trace.id,
        updatePayload,
      )
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

async function handleDelete(row: TraceRow): Promise<void> {
  if (!props.canManage || deletingId.value) return
  const confirmed = await confirmKnowledgeDelete(
    t('common.tip'),
    t('projectKnowledge.traceDeleteConfirm', {
      target: row.trace.targetName || row.trace.targetKey,
    }),
    t('common.confirm'),
    t('common.cancel'),
  )
  if (!confirmed) return
  deletingId.value = row.trace.id
  try {
    await deleteProjectRequirementTrace(props.projectId, row.requirement.id, row.trace.id)
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
  <section class="traces-section">
    <div class="traces-section__header">
      <div>
        <div class="traces-section__kicker">{{ t('projectKnowledge.tracesKicker') }}</div>
        <h2 class="traces-section__title">{{ t('projectKnowledge.tracesTitle') }}</h2>
        <p class="traces-section__description">{{ t('projectKnowledge.tracesDescription') }}</p>
      </div>
      <Button v-if="canManage" type="primary" size="middle" @click="openCreate">
        <PlusOutlined />{{ t('projectKnowledge.traceCreate') }}
      </Button>
    </div>

    <div class="trace-chain-note mb-4 flex items-center gap-2 text-xs text-slate-400">
      <span>{{ t('projectKnowledge.chainEvidence') }}</span>
      <span class="trace-chain-note__arrow text-slate-300">→</span>
      <span class="trace-chain-note__active font-semibold text-teal-600 dark:text-teal-400">{{
        t('projectKnowledge.chainRequirement')
      }}</span>
      <span class="trace-chain-note__arrow text-slate-300">→</span>
      <span>{{ t('projectKnowledge.chainDeliverable') }}</span>
    </div>

    <div v-if="loading" class="knowledge-state">{{ t('common.loading') }}</div>
    <Empty v-else-if="!rows.length" :description="t('projectKnowledge.traceEmpty')" />
    <div v-else class="trace-ledger space-y-3">
      <Card
        v-for="row in rows"
        :key="row.trace.id"
        size="small"
        class="trace-ledger__row transition-all hover:border-teal-500/40 hover:shadow-xs"
      >
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div class="trace-ledger__main min-w-0 flex-1">
            <!-- 关联需求与关系流向 -->
            <div class="flex flex-wrap items-center gap-2 text-xs">
              <Tag color="blue" class="font-mono">
                {{ row.requirement.code }}
              </Tag>
              <span class="font-medium text-slate-700 dark:text-slate-200">{{
                row.requirement.title
              }}</span>
              <ArrowRightOutlined class="text-[11px] text-slate-400" />
              <Tag color="cyan">
                {{ t(`projectKnowledge.traceRelation${row.trace.relationType}`) }}
              </Tag>
              <Tag color="purple">
                {{ t(`projectKnowledge.traceTarget${row.trace.targetType}`) }}
              </Tag>
            </div>

            <!-- 目标名称和标识 -->
            <div class="mt-2 flex items-baseline gap-2">
              <h3 class="text-base font-semibold text-slate-800 dark:text-slate-100">
                {{ row.trace.targetName || row.trace.targetKey }}
              </h3>
              <span class="font-mono text-xs text-slate-400">({{ row.trace.targetKey }})</span>
            </div>

            <!-- 目标 URL -->
            <div
              v-if="row.trace.targetUrl"
              class="mt-1 flex items-center gap-1 text-xs text-teal-600 dark:text-teal-400"
            >
              <LinkOutlined />
              <a
                :href="row.trace.targetUrl"
                target="_blank"
                rel="noreferrer"
                class="truncate hover:underline"
              >
                {{ row.trace.targetUrl }}
              </a>
            </div>
          </div>

          <div
            class="flex shrink-0 items-center justify-between gap-3 pt-1 sm:flex-col sm:items-end sm:pt-0"
          >
            <div class="trace-ledger__date flex items-center gap-1 text-xs text-slate-400">
              <ClockCircleOutlined class="text-[11px]" />
              <span>{{ formatKnowledgeDate(row.trace.updatedAt, locale) }}</span>
            </div>
            <div v-if="canManage" class="trace-ledger__actions">
              <Space :size="4">
                <Button type="link" size="small" @click="openEdit(row)">
                  <EditOutlined />{{ t('common.edit') }}
                </Button>
                <Button
                  type="link"
                  size="small"
                  danger
                  :loading="deletingId === row.trace.id"
                  @click="handleDelete(row)"
                >
                  <DeleteOutlined />{{ t('common.delete') }}
                </Button>
              </Space>
            </div>
          </div>
        </div>
      </Card>
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
.traces-section {
  min-width: 0;
}

.traces-section__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 20px;
}

.traces-section__kicker {
  color: #0f766e;
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.traces-section__title {
  margin: 2px 0 4px;
  color: #0f172a;
  font-size: 20px;
  font-weight: 650;
}

.traces-section__description {
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
</style>
