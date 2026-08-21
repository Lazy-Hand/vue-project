<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Modal, message } from 'antdv-next'

import { createClient, deleteClient, fetchClientList, updateClient } from '@/api/client'
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
import type { Client, ClientPayload, UpdateClientPayload } from '@/types/client'
import { ApiRequestError } from '@/utils/request'
import ClientFormDialog from './ClientFormDialog.vue'

const { locale, t } = useI18n()
const { hasPermission } = usePermission()

const tableRef = ref<ProTableExpose<Client> | null>(null)
const formVisible = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editingClient = ref<Client | null>(null)
const formDialogRef = ref<InstanceType<typeof ClientFormDialog> | null>(null)

const canCreate = computed(() => hasPermission('system:client:create'))
const canUpdate = computed(() => hasPermission('system:client:update'))
const canDelete = computed(() => hasPermission('system:client:delete'))

function formatDateTime(value: string, localeCode: string): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  try {
    return new Intl.DateTimeFormat(localeCode, { dateStyle: 'medium', timeStyle: 'short' }).format(
      d,
    )
  } catch {
    return value
  }
}

const searchFields = computed<ProTableSearchField[]>(() => [
  {
    prop: 'keyword',
    label: t('client.keyword'),
    type: 'input',
    placeholder: t('client.searchPlaceholder'),
    defaultValue: '',
  },
])

const columns = computed<ProTableColumn<Client>[]>(() => [
  { prop: 'code', label: t('client.code'), minWidth: 140, showOverflowTooltip: true },
  { prop: 'name', label: t('client.name'), minWidth: 160, showOverflowTooltip: true },
  { prop: 'contactName', label: t('client.contactName'), minWidth: 120, showOverflowTooltip: true },
  {
    prop: 'contactPhone',
    label: t('client.contactPhone'),
    minWidth: 130,
    showOverflowTooltip: true,
  },
  {
    prop: 'contactEmail',
    label: t('client.contactEmail'),
    minWidth: 160,
    showOverflowTooltip: true,
  },
  { prop: 'enabled', label: t('client.enabled'), width: 90, type: 'tag' },
  {
    prop: 'createdAt',
    label: t('client.createdAt'),
    minWidth: 170,
    formatter: (row) => formatDateTime(row.createdAt, locale.value),
  },
  {
    prop: 'updatedAt',
    label: t('client.updatedAt'),
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

const clientActions = computed<ProTableAction<Client>[]>(() => [
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
  return t('client.requestFailed')
}

function handleRequestError(error: unknown): void {
  message.error(errorMessage(error))
}

async function requestClients(params: ProTableRequestParams) {
  return fetchClientList({
    page: params.page,
    pageSize: params.pageSize,
    keyword: String(params.keyword ?? '').trim() || undefined,
  })
}

function openCreate(): void {
  formMode.value = 'create'
  editingClient.value = null
  formVisible.value = true
}

function openEdit(row: Client): void {
  formMode.value = 'edit'
  editingClient.value = row
  formVisible.value = true
}

async function handleFormSubmit(payload: ClientPayload | UpdateClientPayload): Promise<void> {
  formDialogRef.value?.setSubmitting(true)
  try {
    if (formMode.value === 'create') {
      await createClient(payload as ClientPayload)
      message.success(t('client.createSuccess'))
    } else if (editingClient.value) {
      await updateClient(editingClient.value.id, payload as UpdateClientPayload)
      message.success(t('client.updateSuccess'))
    }
    formVisible.value = false
    await tableRef.value?.reload()
  } catch (error) {
    message.error(errorMessage(error))
  } finally {
    formDialogRef.value?.setSubmitting(false)
  }
}

async function handleDelete(row: Client): Promise<void> {
  const confirmed = await new Promise<boolean>((resolve) => {
    Modal.confirm({
      title: t('common.tip'),
      content: t('client.deleteConfirm', { name: row.name }),
      okType: 'danger',
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
  if (!confirmed) return
  try {
    await deleteClient(row.id)
    message.success(t('client.deleteSuccess'))
    await tableRef.value?.reload()
  } catch (error) {
    message.error(errorMessage(error))
  }
}
</script>

<template>
  <div class="client-page">
    <ProTable
      ref="tableRef"
      :columns="columns"
      :search-fields="searchFields"
      :request="requestClients"
      :show-request-error="false"
      @request-error="handleRequestError"
    >
      <template #toolbar-actions>
        <Button v-if="canCreate" type="primary" @click="openCreate">
          {{ t('client.create') }}
        </Button>
      </template>

      <template #column-actions="{ row }">
        <ProTableActions :row="row" :actions="clientActions" />
      </template>
    </ProTable>

    <ClientFormDialog
      ref="formDialogRef"
      v-model="formVisible"
      :mode="formMode"
      :editing="editingClient"
      @submit="handleFormSubmit"
    />
  </div>
</template>

<style scoped lang="scss">
.client-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  min-height: 0;
}
</style>
