<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Modal, message } from 'antdv-next'

import { fetchOnlineSessionList, revokeSession } from '@/api/session'
import ProTable from '@/components/ProTable/index.vue'
import ProTableActions from '@/components/ProTableActions/index.vue'
import { usePermission } from '@/composables/usePermission'
import type { OnlineSession } from '@/types/session'
import type {
  ProTableAction,
  ProTableColumn,
  ProTableExpose,
  ProTableRequestParams,
  ProTableSearchField,
} from '@/types/pro-table'
import { ApiRequestError } from '@/utils/request'
import { mapSessionQuery } from './utils'

const { locale, t } = useI18n()
const { hasPermission } = usePermission()

const tableRef = ref<ProTableExpose<OnlineSession> | null>(null)

const canQuery = computed(() => hasPermission('system:session:query'))
const canRevoke = computed(() => hasPermission('system:session:delete'))

const searchFields = computed<ProTableSearchField[]>(() => [
  {
    prop: 'keyword',
    label: t('session.keyword'),
    type: 'input',
    placeholder: t('session.searchPlaceholder'),
    defaultValue: '',
  },
])

const columns = computed<ProTableColumn<OnlineSession>[]>(() => [
  {
    prop: 'username',
    label: t('session.username'),
    minWidth: 120,
    showOverflowTooltip: true,
    formatter: (row) => row.username ?? t('session.deletedUser'),
  },
  {
    prop: 'nickname',
    label: t('session.nickname'),
    minWidth: 120,
    showOverflowTooltip: true,
    formatter: (row) => row.nickname ?? '-',
  },
  {
    prop: 'sessionId',
    label: t('session.sessionId'),
    minWidth: 190,
    showOverflowTooltip: true,
  },
  {
    prop: 'ip',
    label: t('session.ip'),
    minWidth: 120,
    showOverflowTooltip: true,
    formatter: (row) => row.ip ?? '-',
  },
  {
    prop: 'userAgent',
    label: t('session.userAgent'),
    minWidth: 200,
    showOverflowTooltip: true,
    formatter: (row) => row.userAgent ?? '-',
  },
  {
    prop: 'loginAt',
    label: t('session.loginAt'),
    minWidth: 170,
    formatter: (row) => formatDateTime(row.loginAt, locale.value),
  },
  {
    prop: 'expiresAt',
    label: t('session.expiresAt'),
    minWidth: 170,
    formatter: (row) => formatDateTime(row.expiresAt, locale.value),
  },
  {
    key: 'actions',
    label: t('common.actions'),
    width: 100,
    fixed: 'right',
    type: 'slot',
    slot: 'actions',
  },
])

const sessionActions = computed<ProTableAction<OnlineSession>[]>(() => [
  {
    key: 'revoke',
    label: t('session.revoke'),
    danger: true,
    visible: canRevoke.value,
    onClick: handleRevoke,
  },
])

function formatDateTime(value: string | null, localeCode: string): string {
  if (!value) return '-'
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
  return t('session.requestFailed')
}

function handleRequestError(error: unknown): void {
  message.error(errorMessage(error))
}

async function requestSessions(params: ProTableRequestParams) {
  if (!canQuery.value) return { items: [], total: 0 }
  return fetchOnlineSessionList(mapSessionQuery(params))
}

async function handleRevoke(row: OnlineSession): Promise<void> {
  const confirmed = await new Promise<boolean>((resolve) => {
    Modal.confirm({
      title: t('common.tip'),
      content: t('session.revokeConfirm', { sessionId: row.sessionId }),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      okType: 'danger',
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
  if (!confirmed) return

  try {
    await revokeSession(row.sessionId)
    message.success(t('session.revokeSuccess'))
    await tableRef.value?.reload()
  } catch (error) {
    message.error(errorMessage(error))
  }
}
</script>

<template>
  <div class="session-page">
    <ProTable
      ref="tableRef"
      :columns="columns"
      :search-fields="searchFields"
      :request="requestSessions"
      :immediate="canQuery"
      :show-request-error="false"
      @request-error="handleRequestError"
    >
      <template #column-actions="{ row }">
        <ProTableActions :row="row" :actions="sessionActions" />
      </template>
    </ProTable>
  </div>
</template>

<style scoped lang="scss">
.session-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
