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
import ProTableActions from '@/components/ProTableActions/index.vue'
import { usePermission } from '@/composables/usePermission'
import type {
  ProTableAction,
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
    label: t('config.keyword'),
    type: 'input',
    placeholder: t('config.searchPlaceholder'),
    defaultValue: '',
  },
  {
    prop: 'group',
    label: t('config.group'),
    type: 'select',
    placeholder: t('config.groupFilterPlaceholder'),
    clearable: true,
    options: [
      { label: 'site', value: 'site' },
      { label: 'general', value: 'general' },
    ],
  },
])

const columns = computed<ProTableColumn<SystemConfig>[]>(() => [
  { prop: 'name', label: t('config.name'), minWidth: 160, showOverflowTooltip: true },
  { prop: 'key', label: t('config.key'), minWidth: 180, showOverflowTooltip: true },
  { prop: 'group', label: t('config.group'), width: 110 },
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
    width: 160,
    fixed: 'right',
    type: 'slot',
    slot: 'actions',
  },
])

const configActions = computed<ProTableAction<SystemConfig>[]>(() => [
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
    group: params.group ? String(params.group) : undefined,
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
        <ProTableActions :row="row" :actions="configActions" />
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
  height: 100%;
  min-height: 0;
}
</style>
