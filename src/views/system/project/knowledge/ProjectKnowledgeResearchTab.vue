<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Button,
  Card,
  Checkbox,
  CheckboxGroup,
  Empty,
  Input,
  Modal,
  Space,
  Tag,
  message,
} from 'antdv-next'
import {
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  EnvironmentOutlined,
  LinkOutlined,
  PlusOutlined,
  TeamOutlined,
} from '@antdv-next/icons'

import {
  createProjectResearchRecord,
  deleteProjectResearchRecord,
  fetchProjectKnowledgeMaterials,
  fetchProjectResearchRecords,
  linkResearchRecordMaterials,
  unlinkResearchRecordMaterial,
  updateProjectResearchRecord,
} from '@/api/project-knowledge'
import type {
  ProjectKnowledgeMaterial,
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

const pickerOpen = ref(false)
const pickerTarget = ref<ProjectResearchRecord | null>(null)
const allMaterials = ref<ProjectKnowledgeMaterial[]>([])
const selectedMaterialIds = ref<string[]>([])
const materialSearchKeyword = ref('')
const linking = ref(false)
const unloadingId = ref<string | null>(null)

const filteredMaterials = computed(() => {
  const keyword = materialSearchKeyword.value.trim().toLowerCase()
  if (!keyword) return allMaterials.value
  return allMaterials.value.filter((material) => material.title.toLowerCase().includes(keyword))
})

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

async function openMaterialPicker(row: ProjectResearchRecord): Promise<void> {
  if (!props.canManage) return
  pickerTarget.value = row
  selectedMaterialIds.value = row.materials.map((material) => material.id)
  materialSearchKeyword.value = ''
  pickerOpen.value = true
  if (!allMaterials.value.length) {
    try {
      allMaterials.value = await fetchProjectKnowledgeMaterials(props.projectId)
    } catch (error) {
      message.error(errorMessage(error, t('projectKnowledge.requestFailed')))
    }
  }
}

async function handleLinkMaterials(): Promise<void> {
  const target = pickerTarget.value
  if (!target) return
  if (!selectedMaterialIds.value.length) {
    message.warning(t('projectKnowledge.linkMaterialsRequired'))
    return
  }
  linking.value = true
  try {
    await linkResearchRecordMaterials(props.projectId, target.id, selectedMaterialIds.value)
    message.success(t('projectKnowledge.materialLinkSuccess'))
    pickerOpen.value = false
    await load()
    emit('changed')
  } catch (error) {
    message.error(errorMessage(error, t('projectKnowledge.requestFailed')))
  } finally {
    linking.value = false
  }
}

async function handleUnlinkMaterial(row: ProjectResearchRecord, materialId: string): Promise<void> {
  if (!props.canManage || unloadingId.value) return
  const confirmed = await confirmKnowledgeDelete(
    t('common.tip'),
    t('projectKnowledge.materialUnlinkConfirm'),
    t('common.confirm'),
    t('common.cancel'),
  )
  if (!confirmed) return
  unloadingId.value = materialId
  try {
    await unlinkResearchRecordMaterial(props.projectId, row.id, materialId)
    message.success(t('projectKnowledge.materialUnlinkSuccess'))
    await load()
    emit('changed')
  } catch (error) {
    message.error(errorMessage(error, t('projectKnowledge.requestFailed')))
  } finally {
    unloadingId.value = null
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
      <Button v-if="canManage" type="primary" size="middle" @click="openCreate">
        <PlusOutlined />
        {{ t('projectKnowledge.researchCreate') }}
      </Button>
    </div>

    <div v-if="loading" class="knowledge-state">{{ t('common.loading') }}</div>
    <Empty v-else-if="!rows.length" :description="t('projectKnowledge.researchEmpty')" />
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
              <Tag color="purple" class="flex items-center gap-1">
                <EnvironmentOutlined class="text-[11px]" />
                {{ row.location || t('projectKnowledge.researchLocationUnset') }}
              </Tag>
              <Tag v-if="row.assets.length" color="blue">
                {{ t('projectFile.fileCount', { count: row.assets.length }) }}
              </Tag>
              <span class="knowledge-origin flex items-center gap-1 text-xs text-slate-400">
                <TeamOutlined class="text-[11px]" />
                {{ row.participants || t('projectKnowledge.researchParticipantsUnset') }}
              </span>
            </div>
            <h3 class="mt-1 text-base font-semibold text-slate-800 dark:text-slate-100">
              {{ row.title }}
            </h3>
            <p class="mt-1 text-xs text-slate-500 line-clamp-3 dark:text-slate-400">
              {{ row.summary || row.content || t('projectKnowledge.noDescription') }}
            </p>
            <div
              v-if="row.materials.length"
              class="knowledge-ledger__materials mt-2 flex flex-wrap gap-1.5"
            >
              <Tag
                v-for="material in row.materials"
                :key="material.id"
                color="cyan"
                :closable="canManage"
                class="flex items-center gap-1 text-xs"
                @close.prevent="handleUnlinkMaterial(row, material.id)"
              >
                <span>{{ material.title }}</span>
                <span class="text-[10px] opacity-75"
                  >({{ t(`projectKnowledge.materialType${material.type}`) }})</span
                >
              </Tag>
            </div>
          </div>

          <div
            class="flex shrink-0 items-center justify-between gap-3 pt-1 sm:flex-col sm:items-end sm:pt-0"
          >
            <div class="knowledge-ledger__date flex items-center gap-1 text-xs text-slate-400">
              <ClockCircleOutlined class="text-[11px]" />
              <span>{{ formatKnowledgeDate(row.occurredAt || row.updatedAt, locale) }}</span>
            </div>
            <div v-if="canManage" class="knowledge-ledger__actions">
              <Space :size="4">
                <Button type="link" size="small" @click="openMaterialPicker(row)">
                  <LinkOutlined />{{ t('projectKnowledge.researchLinkMaterials') }}
                </Button>
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

    <Modal
      v-model:open="pickerOpen"
      :title="t('projectKnowledge.linkMaterialsTitle')"
      :ok-text="t('common.confirm')"
      :cancel-text="t('common.cancel')"
      :confirm-loading="linking"
      width="560px"
      @ok="handleLinkMaterials"
    >
      <div v-if="!allMaterials.length" class="knowledge-state">
        {{ t('projectKnowledge.linkMaterialsEmpty') }}
      </div>
      <div v-else class="material-picker-list space-y-3 pt-1">
        <Input
          v-model:value="materialSearchKeyword"
          :placeholder="t('common.search')"
          allow-clear
          class="mb-2"
        />
        <div
          class="max-h-72 overflow-y-auto rounded-md border border-slate-200 p-2 dark:border-slate-700"
        >
          <CheckboxGroup
            v-model:value="selectedMaterialIds"
            class="material-picker-list__group flex w-full flex-col gap-2"
          >
            <div
              v-for="material in filteredMaterials"
              :key="material.id"
              class="material-picker-item flex items-center justify-between rounded-md p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Checkbox :value="material.id" class="truncate text-xs">
                {{ material.title }}
              </Checkbox>
              <Tag color="blue" class="text-[11px]">{{
                t(`projectKnowledge.materialType${material.type}`)
              }}</Tag>
            </div>
          </CheckboxGroup>
        </div>
      </div>
    </Modal>

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
