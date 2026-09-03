<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Button,
  Form,
  FormItem,
  Input,
  Modal,
  Switch,
  Upload,
  message,
  type FormInstance,
  type Rule,
} from 'antdv-next'
import { UploadOutlined } from '@antdv-next/icons'
import type { UploadProps } from 'antdv-next'

import {
  deleteImportTemplate,
  downloadImportTemplateBlob,
  fetchImportTemplateList,
  replaceImportTemplateFile,
  updateImportTemplate,
  uploadImportTemplate,
} from '@/api/import-template'
import ProTable from '@/components/ProTable/index.vue'
import ProTableActions from '@/components/ProTableActions/index.vue'
import { usePermission } from '@/composables/usePermission'
import type { ImportTemplate, ImportTemplatePayload } from '@/types/import-template'
import type {
  ProTableAction,
  ProTableColumn,
  ProTableExpose,
  ProTableRequestParams,
  ProTableSearchField,
} from '@/types/pro-table'
import { ApiRequestError } from '@/utils/request'

const { t } = useI18n()
const { hasPermission } = usePermission()

const tableRef = ref<ProTableExpose<ImportTemplate> | null>(null)

const canQuery = computed(() => hasPermission('system:import-template:query'))
const canCreate = computed(() => hasPermission('system:import-template:create'))
const canUpdate = computed(() => hasPermission('system:import-template:update'))
const canDelete = computed(() => hasPermission('system:import-template:delete'))

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message
  if (error instanceof Error) return error.message
  return t('importTemplate.requestFailed')
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

const searchFields = computed<ProTableSearchField[]>(() => [
  {
    prop: 'keyword',
    label: t('importTemplate.keyword'),
    type: 'input',
    placeholder: t('importTemplate.searchPlaceholder'),
    defaultValue: '',
  },
  {
    prop: 'businessKey',
    label: t('importTemplate.businessKey'),
    type: 'input',
    placeholder: t('importTemplate.businessKeyPlaceholder'),
    defaultValue: '',
  },
])

const columns = computed<ProTableColumn<ImportTemplate>[]>(() => [
  { prop: 'businessKey', label: t('importTemplate.businessKey'), width: 120 },
  { prop: 'name', label: t('importTemplate.name'), minWidth: 160, showOverflowTooltip: true },
  {
    prop: 'version',
    label: t('importTemplate.version'),
    width: 90,
  },
  {
    prop: 'fileName',
    label: t('importTemplate.fileName'),
    minWidth: 160,
    showOverflowTooltip: true,
  },
  {
    prop: 'fileSize',
    label: t('importTemplate.fileSize'),
    width: 100,
    formatter: (row) => formatFileSize(Number(row.fileSize)),
  },
  { prop: 'enabled', label: t('importTemplate.enabled'), width: 90, type: 'tag' },
  {
    prop: 'createdAt',
    label: t('importTemplate.createdAt'),
    minWidth: 170,
    formatter: (row) => formatDateTime(row.createdAt),
  },
  {
    key: 'actions',
    label: t('common.actions'),
    width: 170,
    fixed: 'right',
    type: 'slot',
    slot: 'actions',
  },
])

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes)) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

const templateActions = computed<ProTableAction<ImportTemplate>[]>(() => [
  {
    key: 'download',
    label: t('importTemplate.download'),
    placement: 'inline',
    visible: canQuery.value,
    onClick: handleDownload,
  },
  {
    key: 'edit',
    label: t('common.edit'),
    placement: 'inline',
    visible: canUpdate.value,
    onClick: openEdit,
  },
  {
    key: 'delete',
    label: t('common.delete'),
    danger: true,
    visible: canDelete.value,
    onClick: handleDelete,
  },
])

async function requestTemplates(params: ProTableRequestParams) {
  return fetchImportTemplateList({
    page: params.page,
    pageSize: params.pageSize,
    keyword: String(params.keyword ?? '').trim() || undefined,
    businessKey: String(params.businessKey ?? '').trim() || undefined,
  })
}

// ==== 上传 / 编辑弹窗 ====
const dialogVisible = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const editingTemplate = ref<ImportTemplate | null>(null)
const formRef = ref<FormInstance>()
const submitting = ref(false)
const selectedFile = ref<File | null>(null)

const form = reactive({
  businessKey: '',
  name: '',
  description: '',
  enabled: true,
})

const rules = computed<Record<string, Rule[]>>(() => ({
  businessKey: [
    { required: true, message: t('importTemplate.businessKeyRequired'), trigger: 'blur' },
    { min: 2, max: 64, message: t('importTemplate.businessKeyLength'), trigger: 'blur' },
  ],
  name: [
    { required: true, message: t('importTemplate.nameRequired'), trigger: 'blur' },
    { max: 64, message: t('importTemplate.nameLength'), trigger: 'blur' },
  ],
}))

const dialogTitle = computed(() =>
  dialogMode.value === 'create' ? t('importTemplate.uploadTitle') : t('importTemplate.editTitle'),
)

function openCreate(): void {
  dialogMode.value = 'create'
  editingTemplate.value = null
  form.businessKey = ''
  form.name = ''
  form.description = ''
  form.enabled = true
  selectedFile.value = null
  dialogVisible.value = true
}

function openEdit(row: ImportTemplate): void {
  dialogMode.value = 'edit'
  editingTemplate.value = row
  form.businessKey = row.businessKey
  form.name = row.name
  form.description = row.description ?? ''
  form.enabled = row.enabled
  selectedFile.value = null
  dialogVisible.value = true
}

const handleSelectFile: UploadProps['beforeUpload'] = (file) => {
  selectedFile.value = file as File
  return false
}

async function handleSubmit(): Promise<void> {
  if (!formRef.value) return
  const valid = await formRef.value
    .validate()
    .then(() => true)
    .catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    if (dialogMode.value === 'create') {
      if (!selectedFile.value) {
        message.warning(t('importTemplate.fileRequired'))
        return
      }
      const payload: ImportTemplatePayload = {
        businessKey: form.businessKey.trim(),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
      }
      await uploadImportTemplate(payload, selectedFile.value)
      message.success(t('importTemplate.uploadSuccess'))
    } else if (editingTemplate.value) {
      if (selectedFile.value) {
        await replaceImportTemplateFile(editingTemplate.value.id, selectedFile.value)
      }
      await updateImportTemplate(editingTemplate.value.id, {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        enabled: form.enabled,
      })
      message.success(t('importTemplate.updateSuccess'))
    }
    dialogVisible.value = false
    await tableRef.value?.reload()
  } catch (error) {
    message.error(errorMessage(error))
  } finally {
    submitting.value = false
  }
}

// ==== 下载 / 删除 ====
async function handleDownload(row: ImportTemplate): Promise<void> {
  try {
    const blob = await downloadImportTemplateBlob(row.businessKey)
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = `${row.businessKey}-template-v${row.version}.xlsx`
    anchor.click()
    URL.revokeObjectURL(objectUrl)
  } catch (error) {
    message.error(errorMessage(error))
  }
}

async function handleDelete(row: ImportTemplate): Promise<void> {
  const confirmed = await new Promise<boolean>((resolve) => {
    Modal.confirm({
      title: t('importTemplate.deleteConfirm', { name: row.name }),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      okType: 'danger',
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
  if (!confirmed) return

  try {
    await deleteImportTemplate(row.id)
    message.success(t('importTemplate.deleteSuccess'))
    await tableRef.value?.reload()
  } catch (error) {
    message.error(errorMessage(error))
  }
}
</script>

<template>
  <div class="import-template-page">
    <ProTable
      ref="tableRef"
      :columns="columns"
      :search-fields="searchFields"
      :request="requestTemplates"
      :immediate="canQuery"
      :show-request-error="false"
    >
      <template #toolbar-actions>
        <Button v-if="canCreate" type="primary" @click="openCreate">
          <UploadOutlined /> {{ t('importTemplate.upload') }}
        </Button>
      </template>

      <template #column-actions="{ row }">
        <ProTableActions :row="row" :actions="templateActions" />
      </template>
    </ProTable>

    <Modal
      v-model:open="dialogVisible"
      :title="dialogTitle"
      width="520px"
      destroy-on-hidden
      :get-container="false"
      :confirm-loading="submitting"
      @ok="handleSubmit"
    >
      <Form ref="formRef" :model="form" :rules="rules" layout="vertical">
        <FormItem :label="t('importTemplate.businessKey')" name="businessKey">
          <Input
            v-model:value="form.businessKey"
            :disabled="dialogMode === 'edit'"
            :placeholder="t('importTemplate.businessKeyPlaceholder')"
          />
        </FormItem>
        <FormItem :label="t('importTemplate.name')" name="name">
          <Input
            v-model:value="form.name"
            :maxlength="64"
            show-count
            :placeholder="t('importTemplate.namePlaceholder')"
          />
        </FormItem>
        <FormItem :label="t('importTemplate.file')">
          <Upload :before-upload="handleSelectFile" :show-upload-list="false" accept=".xlsx,.xls">
            <Button :icon="undefined">
              <UploadOutlined />
              {{
                dialogMode === 'create'
                  ? selectedFile
                    ? selectedFile.name
                    : t('importTemplate.filePlaceholder')
                  : selectedFile
                    ? `${t('importTemplate.fileReplaced')}: ${selectedFile.name}`
                    : t('importTemplate.fileReplaceHint')
              }}
            </Button>
          </Upload>
        </FormItem>
        <FormItem :label="t('importTemplate.description')">
          <Input.TextArea
            v-model:value="form.description"
            :rows="2"
            :maxlength="255"
            show-count
            :placeholder="t('importTemplate.descriptionPlaceholder')"
          />
        </FormItem>
        <FormItem v-if="dialogMode === 'edit'" :label="t('importTemplate.enabled')">
          <Switch v-model:checked="form.enabled" />
        </FormItem>
      </Form>
    </Modal>
  </div>
</template>
