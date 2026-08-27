<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Card, Empty, Space, Tag, message } from 'antdv-next'
import {
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  LinkOutlined,
  PlusOutlined,
} from '@antdv-next/icons'

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

function typeTagColor(type: KnowledgeMaterialType): string {
  const map: Record<KnowledgeMaterialType, string> = {
    DOCUMENT: 'blue',
    INTERVIEW_NOTE: 'purple',
    IMAGE: 'green',
    AUDIO: 'orange',
    VIDEO: 'magenta',
    LINK: 'cyan',
    OTHER: 'default',
  }
  return map[type] ?? 'default'
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
      <Button v-if="canManage" type="primary" size="middle" @click="openCreate">
        <PlusOutlined />
        {{ t('projectKnowledge.materialCreate') }}
      </Button>
    </div>

    <div v-if="loading" class="knowledge-state">{{ t('common.loading') }}</div>
    <Empty v-else-if="!rows.length" :description="t('projectKnowledge.materialEmpty')" />
    <div v-else class="knowledge-ledger space-y-3">
      <Card
        v-for="row in rows"
        :key="row.id"
        size="small"
        class="knowledge-ledger__row transition-all hover:border-teal-500/40 hover:shadow-xs"
      >
        <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div class="knowledge-ledger__main min-w-0 flex-1">
            <div class="knowledge-ledger__meta flex flex-wrap items-center gap-2">
              <Tag :color="typeTagColor(row.type)">{{ typeLabel(row.type) }}</Tag>
              <Tag v-if="row.assets.length" color="blue">
                {{ t('projectFile.fileCount', { count: row.assets.length }) }}
              </Tag>
              <span class="knowledge-origin text-xs text-slate-400">{{
                originLabel(row.origin)
              }}</span>
            </div>
            <h3 class="mt-1 text-base font-semibold text-slate-800 dark:text-slate-100">
              {{ row.title }}
            </h3>
            <p class="mt-1 text-xs text-slate-500 line-clamp-2 dark:text-slate-400">
              {{ row.description || row.sourceUrl || t('projectKnowledge.noDescription') }}
            </p>
            <div
              v-if="row.sourceUrl"
              class="mt-1.5 flex items-center gap-1 text-xs text-teal-600 dark:text-teal-400"
            >
              <LinkOutlined />
              <span class="truncate">{{ row.sourceUrl }}</span>
            </div>
          </div>

          <div
            class="flex shrink-0 items-center justify-between gap-3 pt-1 sm:flex-col sm:items-end sm:pt-0"
          >
            <div class="knowledge-ledger__date flex items-center gap-1 text-xs text-slate-400">
              <ClockCircleOutlined class="text-[11px]" />
              <span>{{ formatKnowledgeDate(row.updatedAt, locale) }}</span>
            </div>
            <div v-if="canManage" class="knowledge-ledger__actions">
              <Space :size="4">
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
              </Space>
            </div>
          </div>
        </div>
      </Card>
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
  margin-bottom: 20px;
}

.knowledge-section__kicker {
  color: #0f766e;
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.knowledge-section__title {
  margin: 2px 0 4px;
  color: #0f172a;
  font-size: 20px;
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
</style>
