<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useI18n } from 'vue-i18n'
import { Button, Modal, Switch, Tag, message } from 'antdv-next'
import {
  CaretRightOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  PlusOutlined,
} from '@antdv-next/icons'

import {
  changeJobStatus,
  deleteJob,
  fetchJobHandlerOptions,
  fetchJobList,
  runJobOnce,
} from '@/api/scheduler'
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
import type { Job, JobHandlerOption } from '@/types/scheduler'
import { ApiRequestError } from '@/utils/request'
import TaskFormDialog from './TaskFormDialog.vue'
import { jobGroupColor, mapJobQuery } from './utils'

const router = useRouter()
const { locale, t } = useI18n()
const { hasPermission } = usePermission()

const canQuery = computed(() => hasPermission('system:scheduler:task:query'))
const canCreate = computed(() => hasPermission('system:scheduler:task:create'))
const canUpdate = computed(() => hasPermission('system:scheduler:task:update'))
const canDelete = computed(() => hasPermission('system:scheduler:task:delete'))
const canChangeStatus = computed(() => hasPermission('system:scheduler:task:status'))
const canRun = computed(() => hasPermission('system:scheduler:task:run'))

const tableRef = ref<ProTableExpose<Job> | null>(null)
const handlers = ref<JobHandlerOption[]>([])

// Dialog state
const formOpen = ref(false)
const editingJob = ref<Job | null>(null)
const runningJobId = ref<string | null>(null)
const switchingJobId = ref<string | null>(null)

const statusOptions = computed(() => [
  { label: t('scheduler.task.statusEnabled'), value: 'ENABLED' },
  { label: t('scheduler.task.statusDisabled'), value: 'DISABLED' },
])

const groupOptions = computed(() => [
  { label: 'DEFAULT', value: 'DEFAULT' },
  { label: 'SYSTEM', value: 'SYSTEM' },
  { label: 'BUSINESS', value: 'BUSINESS' },
])

const searchFields = computed<ProTableSearchField[]>(() => [
  {
    prop: 'jobName',
    label: t('scheduler.task.jobName'),
    type: 'input',
    placeholder: t('scheduler.task.jobNamePlaceholder'),
    defaultValue: '',
  },
  {
    prop: 'jobGroup',
    label: t('scheduler.task.jobGroup'),
    type: 'select',
    options: groupOptions.value,
    placeholder: t('scheduler.task.jobGroupPlaceholder'),
    defaultValue: null,
  },
  {
    prop: 'status',
    label: t('scheduler.task.status'),
    type: 'select',
    options: statusOptions.value,
    placeholder: t('scheduler.task.statusPlaceholder'),
    defaultValue: null,
  },
])

const columns = computed<ProTableColumn<Job>[]>(() => [
  {
    prop: 'jobName',
    label: t('scheduler.task.jobName'),
    minWidth: 160,
    showOverflowTooltip: true,
  },
  {
    prop: 'jobGroup',
    label: t('scheduler.task.jobGroup'),
    width: 110,
    type: 'slot',
    slot: 'group',
  },
  {
    prop: 'invokeTarget',
    label: t('scheduler.task.invokeTarget'),
    minWidth: 150,
    showOverflowTooltip: true,
  },
  {
    prop: 'cronExpression',
    label: t('scheduler.task.cronExpression'),
    minWidth: 130,
    type: 'slot',
    slot: 'cron',
  },
  {
    prop: 'status',
    label: t('scheduler.task.status'),
    width: 95,
    type: 'slot',
    slot: 'status',
  },
  {
    prop: 'concurrent',
    label: t('scheduler.task.concurrent'),
    width: 95,
    type: 'slot',
    slot: 'concurrent',
  },
  {
    prop: 'remark',
    label: t('scheduler.task.remark'),
    minWidth: 140,
    showOverflowTooltip: true,
    formatter: (row) => row.remark ?? '-',
  },
  {
    prop: 'createdAt',
    label: t('common.createdAt'),
    minWidth: 165,
    formatter: (row) => formatDateTime(row.createdAt, locale.value),
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

const actions = computed<ProTableAction<Job>[]>(() => [
  {
    key: 'run',
    label: t('scheduler.task.runOnce'),
    icon: CaretRightOutlined,
    placement: 'inline',
    hidden: !canRun.value,
    onClick: (row) => void handleRunOnce(row),
  },
  {
    key: 'edit',
    label: t('common.edit'),
    icon: EditOutlined,
    placement: 'inline',
    hidden: !canUpdate.value,
    onClick: (row) => handleEdit(row),
  },
  {
    key: 'logs',
    label: t('scheduler.task.viewLogs'),
    icon: FileTextOutlined,
    placement: 'inline',
    onClick: (row) => handleViewLogs(row),
  },
  {
    key: 'delete',
    label: t('common.delete'),
    icon: DeleteOutlined,
    placement: 'inline',
    danger: true,
    hidden: !canDelete.value,
    onClick: (row) => void handleDelete(row),
  },
])

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
  return t('scheduler.requestFailed')
}

function handleRequestError(error: unknown): void {
  message.error(errorMessage(error))
}

async function loadHandlers(): Promise<void> {
  try {
    handlers.value = await fetchJobHandlerOptions()
  } catch {
    // optional failure
  }
}

async function requestJobs(params: ProTableRequestParams) {
  if (!canQuery.value) return { items: [], total: 0 }
  return fetchJobList(mapJobQuery(params))
}

function handleCreate(): void {
  editingJob.value = null
  void loadHandlers()
  formOpen.value = true
}

function handleEdit(row: Job): void {
  editingJob.value = row
  void loadHandlers()
  formOpen.value = true
}

function handleViewLogs(row: Job): void {
  void router.push({
    path: '/scheduler/log',
    query: {
      jobId: row.id,
      jobName: row.jobName,
    },
  })
}

async function handleStatusChange(row: Job, checked: boolean | string | number): Promise<void> {
  const newStatus = checked ? 'ENABLED' : 'DISABLED'
  switchingJobId.value = row.id

  try {
    await changeJobStatus(row.id, newStatus)
    row.status = newStatus
    message.success(
      t('scheduler.task.statusChangeSuccess', {
        status:
          newStatus === 'ENABLED'
            ? t('scheduler.task.statusEnabled')
            : t('scheduler.task.statusDisabled'),
      }),
    )
  } catch (error) {
    message.error(errorMessage(error))
  } finally {
    switchingJobId.value = null
  }
}

async function handleRunOnce(row: Job): Promise<void> {
  const confirmed = await new Promise<boolean>((resolve) => {
    Modal.confirm({
      title: t('common.tip'),
      content: t('scheduler.task.runOnceConfirm', { name: row.jobName }),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
  if (!confirmed) return

  runningJobId.value = row.id
  try {
    await runJobOnce(row.id)
    message.success(t('scheduler.task.runOnceSuccess', { name: row.jobName }))
  } catch (error) {
    message.error(errorMessage(error))
  } finally {
    runningJobId.value = null
  }
}

async function handleDelete(row: Job): Promise<void> {
  const confirmed = await new Promise<boolean>((resolve) => {
    Modal.confirm({
      title: t('common.tip'),
      content: t('scheduler.task.deleteConfirm', { name: row.jobName }),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      okType: 'danger',
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
  if (!confirmed) return

  try {
    await deleteJob(row.id)
    message.success(t('scheduler.task.deleteSuccess'))
    await tableRef.value?.reload()
  } catch (error) {
    message.error(errorMessage(error))
  }
}

function handleFormSuccess(): void {
  void tableRef.value?.reload()
}

watch(
  canQuery,
  (val) => {
    if (val) {
      void loadHandlers()
    }
  },
  { immediate: true },
)

onMounted(() => {
  if (canQuery.value) {
    void loadHandlers()
  }
})
</script>

<template>
  <div class="task-page">
    <ProTable
      ref="tableRef"
      :columns="columns"
      :search-fields="searchFields"
      :request="requestJobs"
      :immediate="canQuery"
      :show-request-error="false"
      @request-error="handleRequestError"
    >
      <template #toolbar-actions>
        <Button v-if="canCreate" type="primary" @click="handleCreate">
          <PlusOutlined />
          {{ t('scheduler.task.create') }}
        </Button>
      </template>

      <template #column-group="{ row }">
        <Tag :color="jobGroupColor(row.jobGroup)">
          {{ row.jobGroup || 'DEFAULT' }}
        </Tag>
      </template>

      <template #column-cron="{ row }">
        <code class="task-page__cron">{{ row.cronExpression }}</code>
      </template>

      <template #column-status="{ row }">
        <Switch
          :checked="row.status === 'ENABLED'"
          :disabled="!canChangeStatus"
          :loading="switchingJobId === row.id"
          size="small"
          @change="handleStatusChange(row, $event)"
        />
      </template>

      <template #column-concurrent="{ row }">
        <Tag :color="row.concurrent ? 'green' : 'default'">
          {{
            row.concurrent
              ? t('scheduler.task.concurrentAllow')
              : t('scheduler.task.concurrentForbid')
          }}
        </Tag>
      </template>

      <template #column-actions="{ row }">
        <ProTableActions :row="row" :actions="actions" />
      </template>
    </ProTable>

    <!-- 新增 / 编辑弹窗 -->
    <TaskFormDialog
      v-model:open="formOpen"
      :job="editingJob"
      :handlers="handlers"
      @success="handleFormSuccess"
    />
  </div>
</template>

<style scoped lang="scss">
.task-page {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.task-page__cron {
  font-family: monospace;
  font-size: 12px;
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
  color: #0f172a;
}
</style>
