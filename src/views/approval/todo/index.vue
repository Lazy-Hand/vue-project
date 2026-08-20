<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Input, Modal, Tag, message } from 'antdv-next'

import {
  addSignTask,
  approveTask,
  fetchApprovalInstanceDetail,
  fetchTodoList,
  rejectTask,
  transferTask,
} from '@/api/approval'
import ProTable from '@/components/ProTable/index.vue'
import ProTableActions from '@/components/ProTableActions/index.vue'
import type {
  ProTableAction,
  ProTableColumn,
  ProTableExpose,
  ProTableRequestParams,
  ProTableSearchField,
} from '@/types/pro-table'
import type { ApprovalInstance, ApprovalInstanceDetail } from '@/types/approval'
import { ApiRequestError } from '@/utils/request'
import InstanceDetailDrawer from '../instance/InstanceDetailDrawer.vue'

const { t, locale } = useI18n()

const tableRef = ref<ProTableExpose<ApprovalInstance> | null>(null)
const detailOpen = ref(false)
const detailId = ref<string | null>(null)
const actionComment = ref('')
const actionTargetUserId = ref('')

const searchFields = computed<ProTableSearchField[]>(() => [
  {
    prop: 'keyword',
    label: t('approval.instance.keyword'),
    type: 'input',
    placeholder: t('approval.instance.keywordPlaceholder'),
    defaultValue: '',
  },
])

const columns = computed<ProTableColumn<ApprovalInstance>[]>(() => [
  {
    prop: 'title',
    label: t('approval.instance.titleLabel'),
    minWidth: 180,
    showOverflowTooltip: true,
  },
  {
    prop: 'businessType',
    label: t('approval.instance.businessType'),
    width: 120,
    formatter: (row) => row.businessType ?? '-',
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
    width: 300,
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

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message
  if (error instanceof Error) return error.message
  return t('approval.requestFailed')
}

async function requestTodo(params: ProTableRequestParams) {
  const query: Record<string, unknown> = { page: params.page, pageSize: params.pageSize }
  const kw = typeof params.keyword === 'string' ? params.keyword.trim() : ''
  if (kw) query.keyword = kw
  return fetchTodoList(query as { page?: number; pageSize?: number; keyword?: string })
}

function handleDetail(row: ApprovalInstance): void {
  detailId.value = row.id
  detailOpen.value = true
}

async function resolveMyPendingTaskId(instanceId: string): Promise<string | null> {
  try {
    const detail: ApprovalInstanceDetail = await fetchApprovalInstanceDetail(instanceId)
    const pending = detail.tasks.find((task) => task.status === 'PENDING')
    return pending?.id ?? null
  } catch (error) {
    message.error(errorMessage(error))
    return null
  }
}

async function handleApprove(row: ApprovalInstance): Promise<void> {
  const taskId = await resolveMyPendingTaskId(row.id)
  if (!taskId) {
    message.error(t('approval.requestFailed'))
    return
  }

  const confirmed = await new Promise<boolean>((resolve) => {
    Modal.confirm({
      title: t('common.tip'),
      content: t('approval.instance.approveConfirm'),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
  if (!confirmed) return

  try {
    await approveTask(taskId, { comment: actionComment.value.trim() || undefined })
    message.success(t('approval.instance.approveSuccess'))
    await tableRef.value?.reload()
  } catch (error) {
    message.error(errorMessage(error))
  }
}

async function handleReject(row: ApprovalInstance): Promise<void> {
  const taskId = await resolveMyPendingTaskId(row.id)
  if (!taskId) return

  const confirmed = await new Promise<boolean>((resolve) => {
    Modal.confirm({
      title: t('common.tip'),
      content: t('approval.instance.rejectConfirm'),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
  if (!confirmed) return

  try {
    await rejectTask(taskId, { comment: actionComment.value.trim() || undefined })
    message.success(t('approval.instance.rejectSuccess'))
    await tableRef.value?.reload()
  } catch (error) {
    message.error(errorMessage(error))
  }
}

async function handleTransfer(row: ApprovalInstance): Promise<void> {
  const taskId = await resolveMyPendingTaskId(row.id)
  if (!taskId) return
  if (!actionTargetUserId.value.trim()) {
    message.warning(t('approval.instance.targetUserRequired'))
    return
  }
  try {
    await transferTask(taskId, {
      targetUserId: actionTargetUserId.value.trim(),
      comment: actionComment.value.trim() || undefined,
    })
    message.success(t('approval.instance.transferSuccess'))
    actionTargetUserId.value = ''
    actionComment.value = ''
    await tableRef.value?.reload()
  } catch (error) {
    message.error(errorMessage(error))
  }
}

async function handleAddSign(row: ApprovalInstance): Promise<void> {
  const taskId = await resolveMyPendingTaskId(row.id)
  if (!taskId) return
  if (!actionTargetUserId.value.trim()) {
    message.warning(t('approval.instance.targetUserRequired'))
    return
  }
  try {
    await addSignTask(taskId, {
      targetUserId: actionTargetUserId.value.trim(),
      comment: actionComment.value.trim() || undefined,
    })
    message.success(t('approval.instance.addSignSuccess'))
    actionTargetUserId.value = ''
    actionComment.value = ''
    await tableRef.value?.reload()
  } catch (error) {
    message.error(errorMessage(error))
  }
}

const actions = computed((): ProTableAction<ApprovalInstance>[] => [
  {
    key: 'detail',
    label: t('approval.instance.detail'),
    placement: 'inline',
    onClick: (row) => handleDetail(row),
  },
  {
    key: 'approve',
    label: t('approval.instance.actionApprove'),
    placement: 'inline',
    onClick: (row) => void handleApprove(row),
  },
  {
    key: 'reject',
    label: t('approval.instance.actionReject'),
    placement: 'inline',
    danger: true,
    onClick: (row) => void handleReject(row),
  },
  {
    key: 'transfer',
    label: t('approval.instance.actionTransfer'),
    placement: 'menu',
    onClick: (row) => void handleTransfer(row),
  },
  {
    key: 'addSign',
    label: t('approval.instance.actionAddSign'),
    placement: 'menu',
    onClick: (row) => void handleAddSign(row),
  },
])
</script>

<template>
  <div class="todo-page">
    <ProTable
      ref="tableRef"
      :columns="columns"
      :search-fields="searchFields"
      :request="requestTodo"
      :show-request-error="false"
      @request-error="message.error(errorMessage($event))"
    >
      <template #toolbar-actions>
        <div class="flex items-center gap-2">
          <Input
            v-model:value="actionTargetUserId"
            :placeholder="t('approval.instance.targetUserPlaceholder')"
            class="w-32"
          />
          <Input
            v-model:value="actionComment"
            :placeholder="t('approval.instance.commentPlaceholder')"
            class="w-48"
          />
        </div>
      </template>

      <template #column-status="{ row }">
        <Tag color="processing">{{ row.status }}</Tag>
      </template>

      <template #column-actions="{ row }">
        <ProTableActions :row="row" :actions="actions" />
      </template>
    </ProTable>

    <InstanceDetailDrawer v-model:open="detailOpen" :instance-id="detailId" />
  </div>
</template>

<style scoped lang="scss">
.todo-page {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
</style>
