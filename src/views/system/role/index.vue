<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Modal, message } from 'antdv-next'

import { fetchDeptTree } from '@/api/dept'
import { fetchPermissionTree } from '@/api/permission'
import {
  assignRolePermissions,
  createRole,
  deleteRole,
  fetchRoleDepts,
  fetchRoleList,
  fetchRolePermissions,
  updateRole,
} from '@/api/role'
import ProTable from '@/components/ProTable/index.vue'
import ProTableActions from '@/components/ProTableActions/index.vue'
import { usePermission } from '@/composables/usePermission'
import type { DeptTreeNode } from '@/types/dept'
import type { PermissionTreeNode } from '@/types/permission'
import type {
  ProTableAction,
  ProTableColumn,
  ProTableExpose,
  ProTableRequestParams,
  ProTableSearchField,
} from '@/types/pro-table'
import { SUPER_ADMIN_ROLE_CODE, type Role, type RolePayload } from '@/types/role'
import { ApiRequestError } from '@/utils/request'
import RoleFormDialog from './RoleFormDialog.vue'
import RolePermissionDialog from './RolePermissionDialog.vue'

const { t } = useI18n()
const { hasPermission } = usePermission()

const tableRef = ref<ProTableExpose<Role> | null>(null)

const deptTree = ref<DeptTreeNode[]>([])
const permissionTree = ref<PermissionTreeNode[]>([])

const formVisible = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editingRole = ref<Role | null>(null)
const initialDeptIds = ref<string[]>([])
const formDialogRef = ref<InstanceType<typeof RoleFormDialog> | null>(null)

const permissionVisible = ref(false)
const permissionRole = ref<Role | null>(null)
const permissionCheckedIds = ref<string[]>([])
const permissionDialogRef = ref<InstanceType<typeof RolePermissionDialog> | null>(null)

const canCreate = computed(() => hasPermission('system:role:create'))
const canUpdate = computed(() => hasPermission('system:role:update'))
const canDelete = computed(() => hasPermission('system:role:delete'))
const canAssign = computed(() => hasPermission('system:role:assignPermissions'))

const searchFields = computed<ProTableSearchField[]>(() => [
  {
    prop: 'keyword',
    label: t('role.keyword'),
    type: 'input',
    placeholder: t('role.searchPlaceholder'),
    defaultValue: '',
  },
])

const columns = computed<ProTableColumn<Role>[]>(() => [
  { prop: 'name', label: t('role.name'), minWidth: 140 },
  { prop: 'code', label: t('role.code'), minWidth: 140 },
  {
    prop: 'dataScope',
    label: t('role.dataScope'),
    minWidth: 140,
    formatter: (row) => t(`role.dataScope_${row.dataScope}`),
  },
  {
    prop: 'description',
    label: t('role.description'),
    minWidth: 180,
    showOverflowTooltip: true,
  },
  { prop: 'sort', label: t('role.sort'), width: 80 },
  { prop: 'enabled', label: t('role.enabled'), width: 90, type: 'tag' as const },
  {
    key: 'actions',
    label: t('common.actions'),
    width: 120,
    fixed: 'right' as const,
    type: 'slot' as const,
    slot: 'actions',
  },
])

const roleActions = computed<ProTableAction<Role>[]>(() => [
  {
    key: 'edit',
    label: t('common.edit'),
    placement: 'inline',
    visible: canUpdate.value,
    onClick: openEdit,
  },
  {
    key: 'assignPermissions',
    label: t('role.assignPermissions'),
    visible: (row) => canAssign.value && !isSuperAdmin(row),
    onClick: openAssignPermissions,
  },
  {
    key: 'delete',
    label: t('common.delete'),
    danger: true,
    visible: (row) => canDelete.value && !isSuperAdmin(row),
    onClick: handleDelete,
  },
])

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message
  if (error instanceof Error) return error.message
  return t('role.requestFailed')
}

function handleRequestError(error: unknown): void {
  message.error(errorMessage(error))
}

function isSuperAdmin(role: Role): boolean {
  return role.code === SUPER_ADMIN_ROLE_CODE
}

async function requestRoles(params: ProTableRequestParams) {
  return fetchRoleList({ page: params.page, pageSize: params.pageSize })
}

function filterRoles(items: Role[], params: ProTableRequestParams): Role[] {
  const q = String(params.keyword ?? '')
    .trim()
    .toLowerCase()
  if (!q) return items
  return items.filter((item) => {
    return item.name.toLowerCase().includes(q) || item.code.toLowerCase().includes(q)
  })
}

async function ensureDeptTree(): Promise<void> {
  if (deptTree.value.length || !hasPermission('system:dept:query')) return
  try {
    deptTree.value = await fetchDeptTree()
  } catch {
    deptTree.value = []
  }
}

async function ensurePermissionTree(): Promise<void> {
  if (permissionTree.value.length || !hasPermission('system:permission:query')) return
  try {
    permissionTree.value = await fetchPermissionTree()
  } catch (error) {
    message.error(errorMessage(error))
  }
}

async function openCreate(): Promise<void> {
  await ensureDeptTree()
  formMode.value = 'create'
  editingRole.value = null
  initialDeptIds.value = []
  formVisible.value = true
}

async function openEdit(row: Role): Promise<void> {
  await ensureDeptTree()
  formMode.value = 'edit'
  editingRole.value = row
  initialDeptIds.value = []

  if (row.dataScope === 'CUSTOM') {
    try {
      const depts = await fetchRoleDepts(row.id)
      initialDeptIds.value = depts.map((item) => item.id)
    } catch (error) {
      message.error(errorMessage(error))
      return
    }
  }

  formVisible.value = true
}

async function openAssignPermissions(row: Role): Promise<void> {
  if (isSuperAdmin(row)) {
    message.warning(t('role.superAdminProtected'))
    return
  }

  await ensurePermissionTree()
  if (!permissionTree.value.length) {
    message.warning(t('role.permissionEmpty'))
    return
  }

  try {
    const permissions = await fetchRolePermissions(row.id)
    permissionRole.value = row
    permissionCheckedIds.value = permissions.map((item) => item.id)
    permissionVisible.value = true
  } catch (error) {
    message.error(errorMessage(error))
  }
}

async function handleFormSubmit(payload: RolePayload): Promise<void> {
  formDialogRef.value?.setSubmitting(true)
  try {
    if (formMode.value === 'create') {
      await createRole(payload)
      message.success(t('role.createSuccess'))
    } else if (editingRole.value) {
      await updateRole(editingRole.value.id, payload)
      message.success(t('role.updateSuccess'))
    }
    formVisible.value = false
    await tableRef.value?.reload()
  } catch (error) {
    message.error(errorMessage(error))
  } finally {
    formDialogRef.value?.setSubmitting(false)
  }
}

async function handlePermissionSubmit(permissionIds: string[]): Promise<void> {
  if (!permissionRole.value) return
  permissionDialogRef.value?.setSubmitting(true)
  try {
    await assignRolePermissions(permissionRole.value.id, permissionIds)
    message.success(t('role.assignSuccess'))
    permissionVisible.value = false
  } catch (error) {
    message.error(errorMessage(error))
  } finally {
    permissionDialogRef.value?.setSubmitting(false)
  }
}

async function handleDelete(row: Role): Promise<void> {
  if (isSuperAdmin(row)) {
    message.warning(t('role.superAdminProtected'))
    return
  }

  const confirmed = await new Promise<boolean>((resolve) => {
    Modal.confirm({
      title: t('common.tip'),
      content: t('role.deleteConfirm', { name: row.name }),
      okType: 'danger',
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
  if (!confirmed) return

  try {
    await deleteRole(row.id)
    message.success(t('role.deleteSuccess'))
    await tableRef.value?.reload()
  } catch (error) {
    message.error(errorMessage(error))
  }
}
</script>

<template>
  <div class="role-page">
    <ProTable
      ref="tableRef"
      :columns="columns"
      :search-fields="searchFields"
      :request="requestRoles"
      :client-filter="filterRoles"
      :show-request-error="false"
      @request-error="handleRequestError"
    >
      <template #toolbar-actions>
        <Button v-if="canCreate" type="primary" @click="openCreate">
          {{ t('role.create') }}
        </Button>
      </template>

      <template #column-actions="{ row }">
        <ProTableActions :row="row" :actions="roleActions" />
      </template>
    </ProTable>

    <RoleFormDialog
      ref="formDialogRef"
      v-model="formVisible"
      :mode="formMode"
      :editing="editingRole"
      :dept-tree="deptTree"
      :initial-dept-ids="initialDeptIds"
      @submit="handleFormSubmit"
    />

    <RolePermissionDialog
      ref="permissionDialogRef"
      v-model="permissionVisible"
      :role="permissionRole"
      :permission-tree="permissionTree"
      :checked-ids="permissionCheckedIds"
      @submit="handlePermissionSubmit"
    />
  </div>
</template>

<style scoped lang="scss">
.role-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  min-height: 0;
}
</style>
