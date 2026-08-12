<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Modal, message } from 'antdv-next'

import {
  createSystemConfig,
  deleteSystemConfig,
  fetchSystemConfigList,
  updateSystemConfig,
} from '@/api/system-config'
import ProTable from '@/components/ProTable/index.vue'
import { usePermission } from '@/composables/usePermission'
import type {
  ProTableColumn,
  ProTableExpose,
  ProTableRequestParams,
  ProTableSearchField,
} from '@/types/pro-table'
import type {
  SystemConfig,
  SystemConfigPayload,
  UpdateSystemConfigPayload,
} from '@/types/system-config'
import { ApiRequestError } from '@/utils/request'
import SystemConfigFormDialog from './SystemConfigFormDialog.vue'

const { locale, t } = useI18n()
const { hasPermission } = usePermission()

const tableRef = ref<ProTableExpose<SystemConfig> | null>(null)
const formVisible = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editingConfig = ref<SystemConfig | null>(null)
const formDialogRef = ref<InstanceType<typeof SystemConfigFormDialog> | null>(null)

const canCreate = computed(() => hasPermission('system:config:create'))
const canUpdate = computed(() => hasPermission('system:config:update'))
const canDelete = computed(() => hasPermission('system:config:delete'))

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

const searchFields = computed<ProTableSearchField[]>(() => [
  {
    prop: 'keyword',
    type: 'input',
    placeholder: t('config.searchPlaceholder'),
    defaultValue: '',
  },
])

const columns = computed<ProTableColumn<SystemConfig>[]>(() => [
  { prop: 'name', label: t('config.name'), minWidth: 160, showOverflowTooltip: true },
  { prop: 'key', label: t('config.key'), minWidth: 180, showOverflowTooltip: true },
  { prop: 'value', label: t('config.value'), minWidth: 180, showOverflowTooltip: true },
  {
    prop: 'description',
    label: t('config.description'),
    minWidth: 180,
    showOverflowTooltip: true,
  },
  { prop: 'enabled', label: t('config.enabled'), width: 90, type: 'tag' },
  {
    prop: 'createdAt',
    label: t('config.createdAt'),
    minWidth: 170,
    formatter: (row) => formatDateTime(row.createdAt, locale.value),
  },
  {
    prop: 'updatedAt',
    label: t('config.updatedAt'),
    minWidth: 170,
    formatter: (row) => formatDateTime(row.updatedAt, locale.value),
  },
  {
    key: 'actions',
    label: t('common.actions'),
    width: 150,
    fixed: 'right',
    type: 'slot',
    slot: 'actions',
  },
])

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message
  if (error instanceof Error) return error.message
  return t('config.requestFailed')
}

function handleRequestError(error: unknown): void {
  message.error(errorMessage(error))
}

async function requestConfigs(params: ProTableRequestParams) {
  return fetchSystemConfigList({
    page: params.page,
    pageSize: params.pageSize,
    keyword: String(params.keyword ?? '').trim() || undefined,
  })
}

function openCreate(): void {
  formMode.value = 'create'
  editingConfig.value = null
  formVisible.value = true
}

function openEdit(row: SystemConfig): void {
  formMode.value = 'edit'
  editingConfig.value = row
  formVisible.value = true
}

async function handleFormSubmit(
  payload: SystemConfigPayload | UpdateSystemConfigPayload,
): Promise<void> {
  formDialogRef.value?.setSubmitting(true)
  try {
    if (formMode.value === 'create') {
      await createSystemConfig(payload as SystemConfigPayload)
      message.success(t('config.createSuccess'))
    } else if (editingConfig.value) {
      await updateSystemConfig(editingConfig.value.id, payload as UpdateSystemConfigPayload)
      message.success(t('config.updateSuccess'))
    }
    formVisible.value = false
    await tableRef.value?.reload()
  } catch (error) {
    message.error(errorMessage(error))
  } finally {
    formDialogRef.value?.setSubmitting(false)
  }
}

async function handleDelete(row: SystemConfig): Promise<void> {
  const confirmed = await new Promise<boolean>((resolve) => {
    Modal.confirm({
      title: t('common.tip'),
      content: t('config.deleteConfirm', { name: row.name }),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      okType: 'danger',
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
  if (!confirmed) return

  try {
    await deleteSystemConfig(row.id)
    message.success(t('config.deleteSuccess'))
    await tableRef.value?.reload()
  } catch (error) {
    message.error(errorMessage(error))
  }
}
</script>

<template>
  <div class="config-page">
    <ProTable
      ref="tableRef"
      :columns="columns"
      :search-fields="searchFields"
      :request="requestConfigs"
      :show-request-error="false"
      @request-error="handleRequestError"
    >
      <template #toolbar-actions>
        <Button v-if="canCreate" type="primary" @click="openCreate">
          {{ t('config.create') }}
        </Button>
      </template>

      <template #column-actions="{ row }">
        <Button v-if="canUpdate" type="link" @click="openEdit(row)">
          {{ t('common.edit') }}
        </Button>
        <Button v-if="canDelete" danger type="link" @click="handleDelete(row)">
          {{ t('common.delete') }}
        </Button>
      </template>
    </ProTable>

    <SystemConfigFormDialog
      ref="formDialogRef"
      v-model="formVisible"
      :mode="formMode"
      :editing="editingConfig"
      @submit="handleFormSubmit"
    />
  </div>
</template>

<style scoped lang="scss">
.config-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
