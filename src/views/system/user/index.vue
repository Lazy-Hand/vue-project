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
import { fetchPosts } from '@/api/post'
import { fetchRoles } from '@/api/role'
import {
  assignUserPosts,
  assignUserRoles,
  createUser,
  deleteUser,
  fetchUserList,
  fetchUserPosts,
  fetchUserRoles,
  resetUserPassword,
  updateUser,
} from '@/api/user'
import { usePermission } from '@/composables/usePermission'
import { useAuthStore } from '@/stores/auth'
import type { DeptTreeNode } from '@/types/dept'
import type { Post } from '@/types/post'
import type { Role } from '@/types/role'
import type { CreateUserPayload, ManagedUser, UpdateUserPayload } from '@/types/user'
import { ApiRequestError } from '@/utils/request'
import UserFormDialog from './UserFormDialog.vue'
import UserResetPasswordDialog from './UserResetPasswordDialog.vue'
import UserRolesDialog from './UserRolesDialog.vue'

const { t } = useI18n()
const { hasPermission } = usePermission()
const authStore = useAuthStore()

const loading = ref(false)
const keyword = ref('')
const users = ref<ManagedUser[]>([])
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)

const deptTree = ref<DeptTreeNode[]>([])
const posts = ref<Post[]>([])
const roles = ref<Role[]>([])

const formVisible = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editingUser = ref<ManagedUser | null>(null)
const initialPostIds = ref<string[]>([])
const formDialogRef = ref<InstanceType<typeof UserFormDialog> | null>(null)

const resetVisible = ref(false)
const resetUser = ref<ManagedUser | null>(null)
const resetDialogRef = ref<InstanceType<typeof UserResetPasswordDialog> | null>(null)

const rolesVisible = ref(false)
const rolesUser = ref<ManagedUser | null>(null)
const rolesCheckedIds = ref<string[]>([])
const rolesDialogRef = ref<InstanceType<typeof UserRolesDialog> | null>(null)

const canCreate = computed(() => hasPermission('system:user:create'))
const canUpdate = computed(() => hasPermission('system:user:update'))
const canDelete = computed(() => hasPermission('system:user:delete'))
const canResetPassword = computed(() => hasPermission('system:user:resetPassword'))
const canAssignRoles = computed(() => hasPermission('system:user:assignRoles'))
const canAssignPosts = computed(() => hasPermission('system:user:assignPosts'))

const displayUsers = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  if (!q) return users.value
  return users.value.filter((user) => {
    const fields = [user.username, user.nickname, user.email, user.phone, user.deptName]
    return fields.some((field) => field?.toLowerCase().includes(q))
  })
})

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message
  if (error instanceof Error) return error.message
  return t('user.requestFailed')
}

function isSelf(user: ManagedUser): boolean {
  return authStore.user?.id === user.id
}

function isSelfRow(row: unknown): boolean {
  return isSelf(row as ManagedUser)
}

async function loadUsers(): Promise<void> {
  loading.value = true
  try {
    const result = await fetchUserList({ page: page.value, pageSize: pageSize.value })
    users.value = result.items
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

async function ensurePosts(): Promise<void> {
  if (posts.value.length || !hasPermission('system:post:query')) return
  try {
    posts.value = await fetchPosts()
  } catch {
    posts.value = []
  }
}

async function ensureRoles(): Promise<void> {
  if (roles.value.length || !hasPermission('system:role:query')) return
  try {
    roles.value = await fetchRoles()
  } catch (error) {
    ElMessage.error(errorMessage(error))
  }
}

async function openCreate(): Promise<void> {
  await Promise.all([ensureDeptTree(), ensurePosts()])
  formMode.value = 'create'
  editingUser.value = null
  initialPostIds.value = []
  formVisible.value = true
}

async function openEdit(row: ManagedUser): Promise<void> {
  await Promise.all([ensureDeptTree(), ensurePosts()])
  formMode.value = 'edit'
  editingUser.value = row
  initialPostIds.value = []

  try {
    const userPosts = await fetchUserPosts(row.id)
    initialPostIds.value = userPosts.map((item) => item.id)
  } catch (error) {
    ElMessage.error(errorMessage(error))
    return
  }

  formVisible.value = true
}

async function openResetPassword(row: ManagedUser): Promise<void> {
  resetUser.value = row
  resetVisible.value = true
}

async function openAssignRoles(row: ManagedUser): Promise<void> {
  await ensureRoles()
  if (!roles.value.length) {
    ElMessage.warning(t('user.roleEmpty'))
    return
  }

  try {
    const userRoles = await fetchUserRoles(row.id)
    rolesUser.value = row
    rolesCheckedIds.value = userRoles.map((item) => item.id)
    rolesVisible.value = true
  } catch (error) {
    ElMessage.error(errorMessage(error))
  }
}

async function handleFormSubmit(
  payload: CreateUserPayload | UpdateUserPayload,
  postIds: string[],
): Promise<void> {
  formDialogRef.value?.setSubmitting(true)
  try {
    if (formMode.value === 'create') {
      await createUser(payload as CreateUserPayload)
      ElMessage.success(t('user.createSuccess'))
    } else if (editingUser.value) {
      await updateUser(editingUser.value.id, payload as UpdateUserPayload)
      if (canAssignPosts.value) {
        await assignUserPosts(editingUser.value.id, postIds)
      }
      ElMessage.success(t('user.updateSuccess'))
    }
    formVisible.value = false
    await loadUsers()
  } catch (error) {
    ElMessage.error(errorMessage(error))
  } finally {
    formDialogRef.value?.setSubmitting(false)
  }
}

async function handleResetSubmit(password: string): Promise<void> {
  if (!resetUser.value) return
  resetDialogRef.value?.setSubmitting(true)
  try {
    await resetUserPassword(resetUser.value.id, password)
    ElMessage.success(t('user.resetPasswordSuccess'))
    resetVisible.value = false
  } catch (error) {
    ElMessage.error(errorMessage(error))
  } finally {
    resetDialogRef.value?.setSubmitting(false)
  }
}

async function handleRolesSubmit(roleIds: string[]): Promise<void> {
  if (!rolesUser.value) return
  rolesDialogRef.value?.setSubmitting(true)
  try {
    await assignUserRoles(rolesUser.value.id, roleIds)
    ElMessage.success(t('user.assignRolesSuccess'))
    rolesVisible.value = false
  } catch (error) {
    ElMessage.error(errorMessage(error))
  } finally {
    rolesDialogRef.value?.setSubmitting(false)
  }
}

async function handleDelete(row: ManagedUser): Promise<void> {
  if (isSelf(row)) {
    ElMessage.warning(t('user.cannotOperateSelf'))
    return
  }

  try {
    await ElMessageBox.confirm(
      t('user.deleteConfirm', { name: row.nickname || row.username }),
      t('common.tip'),
      { type: 'warning' },
    )
  } catch {
    return
  }

  try {
    await deleteUser(row.id)
    ElMessage.success(t('user.deleteSuccess'))
    if (users.value.length === 1 && page.value > 1) {
      page.value -= 1
    }
    await loadUsers()
  } catch (error) {
    ElMessage.error(errorMessage(error))
  }
}

function onEdit(row: unknown): void {
  void openEdit(row as ManagedUser)
}

function onReset(row: unknown): void {
  void openResetPassword(row as ManagedUser)
}

function onAssignRoles(row: unknown): void {
  void openAssignRoles(row as ManagedUser)
}

function onDelete(row: unknown): void {
  void handleDelete(row as ManagedUser)
}

function handlePageChange(next: number): void {
  page.value = next
  void loadUsers()
}

function handleSizeChange(size: number): void {
  pageSize.value = size
  page.value = 1
  void loadUsers()
}

onMounted(() => {
  void loadUsers()
})
</script>

<template>
  <div class="user-page">
    <div class="user-page__toolbar">
      <el-input
        v-model="keyword"
        clearable
        class="user-page__search"
        :placeholder="t('user.searchPlaceholder')"
      />
      <div class="user-page__actions">
        <el-button @click="loadUsers">{{ t('common.refresh') }}</el-button>
        <el-button v-if="canCreate" type="primary" @click="openCreate">
          {{ t('user.create') }}
        </el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="displayUsers" row-key="id" class="user-page__table">
      <el-table-column prop="username" :label="t('user.username')" min-width="120" />
      <el-table-column prop="nickname" :label="t('user.nickname')" min-width="120" />
      <el-table-column prop="deptName" :label="t('user.dept')" min-width="120" />
      <el-table-column prop="email" :label="t('user.email')" min-width="160" show-overflow-tooltip />
      <el-table-column prop="phone" :label="t('user.phone')" min-width="120" />
      <el-table-column :label="t('user.enabled')" width="90">
        <template #default="{ row }">
          <el-tag :type="row.enabled ? 'success' : 'info'" size="small">
            {{ row.enabled ? t('common.enabled') : t('common.disabled') }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="t('common.actions')" width="280" fixed="right">
        <template #default="{ row }">
          <el-button v-if="canUpdate" link type="primary" @click="onEdit(row)">
            {{ t('common.edit') }}
          </el-button>
          <el-button v-if="canAssignRoles" link type="primary" @click="onAssignRoles(row)">
            {{ t('user.assignRoles') }}
          </el-button>
          <el-button v-if="canResetPassword" link type="primary" @click="onReset(row)">
            {{ t('user.resetPassword') }}
          </el-button>
          <el-button
            v-if="canDelete && !isSelfRow(row)"
            link
            type="danger"
            @click="onDelete(row)"
          >
            {{ t('common.delete') }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="user-page__pagination">
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

    <UserFormDialog
      ref="formDialogRef"
      v-model="formVisible"
      :mode="formMode"
      :editing="editingUser"
      :dept-tree="deptTree"
      :posts="posts"
      :initial-post-ids="initialPostIds"
      @submit="handleFormSubmit"
    />

    <UserResetPasswordDialog
      ref="resetDialogRef"
      v-model="resetVisible"
      :user="resetUser"
      @submit="handleResetSubmit"
    />

    <UserRolesDialog
      ref="rolesDialogRef"
      v-model="rolesVisible"
      :user="rolesUser"
      :roles="roles"
      :checked-ids="rolesCheckedIds"
      @submit="handleRolesSubmit"
    />
  </div>
</template>

<style scoped lang="scss">
.user-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.user-page__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.user-page__search {
  width: 260px;
}

.user-page__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.user-page__table {
  width: 100%;
  background: #fff;
}

.user-page__pagination {
  display: flex;
  justify-content: flex-end;
}
</style>
