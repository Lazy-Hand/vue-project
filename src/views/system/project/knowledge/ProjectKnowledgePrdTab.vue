<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Card, Empty, Space, Tag, message } from 'antdv-next'
import {
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
} from '@antdv-next/icons'

import {
  createProjectPrdDocument,
  deleteProjectPrdDocument,
  fetchProjectPrdDocuments,
  updateProjectPrdDocument,
} from '@/api/project-knowledge'
import type {
  PrdDocumentStatus,
  PrdDocumentType,
  ProjectPrdDocument,
  ProjectPrdDocumentPayload,
  UpdateProjectPrdDocumentPayload,
} from '@/types/project-knowledge'
import KnowledgeFormDialog, { type KnowledgeFormField } from './KnowledgeFormDialog.vue'
import ProjectPrdDocumentDetailDrawer from './ProjectPrdDocumentDetailDrawer.vue'
import { confirmKnowledgeDelete, errorMessage, formatKnowledgeDate } from './knowledge-utils'

interface Props {
  projectId: string
  canManage: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{ changed: [] }>()
const { locale, t } = useI18n()

const rows = ref<ProjectPrdDocument[]>([])
const loading = ref(false)
const submitting = ref(false)
const deletingId = ref<string | null>(null)
const formOpen = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editing = ref<ProjectPrdDocument | null>(null)
const formModel = ref<Record<string, string>>({})
const detailOpen = ref(false)
const detailDocument = ref<ProjectPrdDocument | null>(null)

const typeOptions = computed(() =>
  (['PRODUCT', 'FRONTEND', 'BACKEND', 'API', 'DATABASE', 'TEST', 'OTHER'] as const).map(
    (value) => ({
      label: t(`projectKnowledge.prdType${value}`),
      value,
    }),
  ),
)

const statusOptions = computed(() =>
  (['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const).map((value) => ({
    label: t(`projectKnowledge.prdStatus${value}`),
    value,
  })),
)

const fields = computed<KnowledgeFormField[]>(() => [
  {
    key: 'title',
    label: t('projectKnowledge.prdTitle'),
    placeholder: t('projectKnowledge.prdTitlePlaceholder'),
    required: true,
  },
  {
    key: 'type',
    label: t('projectKnowledge.prdType'),
    placeholder: t('projectKnowledge.prdTypePlaceholder'),
    type: 'select',
    options: typeOptions.value,
    required: true,
  },
  {
    key: 'status',
    label: t('projectKnowledge.prdStatus'),
    placeholder: t('projectKnowledge.prdStatusPlaceholder'),
    type: 'select',
    options: statusOptions.value,
    required: true,
  },
])

const formTitle = computed(() =>
  formMode.value === 'create'
    ? t('projectKnowledge.prdCreateTitle')
    : t('projectKnowledge.prdEditTitle'),
)

function resetForm(): void {
  formModel.value = {
    title: '',
    type: 'PRODUCT',
    status: 'DRAFT',
  }
}

function fillForm(row: ProjectPrdDocument): void {
  formModel.value = {
    title: row.title,
    type: row.type,
    status: row.status,
  }
}

async function load(): Promise<void> {
  if (!props.projectId) return
  loading.value = true
  try {
    rows.value = await fetchProjectPrdDocuments(props.projectId)
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

function openEdit(row: ProjectPrdDocument): void {
  if (!props.canManage) return
  formMode.value = 'edit'
  editing.value = row
  fillForm(row)
  formOpen.value = true
}

function openDetail(row: ProjectPrdDocument): void {
  detailDocument.value = row
  detailOpen.value = true
}

function buildPayload(values: Record<string, string>): ProjectPrdDocumentPayload {
  return {
    title: values.title?.trim() ?? '',
    type: (values.type || 'PRODUCT') as PrdDocumentType,
    status: (values.status || 'DRAFT') as PrdDocumentStatus,
    origin: 'MANUAL',
  }
}

async function handleSubmit(values: Record<string, string>): Promise<void> {
  const payload = buildPayload(values)
  if (!payload.title) {
    message.warning(t('projectKnowledge.prdTitleRequired'))
    return
  }
  submitting.value = true
  try {
    if (formMode.value === 'create') {
      await createProjectPrdDocument(props.projectId, payload)
      message.success(t('projectKnowledge.createSuccess'))
    } else if (editing.value) {
      const updatePayload: UpdateProjectPrdDocumentPayload = payload
      await updateProjectPrdDocument(props.projectId, editing.value.id, updatePayload)
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

function statusColor(status: PrdDocumentStatus): string {
  if (status === 'PUBLISHED') return 'success'
  if (status === 'ARCHIVED') return 'default'
  return 'processing'
}

async function handleDelete(row: ProjectPrdDocument): Promise<void> {
  if (!props.canManage || deletingId.value) return
  const confirmed = await confirmKnowledgeDelete(
    t('common.tip'),
    t('projectKnowledge.prdDeleteConfirm', { name: row.title }),
    t('common.confirm'),
    t('common.cancel'),
  )
  if (!confirmed) return
  deletingId.value = row.id
  try {
    await deleteProjectPrdDocument(props.projectId, row.id)
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
  <section class="prd-section">
    <div class="prd-section__header">
      <div>
        <div class="prd-section__kicker">{{ t('projectKnowledge.prdKicker') }}</div>
        <h2 class="prd-section__title">{{ t('projectKnowledge.prdTitleSection') }}</h2>
        <p class="prd-section__description">{{ t('projectKnowledge.prdDescription') }}</p>
      </div>
      <Button v-if="canManage" type="primary" size="middle" @click="openCreate">
        <PlusOutlined />{{ t('projectKnowledge.prdCreate') }}
      </Button>
    </div>

    <div v-if="loading" class="knowledge-state">{{ t('common.loading') }}</div>
    <Empty v-else-if="!rows.length" :description="t('projectKnowledge.prdEmpty')" />
    <div v-else class="prd-ledger space-y-3">
      <Card
        v-for="row in rows"
        :key="row.id"
        size="small"
        class="prd-ledger__row transition-all hover:border-teal-500/40 hover:shadow-xs"
      >
        <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div class="prd-ledger__main min-w-0 flex-1 cursor-pointer" @click="openDetail(row)">
            <div class="prd-ledger__meta flex flex-wrap items-center gap-2">
              <Tag :color="statusColor(row.status)">{{
                t(`projectKnowledge.prdStatus${row.status}`)
              }}</Tag>
              <Tag>{{ t(`projectKnowledge.prdType${row.type}`) }}</Tag>
            </div>
            <h3
              class="mt-1 text-base font-semibold text-slate-800 hover:text-teal-600 dark:text-slate-100 dark:hover:text-teal-400"
            >
              {{ row.title }}
            </h3>
          </div>

          <div
            class="flex shrink-0 items-center justify-between gap-3 pt-1 sm:flex-col sm:items-end sm:pt-0"
          >
            <div class="prd-ledger__date flex items-center gap-1 text-xs text-slate-400">
              <ClockCircleOutlined class="text-[11px]" />
              <span>{{ formatKnowledgeDate(row.updatedAt, locale) }}</span>
            </div>
            <div class="prd-ledger__actions">
              <Space :size="4">
                <Button type="link" size="small" @click="openDetail(row)">
                  <EyeOutlined />{{ t('projectKnowledge.prdDetail') }}
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
    <ProjectPrdDocumentDetailDrawer
      v-model:open="detailOpen"
      :project-id="projectId"
      :document="detailDocument"
      :can-manage="canManage"
      @changed="emit('changed')"
    />
  </section>
</template>

<style scoped lang="scss">
.prd-section {
  min-width: 0;
}

.prd-section__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 20px;
}

.prd-section__kicker {
  color: #0f766e;
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.prd-section__title {
  margin: 2px 0 4px;
  color: #0f172a;
  font-size: 20px;
  font-weight: 650;
}

.prd-section__description {
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
