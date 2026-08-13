<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Component } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Button,
  DateRangePicker,
  Empty,
  Image,
  Input,
  Modal,
  Segmented,
  Tag,
  Tooltip,
  message,
} from 'antdv-next'
import {
  AudioOutlined,
  FileOutlined,
  PictureOutlined,
  UploadOutlined,
  VideoCameraOutlined,
} from '@antdv-next/icons'

import { buildFileUrl, deleteFile, fetchFileList } from '@/api/file'
import FileUpload from '@/components/FileUpload/index.vue'
import ProTable from '@/components/ProTable/index.vue'
import ProTableActions from '@/components/ProTableActions/index.vue'
import { usePermission } from '@/composables/usePermission'
import type { ManagedFile, FileCategory } from '@/types/file'
import type {
  ProTableAction,
  ProTableColumn,
  ProTableExpose,
  ProTableRequestParams,
  ProTableSearchField,
} from '@/types/pro-table'
import { ApiRequestError } from '@/utils/request'
import { categoryColor, formatFileSize, isImageFile, mapFileListQuery } from './utils'

const { locale, t } = useI18n()
const { hasPermission, hasAnyPermission } = usePermission()

const CATEGORY_KEYS = ['FILE', 'IMAGE', 'AUDIO', 'VIDEO'] as const
type CategoryKey = (typeof CATEGORY_KEYS)[number]

const CATEGORY_VALUES: Record<CategoryKey, FileCategory> = {
  FILE: 'FILE' as FileCategory,
  IMAGE: 'IMAGE' as FileCategory,
  AUDIO: 'AUDIO' as FileCategory,
  VIDEO: 'VIDEO' as FileCategory,
}

const CATEGORY_UPLOAD_PERMISSIONS: Record<CategoryKey, string> = {
  FILE: 'system:file:upload',
  IMAGE: 'system:file:uploadImage',
  AUDIO: 'system:file:uploadAudio',
  VIDEO: 'system:file:uploadVideo',
}

const tableRef = ref<ProTableExpose<ManagedFile> | null>(null)
const uploadVisible = ref(false)
const activeUploadCategory = ref<FileCategory>(CATEGORY_VALUES.FILE)
const uploadBusinessType = ref('')
const uploadBusinessId = ref('')
const previewVisible = ref(false)
const previewSrc = ref('')
const previewName = ref('')

const canQuery = computed(() => hasPermission('system:file:query'))
const canDelete = computed(() => hasPermission('system:file:delete'))
const permittedUploadCategories = computed(() =>
  CATEGORY_KEYS.map((key) => CATEGORY_VALUES[key]).filter((category) =>
    hasPermission(CATEGORY_UPLOAD_PERMISSIONS[categoryKey(category)]),
  ),
)
const canUpload = computed(() => hasAnyPermission(Object.values(CATEGORY_UPLOAD_PERMISSIONS)))

const categoryOptions = computed(() =>
  CATEGORY_KEYS.map((key) => ({
    label: t(`file.category.${key}`),
    value: CATEGORY_VALUES[key],
  })),
)

const uploadCategoryOptions = computed(() =>
  CATEGORY_KEYS.filter((key) => hasPermission(CATEGORY_UPLOAD_PERMISSIONS[key])).map((key) => ({
    label: t(`file.category.${key}`),
    value: CATEGORY_VALUES[key],
  })),
)

const searchFields = computed<ProTableSearchField[]>(() => [
  {
    prop: 'keyword',
    label: t('file.keyword'),
    type: 'input',
    placeholder: t('file.searchPlaceholder'),
    defaultValue: '',
  },
  {
    prop: 'category',
    label: t('file.categoryLabel'),
    type: 'select',
    options: categoryOptions.value,
    placeholder: t('file.categoryPlaceholder'),
    defaultValue: null,
  },
  {
    prop: 'businessType',
    label: t('file.businessType'),
    type: 'input',
    placeholder: t('file.businessTypePlaceholder'),
    defaultValue: '',
  },
  {
    prop: 'businessId',
    label: t('file.businessId'),
    type: 'input',
    placeholder: t('file.businessIdPlaceholder'),
    defaultValue: '',
  },
  {
    prop: 'dateRange',
    label: t('file.timeRange'),
    type: 'slot',
    slot: 'dateRange',
    defaultValue: null,
    searchOnChange: false,
    fieldClass: 'file-page__date-range-field',
  },
])

const columns = computed<ProTableColumn<ManagedFile>[]>(() => [
  {
    key: 'originalName',
    prop: 'originalName',
    label: t('file.originalName'),
    minWidth: 220,
    type: 'slot',
    slot: 'originalName',
    showOverflowTooltip: true,
  },
  {
    key: 'category',
    prop: 'category',
    label: t('file.categoryLabel'),
    width: 130,
    type: 'slot',
    slot: 'category',
  },
  {
    prop: 'mimeType',
    label: t('file.mimeType'),
    minWidth: 170,
    showOverflowTooltip: true,
  },
  {
    prop: 'size',
    label: t('file.size'),
    width: 110,
    align: 'right',
    formatter: (row) => formatFileSize(row.size),
  },
  {
    prop: 'businessType',
    label: t('file.businessType'),
    minWidth: 150,
    showOverflowTooltip: true,
  },
  {
    prop: 'businessId',
    label: t('file.businessId'),
    minWidth: 150,
    showOverflowTooltip: true,
  },
  {
    prop: 'createdAt',
    label: t('file.createdAt'),
    minWidth: 175,
    formatter: (row) => formatDateTime(row.createdAt, locale.value),
  },
  {
    prop: 'updatedAt',
    label: t('file.updatedAt'),
    minWidth: 175,
    formatter: (row) => formatDateTime(row.updatedAt, locale.value),
  },
  {
    key: 'actions',
    label: t('common.actions'),
    width: 220,
    fixed: 'right',
    type: 'slot',
    slot: 'actions',
  },
])

const fileActions = computed<ProTableAction<ManagedFile>[]>(() => [
  {
    key: 'preview',
    label: t('file.preview'),
    placement: 'inline',
    visible: (row) => isImageFile(row),
    onClick: openPreview,
  },
  {
    key: 'open',
    label: t('file.open'),
    placement: 'inline',
    onClick: openFile,
  },
  {
    key: 'download',
    label: t('file.download'),
    onClick: downloadFile,
  },
  {
    key: 'delete',
    label: t('common.delete'),
    danger: true,
    visible: canDelete.value,
    onClick: handleDelete,
  },
])

function categoryKey(category: FileCategory | string | null | undefined): CategoryKey {
  const normalized = String(category).toUpperCase()
  return CATEGORY_KEYS.includes(normalized as CategoryKey) ? (normalized as CategoryKey) : 'FILE'
}

function categoryLabel(category: FileCategory | string | null | undefined): string {
  const normalized = String(category).toUpperCase()
  return CATEGORY_KEYS.includes(normalized as CategoryKey)
    ? t(`file.category.${normalized}`)
    : t('file.category.unknown')
}

function categoryIcon(category: FileCategory | string | null | undefined): Component {
  switch (categoryKey(category)) {
    case 'IMAGE':
      return PictureOutlined
    case 'AUDIO':
      return AudioOutlined
    case 'VIDEO':
      return VideoCameraOutlined
    default:
      return FileOutlined
  }
}

function fileName(file: ManagedFile): string {
  return file.originalName || t('file.unnamed')
}

function formatDateTime(value: string, localeCode: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  try {
    return new Intl.DateTimeFormat(localeCode, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date)
  } catch {
    return value
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message
  if (error instanceof Error) return error.message
  return t('file.requestFailed')
}

function handleRequestError(error: unknown): void {
  message.error(errorMessage(error))
}

async function requestFiles(params: ProTableRequestParams) {
  if (!canQuery.value) return { items: [], total: 0 }
  return fetchFileList(mapFileListQuery(params))
}

function openUpload(): void {
  const firstCategory = permittedUploadCategories.value[0]
  if (firstCategory) activeUploadCategory.value = firstCategory
  uploadVisible.value = true
}

function handleUploadSuccess(): void {
  message.success(t('file.uploadSuccess'))
  void tableRef.value?.reload()
}

function handleUploadError(error: unknown): void {
  message.error(errorMessage(error))
}

function acceptForCategory(category: FileCategory | string): string | undefined {
  switch (categoryKey(category)) {
    case 'IMAGE':
      return 'image/*'
    case 'AUDIO':
      return 'audio/*'
    case 'VIDEO':
      return 'video/*'
    default:
      return undefined
  }
}

function fileUrl(file: ManagedFile): string {
  return buildFileUrl(file.path)
}

function openFile(file: ManagedFile): void {
  const url = fileUrl(file)
  window.open(url, '_blank', 'noopener,noreferrer')
}

function downloadFile(file: ManagedFile): void {
  const link = document.createElement('a')
  link.href = fileUrl(file)
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.download = fileName(file)
  link.click()
}

function openPreview(file: ManagedFile): void {
  previewSrc.value = fileUrl(file)
  previewName.value = fileName(file)
  previewVisible.value = true
}

async function handleDelete(file: ManagedFile): Promise<void> {
  const confirmed = await new Promise<boolean>((resolve) => {
    Modal.confirm({
      title: t('common.tip'),
      content: t('file.deleteConfirm', { name: fileName(file) }),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      okType: 'danger',
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
  if (!confirmed) return

  try {
    await deleteFile(file.id)
    message.success(t('file.deleteSuccess'))
    await tableRef.value?.reload()
  } catch (error) {
    message.error(errorMessage(error))
  }
}

function handleDateRangeChange(
  dates: unknown[] | null,
  setValue: (value: string[] | null) => void,
  search: () => Promise<void>,
): void {
  if (!dates || dates.length < 2) {
    setValue(null)
    void search()
    return
  }

  const values = dates.map((value) => {
    if (value instanceof Date) return value.toISOString()
    if (typeof value === 'object' && value !== null && 'toISOString' in value) {
      const toISOString = value.toISOString
      return typeof toISOString === 'function' ? toISOString.call(value) : ''
    }
    return ''
  })
  if (!values[0] || !values[1]) {
    setValue(null)
    return
  }
  setValue([values[0], values[1]])
  void search()
}
</script>

<template>
  <div class="file-page">
    <ProTable
      ref="tableRef"
      :columns="columns"
      :search-fields="searchFields"
      :request="requestFiles"
      :immediate="canQuery"
      :show-request-error="false"
      @request-error="handleRequestError"
    >
      <template #toolbar-actions>
        <Button v-if="canUpload" type="primary" @click="openUpload">
          <UploadOutlined />
          {{ t('file.upload') }}
        </Button>
      </template>

      <template #search-dateRange="{ setValue, search }">
        <DateRangePicker
          class="file-page__date-range"
          show-time
          :placeholder="[t('file.startTime'), t('file.endTime')]"
          @change="handleDateRangeChange($event, setValue, search)"
        />
      </template>

      <template #column-originalName="{ row }">
        <Tooltip :title="fileName(row)">
          <span class="file-page__truncate">{{ fileName(row) }}</span>
        </Tooltip>
      </template>

      <template #column-category="{ row }">
        <Tag :color="categoryColor(row.category)" class="file-page__category-tag">
          <component :is="categoryIcon(row.category)" />
          {{ categoryLabel(row.category) }}
        </Tag>
      </template>

      <template #column-actions="{ row }">
        <ProTableActions :row="row" :actions="fileActions" />
      </template>

      <template #empty>
        <div class="file-page__empty">
          <Empty :description="t('file.empty')" />
          <Button v-if="canUpload" type="primary" @click="openUpload">
            <UploadOutlined />
            {{ t('file.upload') }}
          </Button>
        </div>
      </template>
    </ProTable>

    <Modal
      v-model:open="uploadVisible"
      :title="t('file.uploadTitle')"
      width="640px"
      destroy-on-hidden
      :footer="null"
    >
      <div class="file-page__upload-intro">
        <div class="file-page__upload-kicker">{{ t('file.uploadKicker') }}</div>
        <p>{{ t('file.uploadHint') }}</p>
      </div>

      <Segmented
        v-model:value="activeUploadCategory"
        block
        :options="uploadCategoryOptions"
        class="file-page__category-switcher"
      />

      <div class="file-page__upload-fields">
        <label class="file-page__upload-field">
          <span>{{ t('file.businessType') }}</span>
          <Input
            v-model:value="uploadBusinessType"
            :placeholder="t('file.businessTypePlaceholder')"
          />
        </label>
        <label class="file-page__upload-field">
          <span>{{ t('file.businessId') }}</span>
          <Input v-model:value="uploadBusinessId" :placeholder="t('file.businessIdPlaceholder')" />
        </label>
      </div>

      <FileUpload
        :key="String(activeUploadCategory)"
        :category="activeUploadCategory"
        multiple
        :max-count="20"
        :business-type="uploadBusinessType.trim() || undefined"
        :business-id="uploadBusinessId.trim() || undefined"
        :accept="acceptForCategory(activeUploadCategory)"
        auto-upload
        @success="handleUploadSuccess"
        @error="handleUploadError"
      />
    </Modal>

    <Modal
      v-model:open="previewVisible"
      :title="previewName"
      width="760px"
      destroy-on-hidden
      :footer="null"
    >
      <div class="file-page__preview">
        <Image :src="previewSrc" :alt="previewName" :preview="false" />
      </div>
    </Modal>
  </div>
</template>

<style scoped lang="scss">
.file-page {
  min-width: 0;
}

.file-page__date-range {
  width: 330px;
}

.file-page__truncate {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: bottom;
  white-space: nowrap;
}

.file-page__category-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.file-page__upload-intro {
  padding: 14px 16px;
  margin-bottom: 16px;
  border: 1px solid var(--app-border-color-lighter);
  border-radius: 10px;
  background: linear-gradient(135deg, var(--app-fill-color-light), transparent);
}

.file-page__upload-kicker {
  color: var(--app-color-primary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.file-page__upload-intro p {
  margin: 5px 0 0;
  color: var(--app-text-color-secondary);
  line-height: 1.6;
}

.file-page__category-switcher {
  margin-bottom: 18px;
}

.file-page__upload-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}

.file-page__upload-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--app-text-color-secondary);
  font-size: 12px;
}

.file-page__preview {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 320px;
  padding: 16px;
  background: var(--app-fill-color-light);
  border-radius: 8px;
}

.file-page__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.file-page__preview :deep(.ant-image) {
  max-width: 100%;
}

@media (max-width: 720px) {
  .file-page__date-range {
    width: 100%;
  }

  .file-page__upload-fields {
    grid-template-columns: 1fr;
  }
}
</style>
