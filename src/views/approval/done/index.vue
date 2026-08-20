<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Tag, message } from 'antdv-next'

import { fetchDoneList } from '@/api/approval'
import ProTable from '@/components/ProTable/index.vue'
import type {
  ProTableColumn,
  ProTableExpose,
  ProTableRequestParams,
  ProTableSearchField,
} from '@/types/pro-table'
import type { ApprovalInstance } from '@/types/approval'
import { ApiRequestError } from '@/utils/request'
import InstanceDetailDrawer from '../instance/InstanceDetailDrawer.vue'

const { t, locale } = useI18n()

const tableRef = ref<ProTableExpose<ApprovalInstance> | null>(null)
const detailOpen = ref(false)
const detailId = ref<string | null>(null)

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
    prop: 'updatedAt',
    label: t('approval.instance.updatedAt'),
    minWidth: 165,
    formatter: (row) => formatDateTime(row.updatedAt, locale.value),
  },
  {
    key: 'actions',
    label: t('common.actions'),
    width: 120,
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

async function requestDone(params: ProTableRequestParams) {
  const query: Record<string, unknown> = { page: params.page, pageSize: params.pageSize }
  const kw = typeof params.keyword === 'string' ? params.keyword.trim() : ''
  if (kw) query.keyword = kw
  return fetchDoneList(query as { page?: number; pageSize?: number; keyword?: string })
}

function handleDetail(row: ApprovalInstance): void {
  detailId.value = row.id
  detailOpen.value = true
}
</script>

<template>
  <div class="done-page">
    <ProTable
      ref="tableRef"
      :columns="columns"
      :search-fields="searchFields"
      :request="requestDone"
      :show-request-error="false"
      @request-error="message.error(errorMessage($event))"
    >
      <template #column-status="{ row }">
        <Tag
          :color="
            row.status === 'APPROVED' ? 'success' : row.status === 'REJECTED' ? 'error' : 'default'
          "
          >{{ row.status }}</Tag
        >
      </template>

      <template #column-actions="{ row }">
        <a class="text-sm text-blue-600" @click="handleDetail(row)">{{
          t('approval.instance.detail')
        }}</a>
      </template>
    </ProTable>

    <InstanceDetailDrawer v-model:open="detailOpen" :instance-id="detailId" />
  </div>
</template>

<style scoped lang="scss">
.done-page {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
</style>
