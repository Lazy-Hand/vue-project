<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Modal, message } from 'antdv-next'

import {
  assignAccountSetUsers,
  createAccountSet,
  deleteAccountSet,
  fetchAccountSetList,
  fetchAccountSetUsers,
  updateAccountSet,
} from '@/api/account-set'
import { fetchMyAccountSets } from '@/api/auth'
import { fetchUserList } from '@/api/user'
import ProTable from '@/components/ProTable/index.vue'
import ProTableActions from '@/components/ProTableActions/index.vue'
import { usePermission } from '@/composables/usePermission'
import { useAuthStore } from '@/stores/auth'
import type {
  ProTableAction,
  ProTableColumn,
  ProTableExpose,
  ProTableRequestParams,
  ProTableSearchField,
} from '@/types/pro-table'
import type {
  AccountSet,
  AccountSetPayload,
  AccountSetUserAssignment,
  UpdateAccountSetPayload,
} from '@/types/account-set'
import type { AccountSetMember } from '@/types/account-set'
import type { ManagedUser } from '@/types/user'
import { ApiRequestError } from '@/utils/request'
import AccountSetFormDialog from './AccountSetFormDialog.vue'
import AccountSetUsersDialog from './AccountSetUsersDialog.vue'
import { isDefaultUserSelected } from './utils'

const { locale, t } = useI18n()
const { hasPermission } = usePermission()
const authStore = useAuthStore()

const tableRef = ref<ProTableExpose<AccountSet> | null>(null)
const formVisible = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editingAccountSet = ref<AccountSet | null>(null)
const formDialogRef = ref<InstanceType<typeof AccountSetFormDialog> | null>(null)

const usersVisible = ref(false)
const usersLoading = ref(false)
const usersAccountSet = ref<AccountSet | null>(null)
const usersCandidates = ref<ManagedUser[]>([])
const usersMembers = ref<AccountSetMember[]>([])
const usersDialogRef = ref<InstanceType<typeof AccountSetUsersDialog> | null>(null)

const canCreate = computed(() => hasPermission('system:account-set:create'))
const canUpdate = computed(() => hasPermission('system:account-set:update'))
const canDelete = computed(() => hasPermission('system:account-set:delete'))
const canAssignUsers = computed(() => hasPermission('system:account-set:assignUsers'))

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
    label: t('accountSet.keyword'),
    type: 'input',
    placeholder: t('accountSet.searchPlaceholder'),
    defaultValue: '',
  },
])

const columns = computed<ProTableColumn<AccountSet>[]>(() => [
  { prop: 'code', label: t('accountSet.code'), minWidth: 140, showOverflowTooltip: true },
  { prop: 'name', label: t('accountSet.name'), minWidth: 160, showOverflowTooltip: true },
  { prop: 'sort', label: t('accountSet.sort'), width: 80 },
  { prop: 'enabled', label: t('accountSet.enabled'), width: 90, type: 'tag' },
  {
    prop: 'description',
    label: t('accountSet.description'),
    minWidth: 180,
    showOverflowTooltip: true,
  },
  {
    prop: 'createdAt',
    label: t('accountSet.createdAt'),
    minWidth: 170,
    formatter: (row) => formatDateTime(row.createdAt, locale.value),
  },
  {
    prop: 'updatedAt',
    label: t('accountSet.updatedAt'),
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

const accountSetActions = computed<ProTableAction<AccountSet>[]>(() => [
  {
    key: 'edit',
    label: t('common.edit'),
    placement: 'inline',
    visible: canUpdate.value,
    onClick: openEdit,
  },
  {
    key: 'assignUsers',
    label: t('accountSet.assignUsers'),
    placement: 'inline',
    visible: canAssignUsers.value,
    disabled: () => usersLoading.value,
    onClick: openAssignUsers,
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
  return t('accountSet.requestFailed')
}

function handleRequestError(error: unknown): void {
  message.error(errorMessage(error))
}

async function refreshAccountSets(): Promise<void> {
  try {
    const accountSets = await fetchMyAccountSets()
    authStore.setAccountSets(accountSets)
  } catch {
    // A successful CRUD operation must not be reported as failed when the
    // optional header refresh cannot be completed.
  }
}

async function requestAccountSets(params: ProTableRequestParams) {
  return fetchAccountSetList({
    page: params.page,
    pageSize: params.pageSize,
    keyword: String(params.keyword ?? '').trim() || undefined,
  })
}

function openCreate(): void {
  formMode.value = 'create'
  editingAccountSet.value = null
  formVisible.value = true
}

function openEdit(row: AccountSet): void {
  formMode.value = 'edit'
  editingAccountSet.value = row
  formVisible.value = true
}

async function handleFormSubmit(
  payload: AccountSetPayload | UpdateAccountSetPayload,
): Promise<void> {
  formDialogRef.value?.setSubmitting(true)
  try {
    if (formMode.value === 'create') {
      await createAccountSet(payload as AccountSetPayload)
      message.success(t('accountSet.createSuccess'))
      await refreshAccountSets()
    } else if (editingAccountSet.value) {
      await updateAccountSet(editingAccountSet.value.id, payload as UpdateAccountSetPayload)
      message.success(t('accountSet.updateSuccess'))
      await refreshAccountSets()
    }
    formVisible.value = false
    await tableRef.value?.reload()
  } catch (error) {
    message.error(errorMessage(error))
  } finally {
    formDialogRef.value?.setSubmitting(false)
  }
}

async function handleDelete(row: AccountSet): Promise<void> {
  const confirmed = await new Promise<boolean>((resolve) => {
    Modal.confirm({
      title: t('common.tip'),
      content: t('accountSet.deleteConfirm', { name: row.name }),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      okType: 'danger',
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
  if (!confirmed) return

  try {
    await deleteAccountSet(row.id)
    message.success(t('accountSet.deleteSuccess'))
    await refreshAccountSets()
    await tableRef.value?.reload()
  } catch (error) {
    message.error(errorMessage(error))
  }
}

async function openAssignUsers(row: AccountSet): Promise<void> {
  if (usersLoading.value) return
  usersLoading.value = true
  try {
    const [members, userResult] = await Promise.all([fetchAccountSetUsers(row.id), fetchAllUsers()])
    usersAccountSet.value = row
    usersMembers.value = members
    usersCandidates.value = userResult
    usersVisible.value = true
  } catch (error) {
    message.error(errorMessage(error))
  } finally {
    usersLoading.value = false
  }
}

async function fetchAllUsers(): Promise<ManagedUser[]> {
  const firstPage = await fetchUserList({ page: 1, pageSize: 100 })
  const pageSize = Math.min(Math.max(firstPage.pageSize, 1), 100)
  const totalPages = Math.max(firstPage.totalPages, 1)
  const pages: ManagedUser[] = [...firstPage.items]

  for (let page = 2; page <= totalPages; page += 1) {
    const result = await fetchUserList({ page, pageSize })
    pages.push(...result.items)
  }

  return pages
}

async function handleUsersSubmit(payload: AccountSetUserAssignment): Promise<void> {
  if (!usersAccountSet.value) return
  if (!isDefaultUserSelected(payload)) {
    message.warning(t('accountSet.defaultUserRequired'))
    return
  }

  usersDialogRef.value?.setSubmitting(true)
  try {
    await assignAccountSetUsers(usersAccountSet.value.id, payload)
    message.success(t('accountSet.assignSuccess'))
    await refreshAccountSets()
    usersVisible.value = false
  } catch (error) {
    message.error(errorMessage(error))
  } finally {
    usersDialogRef.value?.setSubmitting(false)
  }
}
</script>

<template>
  <div class="account-set-page">
    <ProTable
      ref="tableRef"
      :columns="columns"
      :search-fields="searchFields"
      :request="requestAccountSets"
      :show-request-error="false"
      @request-error="handleRequestError"
    >
      <template #toolbar-actions>
        <Button v-if="canCreate" type="primary" @click="openCreate">
          {{ t('accountSet.create') }}
        </Button>
      </template>

      <template #column-actions="{ row }">
        <ProTableActions :row="row" :actions="accountSetActions" />
      </template>
    </ProTable>

    <AccountSetFormDialog
      ref="formDialogRef"
      v-model="formVisible"
      :mode="formMode"
      :editing="editingAccountSet"
      @submit="handleFormSubmit"
    />

    <AccountSetUsersDialog
      ref="usersDialogRef"
      v-model="usersVisible"
      :account-set="usersAccountSet"
      :users="usersCandidates"
      :members="usersMembers"
      :loading="usersLoading"
      @submit="handleUsersSubmit"
    />
  </div>
</template>

<style scoped lang="scss">
.account-set-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
