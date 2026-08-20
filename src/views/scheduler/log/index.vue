<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  Button,
  DateRangePicker,
  Descriptions,
  DescriptionsItem,
  Modal,
  Tag,
  message,
} from 'antdv-next'
import { DeleteOutlined, EyeOutlined } from '@antdv-next/icons'

import { cleanJobLogs, deleteJobLog, fetchJobLogList } from '@/api/scheduler'
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
import type { JobLog } from '@/types/scheduler'
import { ApiRequestError } from '@/utils/request'
import { formatJobDuration, formatTriggerSource, jobLogStatusColor, mapJobLogQuery } from './utils'

const route = useRoute()
const { locale, t } = useI18n()
const { hasPermission } = usePermission()

const canQuery = computed(() => hasPermission('system:scheduler:log:query'))
const canDelete = computed(() => hasPermission('system:scheduler:log:delete'))

const tableRef = ref<ProTableExpose<JobLog> | null>(null)
const detailVisible = ref(false)
const detailLog = ref<JobLog | null>(null)

const initialJobName = computed(() =>
  typeof route.query.jobName === 'string' ? route.query.jobName : '',
)

const statusOptions = computed(() => [
  { label: t('scheduler.log.statusRunning'), value: 'RUNNING' },
  { label: t('scheduler.log.statusSuccess'), value: 'SUCCESS' },
  { label: t('scheduler.log.statusFailed'), value: 'FAILED' },
  { label: t('scheduler.log.statusSkipped'), value: 'SKIPPED' },
])

const groupOptions = computed(() => [
  { label: 'DEFAULT', value: 'DEFAULT' },
  { label: 'SYSTEM', value: 'SYSTEM' },
  { label: 'BUSINESS', value: 'BUSINESS' },
])

const searchFields = computed<ProTableSearchField[]>(() => [
  {
    prop: 'jobName',
    label: t('scheduler.log.jobName'),
    type: 'input',
    placeholder: t('scheduler.log.jobNamePlaceholder'),
    defaultValue: initialJobName.value,
  },
  {
    prop: 'jobGroup',
    label: t('scheduler.log.jobGroup'),
    type: 'select',
    options: groupOptions.value,
    placeholder: t('scheduler.log.jobGroupPlaceholder'),
    defaultValue: null,
  },
  {
    prop: 'status',
    label: t('scheduler.log.status'),
    type: 'select',
    options: statusOptions.value,
    placeholder: t('scheduler.log.statusPlaceholder'),
    defaultValue: null,
  },
  {
    prop: 'dateRange',
    label: t('scheduler.log.timeRange'),
    type: 'slot',
    slot: 'dateRange',
    defaultValue: null,
    searchOnChange: false,
    fieldClass: 'log-page__date-range-field',
  },
])

const columns = computed<ProTableColumn<JobLog>[]>(() => [
  {
    prop: 'jobName',
    label: t('scheduler.log.jobName'),
    minWidth: 160,
    showOverflowTooltip: true,
  },
  {
    prop: 'jobGroup',
    label: t('scheduler.log.jobGroup'),
    width: 105,
    formatter: (row) => row.jobGroup ?? '-',
  },
  {
    prop: 'invokeTarget',
    label: t('scheduler.task.invokeTarget'),
    minWidth: 140,
    showOverflowTooltip: true,
    formatter: (row) => row.invokeTarget ?? '-',
  },
  {
    prop: 'status',
    label: t('scheduler.log.status'),
    width: 95,
    type: 'slot',
    slot: 'status',
  },
  {
    prop: 'durationMs',
    label: t('scheduler.log.duration'),
    width: 100,
    align: 'right',
    formatter: (row) => formatJobDuration(row.durationMs),
  },
  {
    prop: 'triggeredBy',
    label: t('scheduler.log.triggeredBy'),
    minWidth: 130,
    formatter: (row) => formatTriggerSource(row.triggeredBy, t),
  },
  {
    prop: 'message',
    label: t('scheduler.log.message'),
    minWidth: 160,
    showOverflowTooltip: true,
    formatter: (row) => row.message ?? '-',
  },
  {
    prop: 'createdAt',
    label: t('scheduler.log.executedAt'),
    minWidth: 165,
    formatter: (row) => formatDateTime(row.createdAt, locale.value),
  },
  {
    key: 'actions',
    label: t('common.actions'),
    width: 130,
    fixed: 'right',
    type: 'slot',
    slot: 'actions',
  },
])

const actions = computed<ProTableAction<JobLog>[]>(() => [
  {
    key: 'detail',
    label: t('scheduler.log.detail'),
    icon: EyeOutlined,
    placement: 'inline',
    onClick: (row) => handleDetail(row),
  },
  {
    key: 'delete',
    label: t('common.delete'),
    icon: DeleteOutlined,
    placement: 'inline',
    danger: true,
    hidden: !canDelete.value,
    onClick: (row) => void handleDeleteSingle(row),
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

function formatStatusLabel(status: string): string {
  switch (status) {
    case 'RUNNING':
      return t('scheduler.log.statusRunning')
    case 'SUCCESS':
      return t('scheduler.log.statusSuccess')
    case 'FAILED':
      return t('scheduler.log.statusFailed')
    case 'SKIPPED':
      return t('scheduler.log.statusSkipped')
    default:
      return status
  }
}

async function requestLogs(params: ProTableRequestParams) {
  if (!canQuery.value) return { items: [], total: 0 }
  return fetchJobLogList(mapJobLogQuery(params))
}

function handleDetail(row: JobLog): void {
  detailLog.value = row
  detailVisible.value = true
}

async function handleDeleteSingle(row: JobLog): Promise<void> {
  const confirmed = await new Promise<boolean>((resolve) => {
    Modal.confirm({
      title: t('common.tip'),
      content: t('scheduler.log.deleteConfirm'),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      okType: 'danger',
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
  if (!confirmed) return

  try {
    await deleteJobLog(row.id)
    message.success(t('scheduler.log.deleteSuccess'))
    await tableRef.value?.reload()
  } catch (error) {
    message.error(errorMessage(error))
  }
}

async function handleCleanLogs(): Promise<void> {
  const confirmed = await new Promise<boolean>((resolve) => {
    Modal.confirm({
      title: t('common.tip'),
      content: t('scheduler.log.cleanConfirm'),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      okType: 'danger',
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
  if (!confirmed) return

  try {
    const result = await cleanJobLogs()
    message.success(t('scheduler.log.cleanSuccess', { count: result.count }))
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
  <div class="log-page">
    <ProTable
      ref="tableRef"
      :columns="columns"
      :search-fields="searchFields"
      :request="requestLogs"
      :immediate="canQuery"
      :show-request-error="false"
      @request-error="handleRequestError"
    >
      <template #toolbar-actions>
        <Button v-if="canDelete" danger @click="handleCleanLogs">
          <DeleteOutlined />
          {{ t('scheduler.log.clean') }}
        </Button>
      </template>

      <template #search-dateRange="{ setValue, search }">
        <DateRangePicker
          class="log-page__date-range"
          show-time
          :placeholder="[t('log.startTime'), t('log.endTime')]"
          @change="handleDateRangeChange($event, setValue, search)"
        />
      </template>

      <template #column-status="{ row }">
        <Tag :color="jobLogStatusColor(row.status)">
          {{ formatStatusLabel(row.status) }}
        </Tag>
      </template>

      <template #column-actions="{ row }">
        <ProTableActions :row="row" :actions="actions" />
      </template>
    </ProTable>

    <!-- 调度执行详情 Modal -->
    <Modal
      v-model:open="detailVisible"
      :title="t('scheduler.log.detailTitle')"
      width="680px"
      destroy-on-hidden
      :footer="null"
    >
      <Descriptions v-if="detailLog" :column="2" size="small" bordered>
        <DescriptionsItem :label="t('scheduler.log.jobName')">
          {{ detailLog.jobName }}
        </DescriptionsItem>
        <DescriptionsItem :label="t('scheduler.log.jobGroup')">
          {{ detailLog.jobGroup || '-' }}
        </DescriptionsItem>
        <DescriptionsItem :label="t('scheduler.task.invokeTarget')" :span="2">
          {{ detailLog.invokeTarget || '-' }}
        </DescriptionsItem>
        <DescriptionsItem :label="t('scheduler.log.status')">
          <Tag :color="jobLogStatusColor(detailLog.status)">
            {{ formatStatusLabel(detailLog.status) }}
          </Tag>
        </DescriptionsItem>
        <DescriptionsItem :label="t('scheduler.log.duration')">
          {{ formatJobDuration(detailLog.durationMs) }}
        </DescriptionsItem>
        <DescriptionsItem :label="t('scheduler.log.triggeredBy')">
          {{ formatTriggerSource(detailLog.triggeredBy, t) }}
        </DescriptionsItem>
        <DescriptionsItem :label="t('scheduler.log.executedAt')">
          {{ formatDateTime(detailLog.createdAt, locale) }}
        </DescriptionsItem>
        <DescriptionsItem v-if="detailLog.args" :label="t('scheduler.task.args')" :span="2">
          <code class="log-page__code">{{ detailLog.args }}</code>
        </DescriptionsItem>
        <DescriptionsItem :label="t('scheduler.log.message')" :span="2">
          <div class="log-page__message">{{ detailLog.message ?? '-' }}</div>
        </DescriptionsItem>
        <DescriptionsItem
          v-if="detailLog.exceptionInfo"
          :label="t('scheduler.log.exceptionInfo')"
          :span="2"
        >
          <pre class="log-page__stack">{{ detailLog.exceptionInfo }}</pre>
        </DescriptionsItem>
      </Descriptions>
    </Modal>
  </div>
</template>

<style scoped lang="scss">
.log-page {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.log-page__date-range {
  width: 100%;
}

.log-page__code {
  font-family: monospace;
  font-size: 12px;
  background: #f8fafc;
  padding: 2px 6px;
  border-radius: 4px;
}

.log-page__message {
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 13px;
}

.log-page__stack {
  margin: 0;
  max-height: 260px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 12px;
  line-height: 1.5;
  background: #fef2f2;
  color: #991b1b;
  border-radius: 6px;
  padding: 8px 12px;
}
</style>
