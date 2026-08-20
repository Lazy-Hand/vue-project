<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Modal, Tag, message } from 'antdv-next'

import { cancelApprovalInstance, fetchApprovalInstances } from '@/api/approval'
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
import type { ApprovalInstance } from '@/types/approval'
import { ApiRequestError } from '@/utils/request'
import InstanceDetailDrawer from './InstanceDetailDrawer.vue'
import InstanceFormDialog from './InstanceFormDialog.vue'
import { mapInstanceQuery } from './utils'

const { t, locale } = useI18n()
const { hasPermission } = usePermission()

const canQuery = computed(() => hasPermission('system:approval:instance:query'))
const canCreate = computed(() => hasPermission('system:approval:instance:create'))

const tableRef = ref<ProTableExpose<ApprovalInstance> | null>(null)
const formOpen = ref(false)
const detailOpen = ref(false)
const detailId = ref<string | null>(null)

const statusOptions = computed(() => [
  { label: t('approval.instance.statusPending'), value: 'PENDING' },
  { label: t('approval.instance.statusApproved'), value: 'APPROVED' },
  { label: t('approval.instance.statusRejected'), value: 'REJECTED' },
  { label: t('approval.instance.statusCancelled'), value: 'CANCELLED' },
])

const searchFields = computed<ProTableSearchField[]>(() => [
  {
    prop: 'keyword',
    label: t('approval.instance.keyword'),
    type: 'input',
    placeholder: t('approval.instance.keywordPlaceholder'),
    defaultValue: '',
  },
  {
    prop: 'status',
    label: t('approval.instance.status'),
    type: 'select',
    options: statusOptions.value,
    placeholder: t('approval.instance.status'),
    defaultValue: null,
  },
  {
    prop: 'businessType',
    label: t('approval.instance.businessType'),
    type: 'input',
    placeholder: t('approval.instance.businessType'),
    defaultValue: '',
  },
])

const columns = computed<ProTableColumn<ApprovalInstance>[]>(() => [
  {
    prop: 'title',
    label: t('approval.instance.titleLabel'),
    minWidth: 160,
    showOverflowTooltip: true,
  },
  {
    prop: 'businessType',
    label: t('approval.instance.businessType'),
    width: 120,
    formatter: (row) => row.businessType ?? '-',
  },
  {
    prop: 'businessId',
    label: t('approval.instance.businessId'),
    width: 120,
    formatter: (row) => row.businessId ?? '-',
  },
  {
    prop: 'status',
    label: t('approval.instance.status'),
    width: 110,
    type: 'slot',
    slot: 'status',
  },
  {
    prop: 'createdAt',
    label: t('approval.instance.createdAt'),
    minWidth: 165,
    formatter: (row) => formatDateTime(row.createdAt, locale.value),
  },
  {
    key: 'actions',
    label: t('common.actions'),
    width: 200,
    fixed: 'right',
    type: 'slot',
    slot: 'actions',
  },
])

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

function statusColor(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'processing'
    case 'APPROVED':
      return 'success'
    case 'REJECTED':
      return 'error'
    default:
      return 'default'
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'PENDING':
      return t('approval.instance.statusPending')
    case 'APPROVED':
      return t('approval.instance.statusApproved')
    case 'REJECTED':
      return t('approval.instance.statusRejected')
    case 'CANCELLED':
      return t('approval.instance.statusCancelled')
    default:
      return status
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message
  if (error instanceof Error) return error.message
  return t('approval.requestFailed')
}

async function requestInstances(params: ProTableRequestParams) {
  if (!canQuery.value) return { items: [], total: 0 }
  return fetchApprovalInstances(mapInstanceQuery(params))
}

function handleCreate(): void {
  formOpen.value = true
}

function handleDetail(row: ApprovalInstance): void {
  detailId.value = row.id
  detailOpen.value = true
}

async function handleCancel(row: ApprovalInstance): Promise<void> {
  const confirmed = await new Promise<boolean>((resolve) => {
    Modal.confirm({
      title: t('common.tip'),
      content: t('approval.instance.cancelConfirm'),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
  if (!confirmed) return

  try {
    await cancelApprovalInstance(row.id)
    message.success(t('approval.instance.cancelSuccess'))
    await tableRef.value?.reload()
  } catch (error) {
    message.error(errorMessage(error))
  }
}

const actions = computed<ProTableAction<ApprovalInstance>[]>(() => [
  {
    key: 'detail',
    label: t('approval.instance.detail'),
    placement: 'inline',
    onClick: (row) => handleDetail(row),
  },
  {
    key: 'cancel',
    label: t('approval.instance.actionCancel'),
    placement: 'inline',
    danger: true,
    onClick: (row) => void handleCancel(row),
  },
])
</script>

<template>
  <div class="instance-page">
    <ProTable
      ref="tableRef"
      :columns="columns"
      :search-fields="searchFields"
      :request="requestInstances"
      :immediate="canQuery"
      :show-request-error="false"
      @request-error="message.error(errorMessage($event))"
    >
      <template #toolbar-actions>
        <Button v-if="canCreate" type="primary" @click="handleCreate">{{
          t('approval.instance.create')
        }}</Button>
      </template>

      <template #column-status="{ row }">
        <Tag :color="statusColor(row.status)">{{ statusLabel(row.status) }}</Tag>
      </template>

      <template #column-actions="{ row }">
        <ProTableActions :row="row" :actions="actions" />
      </template>
    </ProTable>

    <InstanceFormDialog v-model:open="formOpen" @success="tableRef?.reload()" />
    <InstanceDetailDrawer v-model:open="detailOpen" :instance-id="detailId" />
  </div>
</template>

<style scoped lang="scss">
.instance-page {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
</style>
