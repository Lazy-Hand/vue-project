<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Button,
  Checkbox,
  Empty,
  Input,
  Modal,
  Progress,
  Spin,
  Tag,
  UploadDragger,
  message,
  type UploadProps,
} from 'antdv-next'
import {
  CloudUploadOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FileAddOutlined,
  FolderOpenOutlined,
  InboxOutlined,
} from '@antdv-next/icons'

import {
  discardProjectFileAsset,
  downloadProjectFileAsset,
  fetchProjectFileAssets,
  uploadProjectFileAsset,
} from '@/api/project-file'
import { usePermission } from '@/composables/usePermission'
import type { ProjectFileAsset, ProjectFileAssetKind } from '@/types/project-file'
import { formatBytes, validateFile } from '@/components/FileUpload/utils'

interface Props {
  projectId: string
  modelValue: ProjectFileAsset[]
  kind: ProjectFileAssetKind
  disabled?: boolean
  maxCount?: number
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  maxCount: 20,
})

const emit = defineEmits<{
  'update:modelValue': [value: ProjectFileAsset[]]
}>()

export interface ProjectFilePickerExpose {
  prepareFiles: () => Promise<string[]>
  commitFiles: () => void
  rollbackFiles: () => Promise<void>
  resetFiles: () => void
}

type UploadBeforeFile = Parameters<NonNullable<UploadProps['beforeUpload']>>[0]
type QueueStatus = 'queued' | 'uploading' | 'success' | 'error'

interface QueueItem {
  uid: string
  file: File
  status: QueueStatus
  percent: number
}

const { t } = useI18n()
const { hasPermission } = usePermission()
const queue = ref<QueueItem[]>([])
const preparing = ref(false)
const libraryOpen = ref(false)
const libraryLoading = ref(false)
const libraryKeyword = ref('')
const libraryAssets = ref<ProjectFileAsset[]>([])
const libraryCheckedIds = ref<string[]>([])
const createdAssetIds = new Set<string>()
let uidSeed = 0

const selectedAssets = ref<ProjectFileAsset[]>([...props.modelValue])
const canQueryFiles = computed(() => hasPermission('system:project:queryFiles'))
const canManageFiles = computed(() => hasPermission('system:project:manageFiles'))
const selectedIds = computed(() => new Set(selectedAssets.value.map((asset) => asset.id)))
const effectiveMaxCount = computed(() => Math.max(1, Math.floor(props.maxCount)))
const atCapacity = computed(
  () => selectedAssets.value.length + queue.value.length >= effectiveMaxCount.value,
)
const filteredLibraryAssets = computed(() => {
  const keyword = libraryKeyword.value.trim().toLocaleLowerCase()
  if (!keyword) return libraryAssets.value
  return libraryAssets.value.filter((asset) =>
    asset.file.originalName.toLocaleLowerCase().includes(keyword),
  )
})

function updateSelected(assets: ProjectFileAsset[]): void {
  const next = assets.slice(0, effectiveMaxCount.value)
  selectedAssets.value = next
  emit('update:modelValue', next)
}

watch(
  () => props.modelValue,
  (assets) => {
    selectedAssets.value = [...assets]
  },
)

function queueStatusLabel(item: QueueItem): string {
  if (item.status === 'uploading') {
    return t('projectFile.statusUploading', { percent: item.percent })
  }
  return t(`projectFile.status${item.status.charAt(0).toUpperCase()}${item.status.slice(1)}`)
}

function assetStatusColor(asset: ProjectFileAsset): string {
  if (asset.status === 'ACTIVE') return 'green'
  if (asset.status === 'STAGED') return 'blue'
  if (asset.status === 'DELETE_FAILED') return 'red'
  return 'default'
}

function assetStatusLabel(asset: ProjectFileAsset): string {
  return t(`projectFile.assetStatus${asset.status}`)
}

function handleBeforeUpload(uploadFile: UploadBeforeFile): false {
  if (!canManageFiles.value) return false
  const file = uploadFile as unknown as File
  if (atCapacity.value) {
    message.warning(t('projectFile.maxCount', { count: effectiveMaxCount.value }))
    return false
  }
  const validation = validateFile(file, 'FILE')
  if (!validation.valid) {
    message.warning(t('projectFile.invalidFile'))
    return false
  }
  uidSeed += 1
  queue.value = [
    ...queue.value,
    { uid: `project-file-${uidSeed}`, file, status: 'queued', percent: 0 },
  ]
  return false
}

function removeQueueItem(uid: string): void {
  if (preparing.value) return
  queue.value = queue.value.filter((item) => item.uid !== uid)
}

async function removeAsset(asset: ProjectFileAsset): Promise<void> {
  if (preparing.value || props.disabled) return
  if (createdAssetIds.has(asset.id)) {
    try {
      await discardProjectFileAsset(props.projectId, asset.id)
      createdAssetIds.delete(asset.id)
    } catch {
      message.error(t('projectFile.discardFailed'))
      return
    }
  }
  updateSelected(selectedAssets.value.filter((item) => item.id !== asset.id))
}

async function loadLibrary(): Promise<void> {
  libraryLoading.value = true
  try {
    const result = await fetchProjectFileAssets(props.projectId, {
      page: 1,
      pageSize: 100,
      kind: props.kind,
    })
    libraryAssets.value = result.items
  } catch {
    message.error(t('projectFile.libraryLoadFailed'))
  } finally {
    libraryLoading.value = false
  }
}

function openLibrary(): void {
  if (!canQueryFiles.value || !canManageFiles.value) return
  libraryKeyword.value = ''
  libraryCheckedIds.value = []
  libraryOpen.value = true
  void loadLibrary()
}

function toggleLibraryAsset(asset: ProjectFileAsset): void {
  if (selectedIds.value.has(asset.id)) return
  const checked = new Set(libraryCheckedIds.value)
  if (checked.has(asset.id)) checked.delete(asset.id)
  else checked.add(asset.id)
  libraryCheckedIds.value = [...checked]
}

function confirmLibrary(): void {
  const additions = libraryAssets.value.filter((asset) =>
    libraryCheckedIds.value.includes(asset.id),
  )
  const available = effectiveMaxCount.value - selectedAssets.value.length - queue.value.length
  if (additions.length > available) {
    message.warning(t('projectFile.maxCount', { count: effectiveMaxCount.value }))
    return
  }
  updateSelected([...selectedAssets.value, ...additions])
  libraryOpen.value = false
}

async function handleDownload(asset: ProjectFileAsset): Promise<void> {
  if (!canQueryFiles.value) return
  if (asset.status !== 'ACTIVE') {
    message.info(t('projectFile.downloadAfterSave'))
    return
  }
  try {
    await downloadProjectFileAsset(props.projectId, asset)
  } catch {
    message.error(t('projectFile.downloadFailed'))
  }
}

async function prepareFiles(): Promise<string[]> {
  if (preparing.value) return selectedAssets.value.map((asset) => asset.id)
  preparing.value = true
  try {
    for (const item of queue.value) {
      if (item.status === 'success') continue
      item.status = 'uploading'
      item.percent = 0
      try {
        const asset = await uploadProjectFileAsset(
          props.projectId,
          item.file,
          props.kind,
          (progress) => {
            item.percent = progress.percent
          },
        )
        item.status = 'success'
        item.percent = 100
        createdAssetIds.add(asset.id)
        if (!selectedIds.value.has(asset.id)) updateSelected([...selectedAssets.value, asset])
      } catch (error) {
        item.status = 'error'
        throw error
      }
    }
    return selectedAssets.value.map((asset) => asset.id)
  } catch (error) {
    await rollbackFiles()
    throw error
  } finally {
    preparing.value = false
  }
}

function commitFiles(): void {
  createdAssetIds.clear()
  queue.value = []
}

async function rollbackFiles(): Promise<void> {
  const ids = [...createdAssetIds]
  if (ids.length) {
    await Promise.allSettled(ids.map((id) => discardProjectFileAsset(props.projectId, id)))
  }
  createdAssetIds.clear()
  updateSelected(selectedAssets.value.filter((asset) => !ids.includes(asset.id)))
  queue.value = queue.value.map((item) => ({ ...item, status: 'queued', percent: 0 }))
}

function resetFiles(): void {
  queue.value = []
  libraryCheckedIds.value = []
}

defineExpose<ProjectFilePickerExpose>({ prepareFiles, commitFiles, rollbackFiles, resetFiles })
</script>

<template>
  <section class="project-file-picker" :aria-label="t('projectFile.title')">
    <div class="project-file-picker__toolbar">
      <div>
        <div class="project-file-picker__title">{{ t('projectFile.title') }}</div>
        <div class="project-file-picker__hint">{{ t('projectFile.hint') }}</div>
      </div>
      <Button
        :disabled="props.disabled || !canManageFiles || !canQueryFiles || atCapacity || preparing"
        @click="openLibrary"
      >
        <template #icon><FolderOpenOutlined /></template>
        {{ t('projectFile.chooseExisting') }}
      </Button>
    </div>

    <UploadDragger
      :multiple="true"
      :max-count="effectiveMaxCount"
      :disabled="props.disabled || !canManageFiles || atCapacity || preparing"
      :before-upload="handleBeforeUpload"
      :show-upload-list="false"
      class="project-file-picker__dragger"
    >
      <div class="project-file-picker__drop-content">
        <InboxOutlined class="project-file-picker__drop-icon" />
        <div>
          <div class="project-file-picker__drop-title">{{ t('projectFile.dropTitle') }}</div>
          <div class="project-file-picker__drop-hint">
            {{ t('projectFile.dropHint', { count: effectiveMaxCount }) }}
          </div>
        </div>
      </div>
    </UploadDragger>

    <div v-if="queue.length" class="project-file-picker__section">
      <div class="project-file-picker__section-title">
        <CloudUploadOutlined />
        {{ t('projectFile.pendingUploads') }}
      </div>
      <div class="project-file-picker__list">
        <div v-for="item in queue" :key="item.uid" class="project-file-picker__item">
          <div class="project-file-picker__file-icon"><FileAddOutlined /></div>
          <div class="project-file-picker__item-main">
            <div class="project-file-picker__item-line">
              <span class="project-file-picker__name" :title="item.file.name">{{
                item.file.name
              }}</span>
              <span class="project-file-picker__meta">{{ formatBytes(item.file.size) }}</span>
            </div>
            <Progress
              v-if="item.status === 'uploading' || item.status === 'success'"
              :percent="item.percent"
              :show-info="false"
              size="small"
              :status="item.status === 'success' ? 'success' : 'active'"
            />
            <span class="project-file-picker__status">{{ queueStatusLabel(item) }}</span>
          </div>
          <Button
            type="text"
            danger
            :disabled="!canManageFiles || preparing"
            :aria-label="t('projectFile.remove')"
            @click="removeQueueItem(item.uid)"
          >
            <DeleteOutlined />
          </Button>
        </div>
      </div>
    </div>

    <div v-if="selectedAssets.length" class="project-file-picker__section">
      <div class="project-file-picker__section-title">
        <FolderOpenOutlined />
        {{ t('projectFile.selectedFiles', { count: selectedAssets.length }) }}
      </div>
      <div class="project-file-picker__list">
        <div v-for="asset in selectedAssets" :key="asset.id" class="project-file-picker__item">
          <div class="project-file-picker__file-icon"><FileAddOutlined /></div>
          <div class="project-file-picker__item-main">
            <div class="project-file-picker__item-line">
              <span class="project-file-picker__name" :title="asset.file.originalName">
                {{ asset.file.originalName }}
              </span>
              <Tag :color="assetStatusColor(asset)">{{ assetStatusLabel(asset) }}</Tag>
            </div>
            <span class="project-file-picker__meta">{{ formatBytes(asset.file.size) }}</span>
          </div>
          <Button
            type="text"
            :disabled="!canQueryFiles"
            :aria-label="t('projectFile.download')"
            @click="void handleDownload(asset)"
          >
            <DownloadOutlined />
          </Button>
          <Button
            type="text"
            danger
            :disabled="props.disabled || !canManageFiles || preparing"
            :aria-label="t('projectFile.remove')"
            @click="void removeAsset(asset)"
          >
            <DeleteOutlined />
          </Button>
        </div>
      </div>
    </div>

    <Modal
      v-model:open="libraryOpen"
      :title="t('projectFile.libraryTitle')"
      width="680px"
      :get-container="false"
      :ok-text="t('projectFile.addSelected')"
      :cancel-text="t('common.cancel')"
      @ok="confirmLibrary"
    >
      <Input.Search
        v-model:value="libraryKeyword"
        allow-clear
        :placeholder="t('projectFile.searchPlaceholder')"
        class="project-file-picker__search"
      />
      <Spin :spinning="libraryLoading">
        <div v-if="filteredLibraryAssets.length" class="project-file-picker__library">
          <button
            v-for="asset in filteredLibraryAssets"
            :key="asset.id"
            type="button"
            class="project-file-picker__library-item"
            :class="{ 'is-selected': libraryCheckedIds.includes(asset.id) }"
            :disabled="selectedIds.has(asset.id)"
            @click="toggleLibraryAsset(asset)"
          >
            <Checkbox
              :checked="selectedIds.has(asset.id) || libraryCheckedIds.includes(asset.id)"
              :disabled="selectedIds.has(asset.id)"
              @click.stop="toggleLibraryAsset(asset)"
            />
            <div class="project-file-picker__item-main">
              <div class="project-file-picker__item-line">
                <span class="project-file-picker__name">{{ asset.file.originalName }}</span>
                <Tag :color="assetStatusColor(asset)">{{ assetStatusLabel(asset) }}</Tag>
              </div>
              <span class="project-file-picker__meta">
                {{ formatBytes(asset.file.size) }} · {{ t(`projectFile.kind${asset.kind}`) }}
              </span>
            </div>
          </button>
        </div>
        <Empty v-else :description="t('projectFile.libraryEmpty')" />
      </Spin>
    </Modal>
  </section>
</template>

<style scoped lang="scss">
.project-file-picker {
  display: grid;
  gap: 12px;

  &__toolbar,
  &__item-line {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  &__title {
    color: #172033;
    font-weight: 600;
  }

  &__hint,
  &__meta,
  &__status {
    color: #8491a7;
    font-size: 12px;
  }

  &__dragger {
    :deep(.ant-upload-drag) {
      border-color: #c7d4e8;
      background: #f7faff;
    }
  }

  &__drop-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 12px;
    text-align: left;
  }

  &__drop-icon {
    color: #2f6feb;
    font-size: 28px;
  }

  &__drop-title,
  &__section-title {
    color: #35435a;
    font-weight: 600;
  }

  &__drop-hint {
    margin-top: 2px;
    color: #8b99ad;
    font-size: 12px;
  }

  &__section {
    display: grid;
    gap: 8px;
  }

  &__section-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
  }

  &__list {
    overflow: hidden;
    border: 1px solid #e3eaf4;
    border-radius: 10px;
  }

  &__item,
  &__library-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 12px;
    background: #fff;
    border: 0;
    border-bottom: 1px solid #edf1f7;
    text-align: left;

    &:last-child {
      border-bottom: 0;
    }
  }

  &__file-icon {
    display: grid;
    flex: 0 0 32px;
    width: 32px;
    height: 32px;
    place-items: center;
    color: #2869df;
    background: #edf4ff;
    border-radius: 8px;
  }

  &__item-main {
    min-width: 0;
    flex: 1;
  }

  &__name {
    overflow: hidden;
    color: #273449;
    font-size: 13px;
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__search {
    margin-bottom: 12px;
  }

  &__library {
    max-height: 380px;
    overflow-y: auto;
    border: 1px solid #e3eaf4;
    border-radius: 10px;
  }

  &__library-item {
    cursor: pointer;

    &:hover,
    &.is-selected {
      background: #f2f7ff;
    }

    &:disabled {
      cursor: default;
      opacity: 0.6;
    }
  }
}
</style>
