<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Empty, Tag, message } from 'antdv-next'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@antdv-next/icons'

import {
  createProjectResearchRecord,
  deleteProjectResearchRecord,
  fetchProjectResearchRecords,
  updateProjectResearchRecord,
} from '@/api/project-knowledge'
import type {
  ProjectResearchRecord,
  ProjectResearchRecordPayload,
  UpdateProjectResearchRecordPayload,
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

const rows = ref<ProjectResearchRecord[]>([])
const loading = ref(false)
const submitting = ref(false)
const deletingId = ref<string | null>(null)
const formOpen = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editing = ref<ProjectResearchRecord | null>(null)
const formModel = ref<Record<string, string>>({})
const formDialogRef = ref<InstanceType<typeof KnowledgeFormDialog> | null>(null)
const formAssets = computed(() => editing.value?.assets ?? [])

const fields = computed<KnowledgeFormField[]>(() => [
  {
    key: 'title',
    label: t('projectKnowledge.researchTitle'),
    placeholder: t('projectKnowledge.researchTitlePlaceholder'),
    required: true,
  },
  {
    key: 'occurredAt',
    label: t('projectKnowledge.researchOccurredAt'),
    placeholder: t('projectKnowledge.researchOccurredAtPlaceholder'),
  },
  {
    key: 'location',
    label: t('projectKnowledge.researchLocation'),
    placeholder: t('projectKnowledge.researchLocationPlaceholder'),
  },
  {
    key: 'participants',
    label: t('projectKnowledge.researchParticipants'),
    placeholder: t('projectKnowledge.researchParticipantsPlaceholder'),
  },
  {
    key: 'summary',
    label: t('projectKnowledge.researchSummary'),
    placeholder: t('projectKnowledge.researchSummaryPlaceholder'),
    type: 'textarea',
    rows: 4,
  },
  {
    key: 'content',
    label: t('projectKnowledge.researchContent'),
    placeholder: t('projectKnowledge.researchContentPlaceholder'),
    type: 'textarea',
    rows: 7,
    required: true,
  },
])

const formTitle = computed(() =>
  formMode.value === 'create'
    ? t('projectKnowledge.researchCreateTitle')
    : t('projectKnowledge.researchEditTitle'),
)

function resetForm(): void {
  formModel.value = {
    title: '',
    occurredAt: '',
    location: '',
    participants: '',
    summary: '',
    content: '',
  }
}

function fillForm(row: ProjectResearchRecord): void {
  formModel.value = {
    title: row.title,
    occurredAt: row.occurredAt ?? '',
    location: row.location ?? '',
    participants: row.participants ?? '',
    summary: row.summary ?? '',
    content: row.content,
  }
}

async function load(): Promise<void> {
  if (!props.projectId) return
  loading.value = true
  try {
    rows.value = await fetchProjectResearchRecords(props.projectId)
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

function openEdit(row: ProjectResearchRecord): void {
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

function buildPayload(
  values: Record<string, string>,
  assetIds?: string[],
): ProjectResearchRecordPayload {
  return {
    title: values.title?.trim() ?? '',
    occurredAt: optionalValue(values.occurredAt ?? ''),
    location: optionalValue(values.location ?? ''),
    participants: optionalValue(values.participants ?? ''),
    summary: optionalValue(values.summary ?? ''),
    content: values.content?.trim() ?? '',
    ...(assetIds !== undefined ? { assetIds } : {}),
    origin: 'MANUAL',
  }
}

async function handleSubmit(values: Record<string, string>, assetIds?: string[]): Promise<void> {
  const payload = buildPayload(values, assetIds)
  if (!payload.title || !payload.content) {
    await formDialogRef.value?.rollbackFiles()
    message.warning(
      !payload.title
        ? t('projectKnowledge.researchTitleRequired')
        : t('projectKnowledge.researchContentRequired'),
    )
    return
  }
  submitting.value = true
  try {
    if (formMode.value === 'create') {
      await createProjectResearchRecord(props.projectId, payload)
      message.success(t('projectKnowledge.createSuccess'))
    } else if (editing.value) {
      const updatePayload: UpdateProjectResearchRecordPayload = payload
      await updateProjectResearchRecord(props.projectId, editing.value.id, updatePayload)
      message.success(t('projectKnowledge.updateSuccess'))
    }
    formDialogRef.value?.commitFiles()
    formOpen.value = false
    await load()
    emit('changed')
  } catch (error) {
    await formDialogRef.value?.rollbackFiles()
    message.error(errorMessage(error, t('projectKnowledge.requestFailed')))
  } finally {
    submitting.value = false
  }
}

async function handleDelete(row: ProjectResearchRecord): Promise<void> {
  if (!props.canManage || deletingId.value) return
  const confirmed = await confirmKnowledgeDelete(
    t('common.tip'),
    t('projectKnowledge.researchDeleteConfirm', { name: row.title }),
    t('common.confirm'),
    t('common.cancel'),
  )
  if (!confirmed) return
  deletingId.value = row.id
  try {
    await deleteProjectResearchRecord(props.projectId, row.id)
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
  <section class="knowledge-section research-section">
    <div class="knowledge-section__header">
      <div>
        <div class="knowledge-section__kicker">{{ t('projectKnowledge.researchKicker') }}</div>
        <h2 class="knowledge-section__title">{{ t('projectKnowledge.researchTitle') }}</h2>
        <p class="knowledge-section__description">
          {{ t('projectKnowledge.researchDescription') }}
        </p>
      </div>
      <Button v-if="canManage" type="primary" size="small" @click="openCreate">
        <PlusOutlined />
        {{ t('projectKnowledge.researchCreate') }}
      </Button>
    </div>

    <div v-if="loading" class="knowledge-state">{{ t('common.loading') }}</div>
    <Empty v-else-if="!rows.length" :description="t('projectKnowledge.researchEmpty')" />
    <div v-else class="knowledge-ledger">
      <article v-for="row in rows" :key="row.id" class="knowledge-ledger__row">
        <div class="knowledge-ledger__main">
          <div class="knowledge-ledger__meta">
            <Tag color="purple">{{
              row.location || t('projectKnowledge.researchLocationUnset')
            }}</Tag>
            <Tag v-if="row.assets.length" color="blue">
              {{ t('projectFile.fileCount', { count: row.assets.length }) }}
            </Tag>
            <span class="knowledge-origin">{{
              row.participants || t('projectKnowledge.researchParticipantsUnset')
            }}</span>
          </div>
          <h3>{{ row.title }}</h3>
          <p>{{ row.summary || row.content || t('projectKnowledge.noDescription') }}</p>
        </div>
        <div class="knowledge-ledger__date">
          {{ formatKnowledgeDate(row.occurredAt || row.updatedAt, locale) }}
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
      ref="formDialogRef"
      v-model:open="formOpen"
      :title="formTitle"
      :fields="fields"
      :model-value="formModel"
      :submitting="submitting"
      :project-id="props.projectId"
      file-kind="RESEARCH_RECORD"
      :file-assets="formAssets"
      @submit="handleSubmit"
    />
  </section>
</template>

<style scoped lang="scss">
.research-section {
  .knowledge-ledger__row {
    grid-template-columns: minmax(0, 1fr) 190px auto;
  }
}

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

  .research-section .knowledge-ledger__row,
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
