<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Modal, message } from 'antdv-next'

import {
  createPermission,
  deletePermission,
  fetchPermissionTree,
  updatePermission,
} from '@/api/permission'
import MenuIcon from '@/components/MenuIcon/index.vue'
import ProTable from '@/components/ProTable/index.vue'
import ProTableActions from '@/components/ProTableActions/index.vue'
import { usePermission } from '@/composables/usePermission'
import type { PermissionPayload, PermissionTreeNode, PermissionType } from '@/types/permission'
import type {
  ProTableAction,
  ProTableColumn,
  ProTableExpose,
  ProTableRequestParams,
  ProTableSearchField,
} from '@/types/pro-table'
import { ApiRequestError } from '@/utils/request'
import PermissionFormDialog from './PermissionFormDialog.vue'
import { filterTreeByKeyword } from './utils'

const { t } = useI18n()
const { hasPermission } = usePermission()

const tableRef = ref<ProTableExpose<PermissionTreeNode> | null>(null)
const tree = ref<PermissionTreeNode[]>([])
const expandAll = ref(true)

const dialogVisible = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const editingNode = ref<PermissionTreeNode | null>(null)
const initialParentId = ref<string | null>(null)
const formDialogRef = ref<InstanceType<typeof PermissionFormDialog> | null>(null)

const canCreate = computed(() => hasPermission('system:permission:create'))
const canUpdate = computed(() => hasPermission('system:permission:update'))
const canDelete = computed(() => hasPermission('system:permission:delete'))

const searchFields = computed<ProTableSearchField[]>(() => [
  {
    prop: 'keyword',
    label: t('permission.keyword'),
    type: 'input',
    placeholder: t('permission.searchPlaceholder'),
    defaultValue: '',
  },
])

const columns = computed<ProTableColumn<PermissionTreeNode>[]>(() => [
  {
    prop: 'name',
    label: t('permission.name'),
    minWidth: 220,
    type: 'slot',
    slot: 'name',
  },
  { prop: 'code', label: t('permission.code'), minWidth: 180 },
  {
    prop: 'type',
    label: t('permission.type'),
    width: 110,
    type: 'tag',
    formatter: (row) => typeLabel(row.type),
    tagTypeMap: {
      DIRECTORY: 'primary',
      MENU: 'success',
      BUTTON: 'info',
    },
  },
  {
    prop: 'path',
    label: t('permission.path'),
    minWidth: 160,
    showOverflowTooltip: true,
  },
  {
    prop: 'component',
    label: t('permission.component'),
    minWidth: 160,
    showOverflowTooltip: true,
  },
  { prop: 'sort', label: t('permission.sort'), width: 80 },
  { prop: 'enabled', label: t('permission.enabled'), width: 90, type: 'tag' },
  {
    key: 'actions',
    label: t('common.actions'),
    width: 280,
    fixed: 'right',
    type: 'slot',
    slot: 'actions',
  },
])

function typeLabel(type: PermissionType): string {
  if (type === 'DIRECTORY') return t('permission.typeDirectory')
  if (type === 'MENU') return t('permission.typeMenu')
  return t('permission.typeButton')
}

const nodeActions = computed<ProTableAction<PermissionTreeNode>[]>(() => [
  {
    key: 'createChild',
    label: t('permission.createChild'),
    visible: (row) => canCreate.value && row.type !== 'BUTTON',
    onClick: (row) => openCreate(row.id),
  },
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
  return t('permission.requestFailed')
}

function handleRequestError(error: unknown): void {
  message.error(errorMessage(error))
}

async function requestPermissions(): Promise<PermissionTreeNode[]> {
  const result = await fetchPermissionTree()
  tree.value = result
  return result
}

function filterPermissions(
  items: PermissionTreeNode[],
  params: ProTableRequestParams,
): PermissionTreeNode[] {
  return filterTreeByKeyword(items, String(params.keyword ?? ''))
}

function openCreate(parentId?: string | null): void {
  dialogMode.value = 'create'
  editingNode.value = null
  initialParentId.value = parentId ?? null
  dialogVisible.value = true
}

function openEdit(row: PermissionTreeNode): void {
  dialogMode.value = 'edit'
  editingNode.value = row
  initialParentId.value = row.parentId
  dialogVisible.value = true
}

async function handleSubmit(payload: PermissionPayload): Promise<void> {
  formDialogRef.value?.setSubmitting(true)
  try {
    if (dialogMode.value === 'create') {
      await createPermission(payload)
      message.success(t('permission.createSuccess'))
    } else if (editingNode.value) {
      await updatePermission(editingNode.value.id, payload)
      message.success(t('permission.updateSuccess'))
    }
    dialogVisible.value = false
    await tableRef.value?.reload()
  } catch (error) {
    message.error(errorMessage(error))
  } finally {
    formDialogRef.value?.setSubmitting(false)
  }
}

async function handleDelete(row: PermissionTreeNode): Promise<void> {
  const confirmed = await new Promise<boolean>((resolve) => {
    Modal.confirm({
      title: t('common.tip'),
      content: t('permission.deleteConfirm', { name: row.name }),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      okType: 'danger',
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
  if (!confirmed) return

  try {
    await deletePermission(row.id)
    message.success(t('permission.deleteSuccess'))
    await tableRef.value?.reload()
  } catch (error) {
    message.error(errorMessage(error))
  }
}

function toggleExpand(): void {
  expandAll.value = !expandAll.value
  tableRef.value?.setAllRowsExpanded(expandAll.value)
}
</script>

<template>
  <div class="permission-page">
    <ProTable
      ref="tableRef"
      :columns="columns"
      :search-fields="searchFields"
      :request="requestPermissions"
      :client-filter="filterPermissions"
      :pagination="false"
      :default-expand-all="expandAll"
      :tree-props="{ children: 'children' }"
      :show-request-error="false"
      @request-error="handleRequestError"
    >
      <template #toolbar-actions>
        <Button type="default" @click="toggleExpand">
          {{ expandAll ? t('permission.collapseAll') : t('permission.expandAll') }}
        </Button>
        <Button v-if="canCreate" type="primary" @click="openCreate()">
          {{ t('permission.create') }}
        </Button>
      </template>

      <template #column-name="{ row }">
        <span class="permission-page__name-cell">
          <MenuIcon v-if="row.icon" :icon="row.icon" class="permission-page__icon" />
          <span>{{ row.name }}</span>
        </span>
      </template>

      <template #column-actions="{ row }">
        <ProTableActions :row="row" :actions="nodeActions" />
      </template>
    </ProTable>

    <PermissionFormDialog
      ref="formDialogRef"
      v-model="dialogVisible"
      :mode="dialogMode"
      :tree="tree"
      :editing="editingNode"
      :initial-parent-id="initialParentId"
      @submit="handleSubmit"
    />
  </div>
</template>

<style scoped lang="scss">
.permission-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.permission-page__name-cell {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.permission-page__icon {
  font-size: 16px;
  color: var(--ant-color-text-secondary);
}
</style>
