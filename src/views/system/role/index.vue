<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElButton, ElMessage, ElMessageBox } from 'element-plus'

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
import { usePermission } from '@/composables/usePermission'
import type { DeptTreeNode } from '@/types/dept'
import type { PermissionTreeNode } from '@/types/permission'
import type {
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
    label: t('common.actions'),
    width: 260,
    fixed: 'right' as const,
    type: 'slot' as const,
    slot: 'actions',
  },
])

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message
  if (error instanceof Error) return error.message
  return t('role.requestFailed')
}

function handleRequestError(error: unknown): void {
  ElMessage.error(errorMessage(error))
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
    ElMessage.error(errorMessage(error))
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
      ElMessage.error(errorMessage(error))
      return
    }
  }

  formVisible.value = true
}

async function openAssignPermissions(row: Role): Promise<void> {
  if (isSuperAdmin(row)) {
    ElMessage.warning(t('role.superAdminProtected'))
    return
  }

  await ensurePermissionTree()
  if (!permissionTree.value.length) {
    ElMessage.warning(t('role.permissionEmpty'))
    return
  }

  try {
    const permissions = await fetchRolePermissions(row.id)
    permissionRole.value = row
    permissionCheckedIds.value = permissions.map((item) => item.id)
    permissionVisible.value = true
  } catch (error) {
    ElMessage.error(errorMessage(error))
  }
}

async function handleFormSubmit(payload: RolePayload): Promise<void> {
  formDialogRef.value?.setSubmitting(true)
  try {
    if (formMode.value === 'create') {
      await createRole(payload)
      ElMessage.success(t('role.createSuccess'))
    } else if (editingRole.value) {
      await updateRole(editingRole.value.id, payload)
      ElMessage.success(t('role.updateSuccess'))
    }
    formVisible.value = false
    await tableRef.value?.reload()
  } catch (error) {
    ElMessage.error(errorMessage(error))
  } finally {
    formDialogRef.value?.setSubmitting(false)
  }
}

async function handlePermissionSubmit(permissionIds: string[]): Promise<void> {
  if (!permissionRole.value) return
  permissionDialogRef.value?.setSubmitting(true)
  try {
    await assignRolePermissions(permissionRole.value.id, permissionIds)
    ElMessage.success(t('role.assignSuccess'))
    permissionVisible.value = false
  } catch (error) {
    ElMessage.error(errorMessage(error))
  } finally {
    permissionDialogRef.value?.setSubmitting(false)
  }
}

async function handleDelete(row: Role): Promise<void> {
  if (isSuperAdmin(row)) {
    ElMessage.warning(t('role.superAdminProtected'))
    return
  }

  try {
    await ElMessageBox.confirm(t('role.deleteConfirm', { name: row.name }), t('common.tip'), {
      type: 'warning',
    })
  } catch {
    return
  }

  try {
    await deleteRole(row.id)
    ElMessage.success(t('role.deleteSuccess'))
    await tableRef.value?.reload()
  } catch (error) {
    ElMessage.error(errorMessage(error))
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
        <el-button v-if="canCreate" type="primary" @click="openCreate">
          {{ t('role.create') }}
        </el-button>
      </template>

      <template #column-actions="{ row }">
        <el-button v-if="canUpdate" link type="primary" @click="openEdit(row)">
          {{ t('common.edit') }}
        </el-button>
        <el-button
          v-if="canAssign && !isSuperAdmin(row)"
          link
          type="primary"
          @click="openAssignPermissions(row)"
        >
          {{ t('role.assignPermissions') }}
        </el-button>
        <el-button
          v-if="canDelete && !isSuperAdmin(row)"
          link
          type="danger"
          @click="handleDelete(row)"
        >
          {{ t('common.delete') }}
        </el-button>
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
}
</style>
