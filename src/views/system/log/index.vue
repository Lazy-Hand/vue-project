<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Button,
  DateRangePicker,
  Descriptions,
  DescriptionsItem,
  Modal,
  TabPane,
  Tabs,
  Tag,
  message,
} from 'antdv-next'
import { DeleteOutlined } from '@antdv-next/icons'

import {
  cleanLoginLogs,
  cleanOperationLogs,
  fetchLoginLogList,
  fetchOperationLogList,
} from '@/api/log'
import ProTable from '@/components/ProTable/index.vue'
import ProTableActions from '@/components/ProTableActions/index.vue'
import { usePermission } from '@/composables/usePermission'
import type { LoginLog, OperationLog } from '@/types/log'
import type {
  ProTableAction,
  ProTableColumn,
  ProTableExpose,
  ProTableRequestParams,
  ProTableSearchField,
} from '@/types/pro-table'
import { ApiRequestError } from '@/utils/request'
import {
  formatDuration,
  loginTypeColor,
  mapLogQuery,
  mapLoginLogQuery,
  methodColor,
  statusColor,
} from './utils'

const { locale, t } = useI18n()
const { hasPermission } = usePermission()

const canQueryOperation = computed(() => hasPermission('system:log:query'))
const canDeleteOperation = computed(() => hasPermission('system:log:delete'))
const canQueryLogin = computed(() => hasPermission('system:log:loginQuery'))
const canDeleteLogin = computed(() => hasPermission('system:log:loginDelete'))

const activeTab = ref<'operation' | 'login'>('operation')

watch(
  [canQueryOperation, canQueryLogin],
  ([op, login]) => {
    if (!op && login) {
      activeTab.value = 'login'
    } else if (op) {
      activeTab.value = 'operation'
    }
  },
  { immediate: true },
)

// === Operation Log State ===
const opTableRef = ref<ProTableExpose<OperationLog> | null>(null)
const opDetailVisible = ref(false)
const opDetailLog = ref<OperationLog | null>(null)

const resultOptions = computed(() => [
  { label: t('log.successLabel'), value: true },
  { label: t('log.failureLabel'), value: false },
])

const opSearchFields = computed<ProTableSearchField[]>(() => [
  {
    prop: 'keyword',
    label: t('log.keyword'),
    type: 'input',
    placeholder: t('log.searchPlaceholder'),
    defaultValue: '',
  },
  {
    prop: 'module',
    label: t('log.module'),
    type: 'input',
    placeholder: t('log.modulePlaceholder'),
    defaultValue: '',
  },
  {
    prop: 'action',
    label: t('log.action'),
    type: 'input',
    placeholder: t('log.actionPlaceholder'),
    defaultValue: '',
  },
  {
    prop: 'success',
    label: t('log.result'),
    type: 'select',
    options: resultOptions.value,
    placeholder: t('log.resultPlaceholder'),
    defaultValue: null,
  },
  {
    prop: 'dateRange',
    label: t('log.timeRange'),
    type: 'slot',
    slot: 'dateRange',
    defaultValue: null,
    searchOnChange: false,
    fieldClass: 'log-page__date-range-field',
  },
])

const opColumns = computed<ProTableColumn<OperationLog>[]>(() => [
  {
    prop: 'username',
    label: t('log.username'),
    minWidth: 120,
    showOverflowTooltip: true,
  },
  { prop: 'module', label: t('log.module'), width: 110 },
  { prop: 'action', label: t('log.action'), width: 110 },
  {
    prop: 'method',
    label: t('log.method'),
    width: 90,
    type: 'slot',
    slot: 'method',
  },
  {
    prop: 'path',
    label: t('log.path'),
    minWidth: 180,
    showOverflowTooltip: true,
  },
  {
    prop: 'statusCode',
    label: t('log.statusCode'),
    width: 90,
    align: 'center',
    type: 'slot',
    slot: 'statusCode',
  },
  {
    prop: 'success',
    label: t('log.result'),
    width: 80,
    type: 'tag',
    trueLabel: t('log.successLabel'),
    falseLabel: t('log.failureLabel'),
  },
  {
    prop: 'durationMs',
    label: t('log.duration'),
    width: 90,
    align: 'right',
    formatter: (row) => formatDuration(row.durationMs),
  },
  {
    prop: 'ip',
    label: t('log.ip'),
    minWidth: 120,
    showOverflowTooltip: true,
  },
  {
    prop: 'createdAt',
    label: t('log.createdAt'),
    minWidth: 175,
    formatter: (row) => formatDateTime(row.createdAt, locale.value),
  },
  {
    key: 'actions',
    label: t('common.actions'),
    width: 90,
    fixed: 'right',
    type: 'slot',
    slot: 'actions',
  },
])

const opActions = computed<ProTableAction<OperationLog>[]>(() => [
  {
    key: 'detail',
    label: t('log.detail'),
    placement: 'inline',
    onClick: (row) => {
      opDetailLog.value = row
      opDetailVisible.value = true
    },
  },
])

// === Login Log State ===
const loginTableRef = ref<ProTableExpose<LoginLog> | null>(null)
const loginDetailVisible = ref(false)
const loginDetailLog = ref<LoginLog | null>(null)

const loginTypeOptions = computed(() => [
  { label: t('log.loginTypePassword'), value: 'PASSWORD' },
  { label: t('log.loginTypeRefresh'), value: 'REFRESH' },
  { label: t('log.loginTypeRegister'), value: 'REGISTER' },
])

const loginSearchFields = computed<ProTableSearchField[]>(() => [
  {
    prop: 'username',
    label: t('log.loginUsername'),
    type: 'input',
    placeholder: t('log.loginUsernamePlaceholder'),
    defaultValue: '',
  },
  {
    prop: 'loginType',
    label: t('log.loginType'),
    type: 'select',
    options: loginTypeOptions.value,
    placeholder: t('log.loginTypePlaceholder'),
    defaultValue: null,
  },
  {
    prop: 'success',
    label: t('log.result'),
    type: 'select',
    options: resultOptions.value,
    placeholder: t('log.resultPlaceholder'),
    defaultValue: null,
  },
  {
    prop: 'ip',
    label: t('log.ip'),
    type: 'input',
    placeholder: t('log.ip'),
    defaultValue: '',
  },
  {
    prop: 'dateRange',
    label: t('log.timeRange'),
    type: 'slot',
    slot: 'loginDateRange',
    defaultValue: null,
    searchOnChange: false,
    fieldClass: 'log-page__date-range-field',
  },
])

const loginColumns = computed<ProTableColumn<LoginLog>[]>(() => [
  {
    prop: 'username',
    label: t('log.loginUsername'),
    minWidth: 120,
    showOverflowTooltip: true,
  },
  {
    prop: 'loginType',
    label: t('log.loginType'),
    width: 120,
    type: 'slot',
    slot: 'loginType',
  },
  {
    prop: 'success',
    label: t('log.result'),
    width: 90,
    type: 'tag',
    trueLabel: t('log.successLabel'),
    falseLabel: t('log.failureLabel'),
  },
  {
    prop: 'failReason',
    label: t('log.failReason'),
    minWidth: 160,
    showOverflowTooltip: true,
    formatter: (row) => row.failReason ?? '-',
  },
  {
    prop: 'ip',
    label: t('log.ip'),
    minWidth: 120,
    showOverflowTooltip: true,
  },
  {
    prop: 'userAgent',
    label: t('log.userAgent'),
    minWidth: 180,
    showOverflowTooltip: true,
  },
  {
    prop: 'createdAt',
    label: t('log.createdAt'),
    minWidth: 175,
    formatter: (row) => formatDateTime(row.createdAt, locale.value),
  },
  {
    key: 'actions',
    label: t('common.actions'),
    width: 90,
    fixed: 'right',
    type: 'slot',
    slot: 'loginActions',
  },
])

const loginActions = computed<ProTableAction<LoginLog>[]>(() => [
  {
    key: 'detail',
    label: t('log.detail'),
    placement: 'inline',
    onClick: (row) => {
      loginDetailLog.value = row
      loginDetailVisible.value = true
    },
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
  return t('log.requestFailed')
}

function handleRequestError(error: unknown): void {
  message.error(errorMessage(error))
}

async function requestOperationLogs(params: ProTableRequestParams) {
  if (!canQueryOperation.value) return { items: [], total: 0 }
  return fetchOperationLogList(mapLogQuery(params))
}

async function requestLoginLogs(params: ProTableRequestParams) {
  if (!canQueryLogin.value) return { items: [], total: 0 }
  return fetchLoginLogList(mapLoginLogQuery(params))
}

function formatParams(log: OperationLog): string {
  if (!log.params) return '-'
  try {
    return JSON.stringify(JSON.parse(log.params), null, 2)
  } catch {
    return log.params
  }
}

function formatLoginTypeLabel(type: string): string {
  switch (type) {
    case 'PASSWORD':
      return t('log.loginTypePassword')
    case 'REFRESH':
      return t('log.loginTypeRefresh')
    case 'REGISTER':
      return t('log.loginTypeRegister')
    default:
      return type
  }
}

async function handleCleanOperation(): Promise<void> {
  const confirmed = await new Promise<boolean>((resolve) => {
    Modal.confirm({
      title: t('common.tip'),
      content: t('log.cleanConfirm'),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      okType: 'danger',
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
  if (!confirmed) return

  try {
    const result = await cleanOperationLogs()
    message.success(t('log.cleanSuccess', { count: result.count }))
    await opTableRef.value?.reload()
  } catch (error) {
    message.error(errorMessage(error))
  }
}

async function handleCleanLogin(): Promise<void> {
  const confirmed = await new Promise<boolean>((resolve) => {
    Modal.confirm({
      title: t('common.tip'),
      content: t('log.cleanLoginConfirm'),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      okType: 'danger',
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
  if (!confirmed) return

  try {
    const result = await cleanLoginLogs()
    message.success(t('log.cleanSuccess', { count: result.count }))
    await loginTableRef.value?.reload()
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
    <Tabs v-model:activeKey="activeTab" type="card" class="log-page__tabs">
      <!-- Tab 1: 操作日志 -->
      <TabPane v-if="canQueryOperation" key="operation" :tab="t('log.tabOperation')">
        <ProTable
          ref="opTableRef"
          :columns="opColumns"
          :search-fields="opSearchFields"
          :request="requestOperationLogs"
          :immediate="canQueryOperation"
          :show-request-error="false"
          @request-error="handleRequestError"
        >
          <template #toolbar-actions>
            <Button v-if="canDeleteOperation" danger @click="handleCleanOperation">
              <DeleteOutlined />
              {{ t('log.clean') }}
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

          <template #column-method="{ row }">
            <Tag :color="methodColor(row.method)">{{ row.method }}</Tag>
          </template>

          <template #column-statusCode="{ row }">
            <Tag v-if="row.statusCode !== null" :color="statusColor(row.statusCode)">
              {{ row.statusCode }}
            </Tag>
            <span v-else>-</span>
          </template>

          <template #column-actions="{ row }">
            <ProTableActions :row="row" :actions="opActions" />
          </template>
        </ProTable>
      </TabPane>

      <!-- Tab 2: 登录日志 -->
      <TabPane v-if="canQueryLogin" key="login" :tab="t('log.tabLogin')">
        <ProTable
          ref="loginTableRef"
          :columns="loginColumns"
          :search-fields="loginSearchFields"
          :request="requestLoginLogs"
          :immediate="canQueryLogin"
          :show-request-error="false"
          @request-error="handleRequestError"
        >
          <template #toolbar-actions>
            <Button v-if="canDeleteLogin" danger @click="handleCleanLogin">
              <DeleteOutlined />
              {{ t('log.clean') }}
            </Button>
          </template>

          <template #search-loginDateRange="{ setValue, search }">
            <DateRangePicker
              class="log-page__date-range"
              show-time
              :placeholder="[t('log.startTime'), t('log.endTime')]"
              @change="handleDateRangeChange($event, setValue, search)"
            />
          </template>

          <template #column-loginType="{ row }">
            <Tag :color="loginTypeColor(row.loginType)">
              {{ formatLoginTypeLabel(row.loginType) }}
            </Tag>
          </template>

          <template #column-loginActions="{ row }">
            <ProTableActions :row="row" :actions="loginActions" />
          </template>
        </ProTable>
      </TabPane>
    </Tabs>

    <!-- 操作日志详情 Modal -->
    <Modal
      v-model:open="opDetailVisible"
      :title="t('log.detailTitle')"
      width="720px"
      destroy-on-hidden
      :footer="null"
    >
      <Descriptions v-if="opDetailLog" :column="2" size="small" bordered>
        <DescriptionsItem :label="t('log.username')">
          {{ opDetailLog.username ?? '-' }}
        </DescriptionsItem>
        <DescriptionsItem :label="t('log.module')">{{ opDetailLog.module }}</DescriptionsItem>
        <DescriptionsItem :label="t('log.action')">{{ opDetailLog.action }}</DescriptionsItem>
        <DescriptionsItem :label="t('log.method')">{{ opDetailLog.method }}</DescriptionsItem>
        <DescriptionsItem :label="t('log.path')" :span="2">
          {{ opDetailLog.path }}
        </DescriptionsItem>
        <DescriptionsItem :label="t('log.statusCode')">
          {{ opDetailLog.statusCode ?? '-' }}
        </DescriptionsItem>
        <DescriptionsItem :label="t('log.result')">
          {{ opDetailLog.success ? t('log.successLabel') : t('log.failureLabel') }}
        </DescriptionsItem>
        <DescriptionsItem :label="t('log.duration')">
          {{ formatDuration(opDetailLog.durationMs) }}
        </DescriptionsItem>
        <DescriptionsItem :label="t('log.ip')">{{ opDetailLog.ip ?? '-' }}</DescriptionsItem>
        <DescriptionsItem :label="t('log.userAgent')" :span="2">
          {{ opDetailLog.userAgent ?? '-' }}
        </DescriptionsItem>
        <DescriptionsItem :label="t('log.createdAt')" :span="2">
          {{ formatDateTime(opDetailLog.createdAt, locale) }}
        </DescriptionsItem>
        <DescriptionsItem v-if="opDetailLog.errorMessage" :label="t('log.errorMessage')" :span="2">
          <span class="log-page__error">{{ opDetailLog.errorMessage }}</span>
        </DescriptionsItem>
        <DescriptionsItem :label="t('log.params')" :span="2">
          <pre class="log-page__params">{{ formatParams(opDetailLog) }}</pre>
        </DescriptionsItem>
      </Descriptions>
    </Modal>

    <!-- 登录日志详情 Modal -->
    <Modal
      v-model:open="loginDetailVisible"
      :title="t('log.loginDetailTitle')"
      width="640px"
      destroy-on-hidden
      :footer="null"
    >
      <Descriptions v-if="loginDetailLog" :column="2" size="small" bordered>
        <DescriptionsItem :label="t('log.loginUsername')">
          {{ loginDetailLog.username }}
        </DescriptionsItem>
        <DescriptionsItem :label="t('log.loginType')">
          <Tag :color="loginTypeColor(loginDetailLog.loginType)">
            {{ formatLoginTypeLabel(loginDetailLog.loginType) }}
          </Tag>
        </DescriptionsItem>
        <DescriptionsItem :label="t('log.result')">
          <Tag :color="loginDetailLog.success ? 'green' : 'red'">
            {{ loginDetailLog.success ? t('log.successLabel') : t('log.failureLabel') }}
          </Tag>
        </DescriptionsItem>
        <DescriptionsItem :label="t('log.ip')">
          {{ loginDetailLog.ip ?? '-' }}
        </DescriptionsItem>
        <DescriptionsItem :label="t('log.userAgent')" :span="2">
          {{ loginDetailLog.userAgent ?? '-' }}
        </DescriptionsItem>
        <DescriptionsItem :label="t('log.createdAt')" :span="2">
          {{ formatDateTime(loginDetailLog.createdAt, locale) }}
        </DescriptionsItem>
        <DescriptionsItem v-if="loginDetailLog.failReason" :label="t('log.failReason')" :span="2">
          <span class="log-page__error">{{ loginDetailLog.failReason }}</span>
        </DescriptionsItem>
      </Descriptions>
    </Modal>
  </div>
</template>

<style scoped lang="scss">
.log-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.log-page__tabs {
  display: flex;
  flex-direction: column;
  height: 100%;

  :deep(.ant-tabs-content) {
    height: 100%;
  }

  :deep(.ant-tabs-tabpane) {
    height: 100%;
  }
}

.log-page__date-range {
  width: 100%;
}

.log-page__params {
  margin: 0;
  max-height: 320px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 12px;
  line-height: 1.6;
  background: #fafafa;
  border-radius: 6px;
  padding: 8px 12px;
}

.log-page__error {
  color: #cf1322;
}
</style>
