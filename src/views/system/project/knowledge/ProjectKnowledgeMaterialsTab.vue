<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Empty, Tag, message } from 'antdv-next'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@antdv-next/icons'

import {
  createProjectKnowledgeMaterial,
  deleteProjectKnowledgeMaterial,
  fetchProjectKnowledgeMaterials,
  updateProjectKnowledgeMaterial,
} from '@/api/project-knowledge'
import type {
  KnowledgeMaterialType,
  ProjectKnowledgeMaterial,
  ProjectKnowledgeMaterialPayload,
  UpdateProjectKnowledgeMaterialPayload,
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

const rows = ref<ProjectKnowledgeMaterial[]>([])
const loading = ref(false)
const submitting = ref(false)
const deletingId = ref<string | null>(null)
const formOpen = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editing = ref<ProjectKnowledgeMaterial | null>(null)
const formModel = ref<Record<string, string>>({})
const formDialogRef = ref<InstanceType<typeof KnowledgeFormDialog> | null>(null)
const formAssets = computed(() => editing.value?.assets ?? [])

const typeOptions = computed(() =>
  (['DOCUMENT', 'INTERVIEW_NOTE', 'IMAGE', 'AUDIO', 'VIDEO', 'LINK', 'OTHER'] as const).map(
    (value) => ({ label: t(`projectKnowledge.materialType${value}`), value }),
  ),
)

const fields = computed<KnowledgeFormField[]>(() => [
  {
    key: 'title',
    label: t('projectKnowledge.materialTitle'),
    placeholder: t('projectKnowledge.materialTitlePlaceholder'),
    required: true,
  },
  {
    key: 'type',
    label: t('projectKnowledge.materialType'),
    placeholder: t('projectKnowledge.materialTypePlaceholder'),
    type: 'select',
    options: typeOptions.value,
    required: true,
  },
  {
    key: 'sourceUrl',
    label: t('projectKnowledge.materialUrl'),
    placeholder: t('projectKnowledge.materialUrlPlaceholder'),
  },
  {
    key: 'description',
    label: t('projectKnowledge.materialDescription'),
    placeholder: t('projectKnowledge.materialDescriptionPlaceholder'),
    type: 'textarea',
    rows: 3,
  },
])

const formTitle = computed(() =>
  formMode.value === 'create'
    ? t('projectKnowledge.materialCreateTitle')
    : t('projectKnowledge.materialEditTitle'),
)

function typeLabel(type: KnowledgeMaterialType): string {
  return t(`projectKnowledge.materialType${type}`)
}

function originLabel(origin: ProjectKnowledgeMaterial['origin']): string {
  return t(`projectKnowledge.origin${origin}`)
}

function resetForm(): void {
  formModel.value = {
    title: '',
    type: 'DOCUMENT',
    sourceUrl: '',
    description: '',
  }
}

function fillForm(row: ProjectKnowledgeMaterial): void {
  formModel.value = {
    title: row.title,
    type: row.type,
    sourceUrl: row.sourceUrl ?? '',
    description: row.description ?? '',
  }
}

async function load(): Promise<void> {
  if (!props.projectId) return
  loading.value = true
  try {
    rows.value = await fetchProjectKnowledgeMaterials(props.projectId)
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

function openEdit(row: ProjectKnowledgeMaterial): void {
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
): ProjectKnowledgeMaterialPayload {
  return {
    title: values.title?.trim() ?? '',
    type: (values.type || 'DOCUMENT') as KnowledgeMaterialType,
    sourceUrl: optionalValue(values.sourceUrl ?? ''),
    ...(assetIds !== undefined ? { assetIds } : {}),
    description: optionalValue(values.description ?? ''),
    origin: 'MANUAL',
  }
}

async function handleSubmit(values: Record<string, string>, assetIds?: string[]): Promise<void> {
  const payload = buildPayload(values, assetIds)
  if (!payload.title) {
    await formDialogRef.value?.rollbackFiles()
    message.warning(t('projectKnowledge.materialTitleRequired'))
    return
  }
  submitting.value = true
  try {
    if (formMode.value === 'create') {
      await createProjectKnowledgeMaterial(props.projectId, payload)
      message.success(t('projectKnowledge.createSuccess'))
    } else if (editing.value) {
      const updatePayload: UpdateProjectKnowledgeMaterialPayload = payload
      await updateProjectKnowledgeMaterial(props.projectId, editing.value.id, updatePayload)
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

async function handleDelete(row: ProjectKnowledgeMaterial): Promise<void> {
  if (!props.canManage || deletingId.value) return
  const confirmed = await confirmKnowledgeDelete(
    t('common.tip'),
    t('projectKnowledge.materialDeleteConfirm', { name: row.title }),
    t('common.confirm'),
    t('common.cancel'),
  )
  if (!confirmed) return
  deletingId.value = row.id
  try {
    await deleteProjectKnowledgeMaterial(props.projectId, row.id)
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
  <section class="knowledge-section">
    <div class="knowledge-section__header">
      <div>
        <div class="knowledge-section__kicker">{{ t('projectKnowledge.materialsKicker') }}</div>
        <h2 class="knowledge-section__title">{{ t('projectKnowledge.materialsTitle') }}</h2>
        <p class="knowledge-section__description">
          {{ t('projectKnowledge.materialsDescription') }}
        </p>
      </div>
      <Button v-if="canManage" type="primary" size="small" @click="openCreate">
        <PlusOutlined />
        {{ t('projectKnowledge.materialCreate') }}
      </Button>
    </div>

    <div v-if="loading" class="knowledge-state">{{ t('common.loading') }}</div>
    <Empty v-else-if="!rows.length" :description="t('projectKnowledge.materialEmpty')" />
    <div v-else class="knowledge-ledger">
      <article v-for="row in rows" :key="row.id" class="knowledge-ledger__row">
        <div class="knowledge-ledger__main">
          <div class="knowledge-ledger__meta">
            <Tag>{{ typeLabel(row.type) }}</Tag>
            <Tag v-if="row.assets.length" color="blue">
              {{ t('projectFile.fileCount', { count: row.assets.length }) }}
            </Tag>
            <span class="knowledge-origin">{{ originLabel(row.origin) }}</span>
          </div>
          <h3>{{ row.title }}</h3>
          <p>
            {{ row.description || row.sourceUrl || t('projectKnowledge.noDescription') }}
          </p>
        </div>
        <div class="knowledge-ledger__date">{{ formatKnowledgeDate(row.updatedAt, locale) }}</div>
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
      file-kind="MATERIAL"
      :file-assets="formAssets"
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
  margin: 4px 0 4px;
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
