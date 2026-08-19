<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Descriptions, DescriptionsItem, Modal, Tag, message } from 'antdv-next'
import { PlusOutlined } from '@antdv-next/icons'

import { createNotice, deleteNotice, fetchNoticeList, updateNotice } from '@/api/notice'
import ProTable from '@/components/ProTable/index.vue'
import ProTableActions from '@/components/ProTableActions/index.vue'
import { usePermission } from '@/composables/usePermission'
import type {
  Notice,
  NoticePayload,
  NoticeStatus,
  NoticeTargetScope,
  UpdateNoticePayload,
} from '@/types/notice'
import type {
  ProTableAction,
  ProTableColumn,
  ProTableExpose,
  ProTableRequestParams,
  ProTableSearchField,
} from '@/types/pro-table'
import { ApiRequestError } from '@/utils/request'
import NoticeFormDialog from './NoticeFormDialog.vue'
import PublishNoticeDialog from './PublishNoticeDialog.vue'
import { mapNoticeQuery } from './utils'

const { locale, t } = useI18n()
const { hasPermission } = usePermission()

const tableRef = ref<ProTableExpose<Notice> | null>(null)
const formVisible = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editingNotice = ref<Notice | null>(null)
const formDialogRef = ref<InstanceType<typeof NoticeFormDialog> | null>(null)
const detailVisible = ref(false)
const detailNotice = ref<Notice | null>(null)
const publishVisible = ref(false)
const publishingNotice = ref<Notice | null>(null)

const canQuery = computed(() => hasPermission('system:notice:query'))
const canCreate = computed(() => hasPermission('system:notice:create'))
const canUpdate = computed(() => hasPermission('system:notice:update'))
const canDelete = computed(() => hasPermission('system:notice:delete'))
const canPublish = computed(() => hasPermission('system:notice:publish'))

const statusOptions = computed(() => [
  { label: t('notice.draft'), value: 'DRAFT' },
  { label: t('notice.published'), value: 'PUBLISHED' },
])

const searchFields = computed<ProTableSearchField[]>(() => [
  {
    prop: 'keyword',
    label: t('notice.keyword'),
    type: 'input',
    placeholder: t('notice.searchPlaceholder'),
    defaultValue: '',
  },
  {
    prop: 'status',
    label: t('notice.status'),
    type: 'select',
    options: statusOptions.value,
    placeholder: t('notice.statusPlaceholder'),
    defaultValue: null,
  },
])

const columns = computed<ProTableColumn<Notice>[]>(() => [
  {
    prop: 'title',
    label: t('notice.title'),
    minWidth: 200,
    showOverflowTooltip: true,
  },
  {
    prop: 'status',
    label: t('notice.status'),
    width: 100,
    align: 'center',
    type: 'slot',
    slot: 'status',
  },
  {
    prop: 'targetScope',
    label: t('notice.targetScope'),
    width: 120,
    align: 'center',
    type: 'slot',
    slot: 'targetScope',
  },
  {
    prop: 'publishedAt',
    label: t('notice.publishedAt'),
    minWidth: 170,
    formatter: (row) => formatDateTime(row.publishedAt, locale.value),
  },
  {
    prop: 'createdAt',
    label: t('notice.createdAt'),
    minWidth: 170,
    formatter: (row) => formatDateTime(row.createdAt, locale.value),
  },
  {
    prop: 'updatedAt',
    label: t('notice.updatedAt'),
    minWidth: 170,
    formatter: (row) => formatDateTime(row.updatedAt, locale.value),
  },
  {
    key: 'actions',
    label: t('common.actions'),
    width: 150,
    fixed: 'right',
    type: 'slot',
    slot: 'actions',
  },
])

const noticeActions = computed<ProTableAction<Notice>[]>(() => [
  {
    key: 'detail',
    label: t('notice.detail'),
    placement: 'inline',
    onClick: openDetail,
  },
  {
    key: 'edit',
    label: t('common.edit'),
    placement: 'inline',
    visible: canUpdate.value,
    onClick: openEdit,
  },
  {
    key: 'publish',
    label: t('notice.publish'),
    placement: 'inline',
    visible: (row) => canPublish.value && row.status === 'DRAFT',
    onClick: handlePublish,
  },
  {
    key: 'delete',
    label: t('common.delete'),
    danger: true,
    visible: canDelete.value,
    onClick: handleDelete,
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

function statusLabel(status: NoticeStatus): string {
  return status === 'PUBLISHED' ? t('notice.published') : t('notice.draft')
}

const targetScopeLabelKeys: Record<NoticeTargetScope, string> = {
  ALL: 'scopeAll',
  USER: 'scopeUser',
  ROLE: 'scopeRole',
  POST: 'scopePost',
  DEPT: 'scopeDept',
}

function targetScopeLabel(scope: NoticeTargetScope): string {
  return t(`notice.${targetScopeLabelKeys[scope]}`)
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message
  if (error instanceof Error) return error.message
  return t('notice.requestFailed')
}

function handleRequestError(error: unknown): void {
  message.error(errorMessage(error))
}

async function requestNotices(params: ProTableRequestParams) {
  if (!canQuery.value) return { items: [], total: 0 }
  return fetchNoticeList(mapNoticeQuery(params))
}

function openCreate(): void {
  formMode.value = 'create'
  editingNotice.value = null
  formVisible.value = true
}

function openEdit(row: Notice): void {
  formMode.value = 'edit'
  editingNotice.value = row
  formVisible.value = true
}

function openDetail(row: Notice): void {
  detailNotice.value = row
  detailVisible.value = true
}

async function handleFormSubmit(payload: NoticePayload | UpdateNoticePayload): Promise<void> {
  formDialogRef.value?.setSubmitting(true)
  try {
    if (formMode.value === 'create') {
      await createNotice(payload as NoticePayload)
      message.success(t('notice.createSuccess'))
    } else if (editingNotice.value) {
      await updateNotice(editingNotice.value.id, payload as UpdateNoticePayload)
      message.success(t('notice.updateSuccess'))
    }
    formVisible.value = false
    await tableRef.value?.reload()
  } catch (error) {
    message.error(errorMessage(error))
  } finally {
    formDialogRef.value?.setSubmitting(false)
  }
}

function handlePublish(row: Notice): void {
  publishingNotice.value = row
  publishVisible.value = true
}

async function handlePublishSuccess(): Promise<void> {
  await tableRef.value?.reload()
}

async function handleDelete(row: Notice): Promise<void> {
  const confirmed = await new Promise<boolean>((resolve) => {
    Modal.confirm({
      title: t('common.tip'),
      content: t('notice.deleteConfirm', { title: row.title }),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      okType: 'danger',
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
  if (!confirmed) return

  try {
    await deleteNotice(row.id)
    message.success(t('notice.deleteSuccess'))
    await tableRef.value?.reload()
  } catch (error) {
    message.error(errorMessage(error))
  }
}
</script>

<template>
  <div class="notice-page">
    <ProTable
      ref="tableRef"
      :columns="columns"
      :search-fields="searchFields"
      :request="requestNotices"
      :immediate="canQuery"
      :show-request-error="false"
      @request-error="handleRequestError"
    >
      <template #toolbar-actions>
        <Button v-if="canCreate" type="primary" @click="openCreate">
          <PlusOutlined />
          {{ t('notice.create') }}
        </Button>
      </template>

      <template #column-status="{ row }">
        <Tag :color="row.status === 'PUBLISHED' ? 'green' : 'default'">
          {{ statusLabel(row.status) }}
        </Tag>
      </template>

      <template #column-targetScope="{ row }">
        <Tag>{{ targetScopeLabel(row.targetScope) }}</Tag>
      </template>

      <template #column-actions="{ row }">
        <ProTableActions :row="row" :actions="noticeActions" />
      </template>
    </ProTable>

    <NoticeFormDialog
      ref="formDialogRef"
      v-model:model-value="formVisible"
      :mode="formMode"
      :editing="editingNotice"
      @submit="handleFormSubmit"
    />

    <PublishNoticeDialog
      v-if="publishingNotice"
      v-model="publishVisible"
      :notice-id="publishingNotice.id"
      @success="handlePublishSuccess"
    />

    <Modal
      v-model:open="detailVisible"
      :title="t('notice.detailTitle')"
      width="720px"
      destroy-on-hidden
      :footer="null"
    >
      <Descriptions v-if="detailNotice" :column="1" size="small" bordered>
        <DescriptionsItem :label="t('notice.title')">{{ detailNotice.title }}</DescriptionsItem>
        <DescriptionsItem :label="t('notice.status')">
          {{ statusLabel(detailNotice.status) }}
        </DescriptionsItem>
        <DescriptionsItem :label="t('notice.publishedAt')">
          {{ formatDateTime(detailNotice.publishedAt, locale) }}
        </DescriptionsItem>
        <DescriptionsItem :label="t('notice.content')">
          <pre class="notice-page__content">{{ detailNotice.content }}</pre>
        </DescriptionsItem>
      </Descriptions>
    </Modal>
  </div>
</template>

<style scoped lang="scss">
.notice-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  min-height: 0;
}

.notice-page__content {
  margin: 0;
  max-height: 360px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 13px;
  line-height: 1.6;
  background: #fafafa;
  border-radius: 6px;
  padding: 8px 12px;
}
</style>
