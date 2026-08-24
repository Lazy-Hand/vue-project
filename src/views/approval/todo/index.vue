<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FormInstance } from 'antdv-next'
import { Form, FormItem, Input, Modal, Select, Tag, message } from 'antdv-next'

import { addSignTask, approveTask, fetchTodoList, rejectTask, transferTask } from '@/api/approval'
import { fetchUserOptions } from '@/api/user'
import ProTable from '@/components/ProTable/index.vue'
import ProTableActions from '@/components/ProTableActions/index.vue'
import type {
  ProTableAction,
  ProTableColumn,
  ProTableExpose,
  ProTableRequestParams,
  ProTableSearchField,
} from '@/types/pro-table'
import type { ApprovalTodoItem } from '@/types/approval'
import { ApiRequestError } from '@/utils/request'
import InstanceDetailDrawer from '../instance/InstanceDetailDrawer.vue'

const { t, locale } = useI18n()

const tableRef = ref<ProTableExpose<ApprovalTodoItem> | null>(null)
const detailOpen = ref(false)
const detailId = ref<string | null>(null)

// 每个操作的独立 loading，防止重复点击：key 为 `${taskId}:${action}`
const actionLoading = reactive<Record<string, boolean>>({})

const searchFields = computed<ProTableSearchField[]>(() => [
  {
    prop: 'keyword',
    label: t('approval.instance.keyword'),
    type: 'input',
    placeholder: t('approval.instance.keywordPlaceholder'),
    defaultValue: '',
  },
])

const columns = computed<ProTableColumn<ApprovalTodoItem>[]>(() => [
  {
    prop: 'instance.title',
    label: t('approval.instance.titleLabel'),
    minWidth: 180,
    showOverflowTooltip: true,
    formatter: (row) => row.instance.title,
  },
  {
    prop: 'instance.businessType',
    label: t('approval.instance.businessType'),
    width: 120,
    formatter: (row) => row.instance.businessType ?? '-',
  },
  {
    prop: 'instance.status',
    label: t('approval.instance.status'),
    width: 110,
    type: 'slot',
    slot: 'status',
  },
  {
    prop: 'instance.createdAt',
    label: t('approval.instance.createdAt'),
    minWidth: 165,
    formatter: (row) => formatDateTime(row.instance.createdAt, locale.value),
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

function handleDetail(row: ApprovalTodoItem): void {
  detailId.value = row.instance.id
  detailOpen.value = true
}

function withLoading(key: string, run: () => Promise<unknown>): Promise<void> {
  if (actionLoading[key]) return Promise.resolve()
  actionLoading[key] = true
  return run()
    .then(() => undefined)
    .finally(() => {
      actionLoading[key] = false
    })
}

// ================= 审批通过 =================

async function handleApprove(row: ApprovalTodoItem): Promise<void> {
  const taskId = row.myPendingTaskId
  if (!taskId || !row.capabilities.canApprove) return

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

  await withLoading(`${taskId}:approve`, async () => {
    try {
      await approveTask(taskId)
      message.success(t('approval.instance.approveSuccess'))
      await tableRef.value?.reload()
    } catch (error) {
      message.error(errorMessage(error))
    }
  })
}

// ================= 驳回 =================

const rejectVisible = ref(false)
const rejectTaskId = ref<string | null>(null)
const rejectComment = ref('')
const rejecting = ref(false)

async function handleReject(row: ApprovalTodoItem): Promise<void> {
  if (!row.myPendingTaskId || !row.capabilities.canReject) return
  rejectTaskId.value = row.myPendingTaskId
  rejectComment.value = ''
  rejectVisible.value = true
}

async function submitReject(): Promise<void> {
  const comment = rejectComment.value.trim()
  if (!comment) {
    message.warning(t('approval.instance.rejectCommentRequired'))
    return
  }
  if (!rejectTaskId.value) return

  rejecting.value = true
  try {
    await rejectTask(rejectTaskId.value, { comment })
    message.success(t('approval.instance.rejectSuccess'))
    rejectVisible.value = false
    await tableRef.value?.reload()
  } catch (error) {
    message.error(errorMessage(error))
  } finally {
    rejecting.value = false
  }
}

// ================= 转办 / 加签（用户选择器） =================

interface TargetUserForm {
  targetUserId: string | undefined
  comment: string
}

const targetVisible = ref(false)
const targetMode = ref<'transfer' | 'addSign'>('transfer')
const targetTaskId = ref<string | null>(null)
const targetSubmitting = ref(false)
const targetFormRef = ref<FormInstance>()
const targetForm = reactive<TargetUserForm>({ targetUserId: undefined, comment: '' })

const userOptions = ref<{ label: string; value: string }[]>([])
const userLoading = ref(false)

async function loadUserOptions(): Promise<void> {
  if (userOptions.value.length > 0) return
  userLoading.value = true
  try {
    userOptions.value = await fetchUserOptions()
  } catch (error) {
    message.error(errorMessage(error))
  } finally {
    userLoading.value = false
  }
}

async function handleTargetAction(
  row: ApprovalTodoItem,
  mode: 'transfer' | 'addSign',
): Promise<void> {
  const allowed = mode === 'transfer' ? row.capabilities.canTransfer : row.capabilities.canAddSign
  if (!row.myPendingTaskId || !allowed) return
  targetMode.value = mode
  targetTaskId.value = row.myPendingTaskId
  targetForm.targetUserId = undefined
  targetForm.comment = ''
  targetVisible.value = true
  await loadUserOptions()
}

async function submitTarget(): Promise<void> {
  if (!targetTaskId.value) return
  const valid = await targetFormRef.value?.validate().catch(() => false)
  if (!valid) return

  targetSubmitting.value = true
  try {
    const payload = {
      targetUserId: String(targetForm.targetUserId),
      comment: targetForm.comment.trim() || undefined,
    }
    if (targetMode.value === 'transfer') {
      await transferTask(targetTaskId.value, payload)
      message.success(t('approval.instance.transferSuccess'))
    } else {
      await addSignTask(targetTaskId.value, payload)
      message.success(t('approval.instance.addSignSuccess'))
    }
    targetVisible.value = false
    await tableRef.value?.reload()
  } catch (error) {
    message.error(errorMessage(error))
  } finally {
    targetSubmitting.value = false
  }
}

const actions = computed((): ProTableAction<ApprovalTodoItem>[] => [
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
    // 能力为 false 的操作不展示
    visible: (row) => row.capabilities.canApprove,
    onClick: (row) => void handleApprove(row),
  },
  {
    key: 'reject',
    label: t('approval.instance.actionReject'),
    placement: 'inline',
    danger: true,
    visible: (row) => row.capabilities.canReject,
    onClick: (row) => void handleReject(row),
  },
  {
    key: 'transfer',
    label: t('approval.instance.actionTransfer'),
    placement: 'menu',
    visible: (row) => row.capabilities.canTransfer,
    onClick: (row) => void handleTargetAction(row, 'transfer'),
  },
  {
    key: 'addSign',
    label: t('approval.instance.actionAddSign'),
    placement: 'menu',
    visible: (row) => row.capabilities.canAddSign,
    onClick: (row) => void handleTargetAction(row, 'addSign'),
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
      <template #column-status="{ row }">
        <Tag color="processing">{{ row.instance.status }}</Tag>
      </template>

      <template #column-actions="{ row }">
        <ProTableActions :row="row" :actions="actions" />
      </template>
    </ProTable>

    <InstanceDetailDrawer v-model:open="detailOpen" :instance-id="detailId" />

    <Modal
      v-model:open="rejectVisible"
      :title="t('approval.instance.actionReject')"
      :confirm-loading="rejecting"
      :ok-text="t('common.confirm')"
      :cancel-text="t('common.cancel')"
      @ok="submitReject"
    >
      <p class="mb-2 text-sm text-slate-500">{{ t('approval.instance.rejectCommentTip') }}</p>
      <Input.TextArea
        v-model:value="rejectComment"
        :rows="3"
        :maxlength="500"
        show-count
        :placeholder="t('approval.instance.rejectCommentPlaceholder')"
      />
    </Modal>

    <Modal
      v-model:open="targetVisible"
      :title="
        targetMode === 'transfer'
          ? t('approval.instance.actionTransfer')
          : t('approval.instance.actionAddSign')
      "
      :confirm-loading="targetSubmitting"
      :ok-text="t('common.confirm')"
      :cancel-text="t('common.cancel')"
      @ok="submitTarget"
    >
      <Form ref="targetFormRef" :model="targetForm" layout="vertical">
        <FormItem
          :label="t('approval.instance.targetUser')"
          name="targetUserId"
          :rules="[{ required: true, message: t('approval.instance.targetUserRequired') }]"
        >
          <Select
            v-model:value="targetForm.targetUserId"
            show-search
            option-filter-prop="label"
            :options="userOptions"
            :loading="userLoading"
            :placeholder="t('approval.instance.targetUserPlaceholder')"
          />
        </FormItem>
        <FormItem :label="t('approval.instance.comment')" name="comment">
          <Input.TextArea
            v-model:value="targetForm.comment"
            :rows="3"
            :maxlength="500"
            show-count
            :placeholder="t('approval.instance.commentPlaceholder')"
          />
        </FormItem>
      </Form>
    </Modal>
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
