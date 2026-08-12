<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Modal, message } from 'antdv-next'

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
import ProTable from '@/components/ProTable/index.vue'
import ProTableActions from '@/components/ProTableActions/index.vue'
import { usePermission } from '@/composables/usePermission'
import { useAuthStore } from '@/stores/auth'
import type { DeptTreeNode } from '@/types/dept'
import type { Post } from '@/types/post'
import type {
  ProTableAction,
  ProTableColumn,
  ProTableExpose,
  ProTableRequestParams,
  ProTableSearchField,
} from '@/types/pro-table'
import type { Role } from '@/types/role'
import type { CreateUserPayload, ManagedUser, UpdateUserPayload } from '@/types/user'
import { ApiRequestError } from '@/utils/request'
import UserFormDialog from './UserFormDialog.vue'
import UserResetPasswordDialog from './UserResetPasswordDialog.vue'
import UserRolesDialog from './UserRolesDialog.vue'

const { t } = useI18n()
const { hasPermission } = usePermission()
const authStore = useAuthStore()

const tableRef = ref<ProTableExpose<ManagedUser> | null>(null)
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

const searchFields = computed<ProTableSearchField[]>(() => [
  {
    prop: 'keyword',
    type: 'input',
    placeholder: t('user.searchPlaceholder'),
    defaultValue: '',
  },
])

const columns = computed<ProTableColumn<ManagedUser>[]>(() => [
  { prop: 'username', label: t('user.username'), minWidth: 120 },
  { prop: 'nickname', label: t('user.nickname'), minWidth: 120 },
  { prop: 'deptName', label: t('user.dept'), minWidth: 120 },
  {
    prop: 'email',
    label: t('user.email'),
    minWidth: 160,
    showOverflowTooltip: true,
  },
  { prop: 'phone', label: t('user.phone'), minWidth: 120 },
  { prop: 'enabled', label: t('user.enabled'), width: 90, type: 'tag' },
  {
    key: 'actions',
    label: t('common.actions'),
    width: 280,
    fixed: 'right',
    type: 'slot',
    slot: 'actions',
  },
])

const userActions = computed<ProTableAction<ManagedUser>[]>(() => [
  {
    key: 'edit',
    label: t('common.edit'),
    placement: 'inline',
    visible: canUpdate.value,
    onClick: openEdit,
  },
  {
    key: 'assignRoles',
    label: t('user.assignRoles'),
    visible: canAssignRoles.value,
    onClick: openAssignRoles,
  },
  {
    key: 'resetPassword',
    label: t('user.resetPassword'),
    visible: canResetPassword.value,
    onClick: openResetPassword,
  },
  {
    key: 'delete',
    label: t('common.delete'),
    danger: true,
    visible: (row) => canDelete.value && !isSelf(row),
    onClick: handleDelete,
  },
])

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message
  if (error instanceof Error) return error.message
  return t('user.requestFailed')
}

function handleRequestError(error: unknown): void {
  message.error(errorMessage(error))
}

function isSelf(user: ManagedUser): boolean {
  return authStore.user?.id === user.id
}

async function requestUsers(params: ProTableRequestParams) {
  return fetchUserList({ page: params.page, pageSize: params.pageSize })
}

function filterUsers(items: ManagedUser[], params: ProTableRequestParams): ManagedUser[] {
  const keyword = String(params.keyword ?? '')
    .trim()
    .toLowerCase()
  if (!keyword) return items

  return items.filter((user) => {
    const fields = [user.username, user.nickname, user.email, user.phone, user.deptName]
    return fields.some((field) => field?.toLowerCase().includes(keyword))
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
    message.error(errorMessage(error))
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
    message.error(errorMessage(error))
    return
  }

  formVisible.value = true
}

function openResetPassword(row: ManagedUser): void {
  resetUser.value = row
  resetVisible.value = true
}

async function openAssignRoles(row: ManagedUser): Promise<void> {
  await ensureRoles()
  if (!roles.value.length) {
    message.warning(t('user.roleEmpty'))
    return
  }

  try {
    const userRoles = await fetchUserRoles(row.id)
    rolesUser.value = row
    rolesCheckedIds.value = userRoles.map((item) => item.id)
    rolesVisible.value = true
  } catch (error) {
    message.error(errorMessage(error))
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
      message.success(t('user.createSuccess'))
    } else if (editingUser.value) {
      await updateUser(editingUser.value.id, payload as UpdateUserPayload)
      if (canAssignPosts.value) {
        await assignUserPosts(editingUser.value.id, postIds)
      }
      message.success(t('user.updateSuccess'))
    }
    formVisible.value = false
    await tableRef.value?.reload()
  } catch (error) {
    message.error(errorMessage(error))
  } finally {
    formDialogRef.value?.setSubmitting(false)
  }
}

async function handleResetSubmit(password: string): Promise<void> {
  if (!resetUser.value) return
  resetDialogRef.value?.setSubmitting(true)
  try {
    await resetUserPassword(resetUser.value.id, password)
    message.success(t('user.resetPasswordSuccess'))
    resetVisible.value = false
  } catch (error) {
    message.error(errorMessage(error))
  } finally {
    resetDialogRef.value?.setSubmitting(false)
  }
}

async function handleRolesSubmit(roleIds: string[]): Promise<void> {
  if (!rolesUser.value) return
  rolesDialogRef.value?.setSubmitting(true)
  try {
    await assignUserRoles(rolesUser.value.id, roleIds)
    message.success(t('user.assignRolesSuccess'))
    rolesVisible.value = false
  } catch (error) {
    message.error(errorMessage(error))
  } finally {
    rolesDialogRef.value?.setSubmitting(false)
  }
}

async function handleDelete(row: ManagedUser): Promise<void> {
  if (isSelf(row)) {
    message.warning(t('user.cannotOperateSelf'))
    return
  }

  const confirmed = await new Promise<boolean>((resolve) => {
    Modal.confirm({
      title: t('common.tip'),
      content: t('user.deleteConfirm', { name: row.nickname || row.username }),
      okType: 'danger',
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
  if (!confirmed) return

  try {
    await deleteUser(row.id)
    message.success(t('user.deleteSuccess'))
    await tableRef.value?.reload()
  } catch (error) {
    message.error(errorMessage(error))
  }
}
</script>

<template>
  <div class="user-page">
    <ProTable
      ref="tableRef"
      :columns="columns"
      :search-fields="searchFields"
      :request="requestUsers"
      :client-filter="filterUsers"
      :show-request-error="false"
      @request-error="handleRequestError"
    >
      <template #toolbar-actions>
        <Button v-if="canCreate" type="primary" @click="openCreate">
          {{ t('user.create') }}
        </Button>
      </template>

      <template #column-actions="{ row }">
        <ProTableActions :row="row" :actions="userActions" />
      </template>
    </ProTable>

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
</style>
