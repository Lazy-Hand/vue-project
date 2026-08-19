<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Modal, message } from 'antdv-next'

import { createDept, deleteDept, fetchDeptTree, updateDept } from '@/api/dept'
import ProTable from '@/components/ProTable/index.vue'
import ProTableActions from '@/components/ProTableActions/index.vue'
import { usePermission } from '@/composables/usePermission'
import type { DeptPayload, DeptTreeNode } from '@/types/dept'
import type {
  ProTableAction,
  ProTableColumn,
  ProTableExpose,
  ProTableRequestParams,
  ProTableSearchField,
} from '@/types/pro-table'
import { ApiRequestError } from '@/utils/request'
import DeptFormDialog from './DeptFormDialog.vue'
import { filterTreeByKeyword, findDeptNode } from './utils'

const { locale, t } = useI18n()
const { hasPermission } = usePermission()

const tableRef = ref<ProTableExpose<DeptTreeNode> | null>(null)
const tree = ref<DeptTreeNode[]>([])
const expandAll = ref(true)

const dialogVisible = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const editingNode = ref<DeptTreeNode | null>(null)
const initialParentId = ref<string | null>(null)
const formDialogRef = ref<InstanceType<typeof DeptFormDialog> | null>(null)

const canCreate = computed(() => hasPermission('system:dept:create'))
const canUpdate = computed(() => hasPermission('system:dept:update'))
const canDelete = computed(() => hasPermission('system:dept:delete'))

function formatDateTime(value: string | undefined, localeCode: string): string {
  if (!value) return ''
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
    label: t('dept.keyword'),
    type: 'input',
    placeholder: t('dept.searchPlaceholder'),
    defaultValue: '',
  },
])

const columns = computed<ProTableColumn<DeptTreeNode>[]>(() => [
  { prop: 'name', label: t('dept.name'), minWidth: 220 },
  { prop: 'code', label: t('dept.code'), minWidth: 160 },
  { prop: 'leader', label: t('dept.leader'), minWidth: 120 },
  { prop: 'phone', label: t('dept.phone'), minWidth: 140 },
  { prop: 'sort', label: t('dept.sort'), width: 80 },
  { prop: 'enabled', label: t('dept.enabled'), width: 90, type: 'tag' },
  {
    prop: 'createdAt',
    label: t('dept.createdAt'),
    minWidth: 170,
    formatter: (row) => formatDateTime(row.createdAt, locale.value),
  },
  {
    prop: 'updatedAt',
    label: t('dept.updatedAt'),
    minWidth: 170,
    formatter: (row) => formatDateTime(row.updatedAt, locale.value),
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

const nodeActions = computed<ProTableAction<DeptTreeNode>[]>(() => [
  {
    key: 'createChild',
    label: t('dept.createChild'),
    visible: canCreate.value,
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
  return t('dept.requestFailed')
}

function handleRequestError(error: unknown): void {
  message.error(errorMessage(error))
}

async function requestDepartments(): Promise<DeptTreeNode[]> {
  const result = await fetchDeptTree()
  tree.value = result
  return result
}

function filterDepartments(items: DeptTreeNode[], params: ProTableRequestParams): DeptTreeNode[] {
  return filterTreeByKeyword(items, String(params.keyword ?? ''))
}

function openCreate(parentId?: string | null): void {
  dialogMode.value = 'create'
  editingNode.value = null
  initialParentId.value = parentId ?? null
  dialogVisible.value = true
}

function openEdit(row: DeptTreeNode): void {
  dialogMode.value = 'edit'
  // The table may provide a filtered clone; use the full tree so every
  // descendant is excluded from the parent selector.
  editingNode.value = findDeptNode(tree.value, row.id) ?? row
  initialParentId.value = row.parentId
  dialogVisible.value = true
}

async function handleSubmit(payload: DeptPayload): Promise<void> {
  formDialogRef.value?.setSubmitting(true)
  try {
    if (dialogMode.value === 'create') {
      await createDept(payload)
      message.success(t('dept.createSuccess'))
    } else if (editingNode.value) {
      await updateDept(editingNode.value.id, payload)
      message.success(t('dept.updateSuccess'))
    }
    dialogVisible.value = false
    await tableRef.value?.reload()
  } catch (error) {
    message.error(errorMessage(error))
  } finally {
    formDialogRef.value?.setSubmitting(false)
  }
}

async function handleDelete(row: DeptTreeNode): Promise<void> {
  const confirmed = await new Promise<boolean>((resolve) => {
    Modal.confirm({
      title: t('common.tip'),
      content: t('dept.deleteConfirm', { name: row.name }),
      okType: 'danger',
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
  if (!confirmed) return

  try {
    await deleteDept(row.id)
    message.success(t('dept.deleteSuccess'))
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
  <div class="dept-page">
    <ProTable
      ref="tableRef"
      :columns="columns"
      :search-fields="searchFields"
      :request="requestDepartments"
      :client-filter="filterDepartments"
      :pagination="false"
      :default-expand-all="expandAll"
      :tree-props="{ children: 'children' }"
      :show-request-error="false"
      @request-error="handleRequestError"
    >
      <template #toolbar-actions>
        <Button type="default" @click="toggleExpand">
          {{ expandAll ? t('proTable.collapse') : t('proTable.expand') }}
        </Button>
        <Button v-if="canCreate" type="primary" @click="openCreate()">
          {{ t('dept.create') }}
        </Button>
      </template>

      <template #column-actions="{ row }">
        <ProTableActions :row="row" :actions="nodeActions" />
      </template>
    </ProTable>

    <DeptFormDialog
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
.dept-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  min-height: 0;
}
</style>
