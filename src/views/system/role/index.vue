<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ElButton,
  ElInput,
  ElMessage,
  ElMessageBox,
  ElPagination,
  ElTable,
  ElTableColumn,
  ElTag,
} from 'element-plus'

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
import { usePermission } from '@/composables/usePermission'
import type { DeptTreeNode } from '@/types/dept'
import type { PermissionTreeNode } from '@/types/permission'
import {
  SUPER_ADMIN_ROLE_CODE,
  type Role,
  type RolePayload,
} from '@/types/role'
import { ApiRequestError } from '@/utils/request'
import RoleFormDialog from './RoleFormDialog.vue'
import RolePermissionDialog from './RolePermissionDialog.vue'

const { t } = useI18n()
const { hasPermission } = usePermission()

const loading = ref(false)
const keyword = ref('')
const roles = ref<Role[]>([])
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)

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

const displayRoles = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  if (!q) return roles.value
  return roles.value.filter(
    (role) => role.name.toLowerCase().includes(q) || role.code.toLowerCase().includes(q),
  )
})

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message
  if (error instanceof Error) return error.message
  return t('role.requestFailed')
}

function dataScopeLabel(scope: Role['dataScope']): string {
  return t(`role.dataScope_${scope}`)
}

function isSuperAdmin(role: Role): boolean {
  return role.code === SUPER_ADMIN_ROLE_CODE
}

function isSuperAdminRow(row: unknown): boolean {
  return isSuperAdmin(row as Role)
}

async function loadRoles(): Promise<void> {
  loading.value = true
  try {
    const result = await fetchRoleList({ page: page.value, pageSize: pageSize.value })
    roles.value = result.items
    total.value = result.total
  } catch (error) {
    ElMessage.error(errorMessage(error))
  } finally {
    loading.value = false
  }
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
    await loadRoles()
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
    if (roles.value.length === 1 && page.value > 1) {
      page.value -= 1
    }
    await loadRoles()
  } catch (error) {
    ElMessage.error(errorMessage(error))
  }
}

function onEdit(row: unknown): void {
  void openEdit(row as Role)
}

function onAssign(row: unknown): void {
  void openAssignPermissions(row as Role)
}

function onDelete(row: unknown): void {
  void handleDelete(row as Role)
}

function handlePageChange(next: number): void {
  page.value = next
  void loadRoles()
}

function handleSizeChange(size: number): void {
  pageSize.value = size
  page.value = 1
  void loadRoles()
}

onMounted(() => {
  void loadRoles()
})
</script>

<template>
  <div class="role-page">
    <div class="role-page__toolbar">
      <el-input
        v-model="keyword"
        clearable
        class="role-page__search"
        :placeholder="t('role.searchPlaceholder')"
      />
      <div class="role-page__actions">
        <el-button @click="loadRoles">{{ t('common.refresh') }}</el-button>
        <el-button v-if="canCreate" type="primary" @click="openCreate">
          {{ t('role.create') }}
        </el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="displayRoles" row-key="id" class="role-page__table">
      <el-table-column prop="name" :label="t('role.name')" min-width="140" />
      <el-table-column prop="code" :label="t('role.code')" min-width="140" />
      <el-table-column :label="t('role.dataScope')" min-width="140">
        <template #default="{ row }">
          {{ dataScopeLabel(row.dataScope) }}
        </template>
      </el-table-column>
      <el-table-column
        prop="description"
        :label="t('role.description')"
        min-width="180"
        show-overflow-tooltip
      />
      <el-table-column prop="sort" :label="t('role.sort')" width="80" />
      <el-table-column :label="t('role.enabled')" width="90">
        <template #default="{ row }">
          <el-tag :type="row.enabled ? 'success' : 'info'" size="small">
            {{ row.enabled ? t('common.enabled') : t('common.disabled') }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="t('common.actions')" width="260" fixed="right">
        <template #default="{ row }">
          <el-button v-if="canUpdate" link type="primary" @click="onEdit(row)">
            {{ t('common.edit') }}
          </el-button>
          <el-button
            v-if="canAssign && !isSuperAdminRow(row)"
            link
            type="primary"
            @click="onAssign(row)"
          >
            {{ t('role.assignPermissions') }}
          </el-button>
          <el-button
            v-if="canDelete && !isSuperAdminRow(row)"
            link
            type="danger"
            @click="onDelete(row)"
          >
            {{ t('common.delete') }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="role-page__pagination">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        background
        layout="total, sizes, prev, pager, next"
        :total="total"
        :page-sizes="[10, 20, 50]"
        @current-change="handlePageChange"
        @size-change="handleSizeChange"
      />
    </div>

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

.role-page__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.role-page__search {
  width: 260px;
}

.role-page__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.role-page__table {
  width: 100%;
  background: #fff;
}

.role-page__pagination {
  display: flex;
  justify-content: flex-end;
}
</style>
