<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Modal, message } from 'antdv-next'

import { createPost, deletePost, fetchPostList, updatePost } from '@/api/post'
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
import type { Post, PostPayload, UpdatePostPayload } from '@/types/post'
import { ApiRequestError } from '@/utils/request'
import PostFormDialog from './PostFormDialog.vue'

const { locale, t } = useI18n()
const { hasPermission } = usePermission()

const tableRef = ref<ProTableExpose<Post> | null>(null)
const formVisible = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editingPost = ref<Post | null>(null)
const formDialogRef = ref<InstanceType<typeof PostFormDialog> | null>(null)

const canCreate = computed(() => hasPermission('system:post:create'))
const canUpdate = computed(() => hasPermission('system:post:update'))
const canDelete = computed(() => hasPermission('system:post:delete'))

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

const searchFields = computed<ProTableSearchField[]>(() => [
  {
    prop: 'keyword',
    label: t('post.keyword'),
    type: 'input',
    placeholder: t('post.searchPlaceholder'),
    defaultValue: '',
  },
])

const columns = computed<ProTableColumn<Post>[]>(() => [
  { prop: 'code', label: t('post.code'), minWidth: 160, showOverflowTooltip: true },
  { prop: 'name', label: t('post.name'), minWidth: 160, showOverflowTooltip: true },
  { prop: 'sort', label: t('post.sort'), width: 80 },
  { prop: 'enabled', label: t('post.enabled'), width: 90, type: 'tag' },
  {
    prop: 'description',
    label: t('post.description'),
    minWidth: 180,
    showOverflowTooltip: true,
  },
  {
    prop: 'createdAt',
    label: t('post.createdAt'),
    minWidth: 170,
    formatter: (row) => formatDateTime(row.createdAt, locale.value),
  },
  {
    prop: 'updatedAt',
    label: t('post.updatedAt'),
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

const postActions = computed<ProTableAction<Post>[]>(() => [
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
  return t('post.requestFailed')
}

function handleRequestError(error: unknown): void {
  message.error(errorMessage(error))
}

async function requestPosts(params: ProTableRequestParams) {
  return fetchPostList({
    page: params.page,
    pageSize: params.pageSize,
    keyword: String(params.keyword ?? '').trim() || undefined,
  })
}

function openCreate(): void {
  formMode.value = 'create'
  editingPost.value = null
  formVisible.value = true
}

function openEdit(row: Post): void {
  formMode.value = 'edit'
  editingPost.value = row
  formVisible.value = true
}

async function handleFormSubmit(payload: PostPayload | UpdatePostPayload): Promise<void> {
  formDialogRef.value?.setSubmitting(true)
  try {
    if (formMode.value === 'create') {
      await createPost(payload as PostPayload)
      message.success(t('post.createSuccess'))
    } else if (editingPost.value) {
      await updatePost(editingPost.value.id, payload as UpdatePostPayload)
      message.success(t('post.updateSuccess'))
    }
    formVisible.value = false
    await tableRef.value?.reload()
  } catch (error) {
    message.error(errorMessage(error))
  } finally {
    formDialogRef.value?.setSubmitting(false)
  }
}

async function handleDelete(row: Post): Promise<void> {
  const confirmed = await new Promise<boolean>((resolve) => {
    Modal.confirm({
      title: t('common.tip'),
      content: t('post.deleteConfirm', { name: row.name }),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      okType: 'danger',
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
  if (!confirmed) return

  try {
    await deletePost(row.id)
    message.success(t('post.deleteSuccess'))
    await tableRef.value?.reload()
  } catch (error) {
    message.error(errorMessage(error))
  }
}
</script>

<template>
  <div class="post-page">
    <ProTable
      ref="tableRef"
      :columns="columns"
      :search-fields="searchFields"
      :request="requestPosts"
      :show-request-error="false"
      @request-error="handleRequestError"
    >
      <template #toolbar-actions>
        <Button v-if="canCreate" type="primary" @click="openCreate">
          {{ t('post.create') }}
        </Button>
      </template>

      <template #column-actions="{ row }">
        <ProTableActions :row="row" :actions="postActions" />
      </template>
    </ProTable>

    <PostFormDialog
      ref="formDialogRef"
      v-model="formVisible"
      :mode="formMode"
      :editing="editingPost"
      @submit="handleFormSubmit"
    />
  </div>
</template>

<style scoped lang="scss">
.post-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
