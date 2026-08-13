<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Alert, Button, Checkbox, Empty, Input, Modal, Radio, Spin } from 'antdv-next'

import type { AccountSet, AccountSetMember, AccountSetUserAssignment } from '@/types/account-set'
import type { ManagedUser } from '@/types/user'
import { isDefaultUserSelected, toggleAccountSetUserSelection } from './utils'

interface Props {
  modelValue: boolean
  accountSet?: AccountSet | null
  users: ManagedUser[]
  members: AccountSetMember[]
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  accountSet: null,
  loading: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: AccountSetUserAssignment]
}>()

const { t } = useI18n()
const submitting = ref(false)
const keyword = ref('')
const selectedIds = ref<string[]>([])
const defaultUserId = ref<string | undefined>()
const submitInvalid = ref(false)

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const title = computed(() =>
  props.accountSet
    ? t('accountSet.assignUsersTitle', { name: props.accountSet.name })
    : t('accountSet.assignUsers'),
)

const candidateUsers = computed<ManagedUser[]>(() => {
  const existing = new Map(props.users.map((user) => [user.id, user]))
  for (const member of props.members) {
    if (existing.has(member.id)) continue
    existing.set(member.id, {
      id: member.id,
      username: member.username,
      nickname: member.nickname,
      email: null,
      phone: null,
      avatar: null,
      deptId: null,
      deptName: null,
      enabled: true,
    })
  }
  return [...existing.values()]
})

const filteredUsers = computed(() => {
  const text = keyword.value.trim().toLowerCase()
  if (!text) return candidateUsers.value

  return candidateUsers.value.filter((user) =>
    [user.username, user.nickname, user.email, user.phone].some((field) =>
      field?.toLowerCase().includes(text),
    ),
  )
})

function resetFromMembers(): void {
  selectedIds.value = props.members.map((member) => member.id)
  defaultUserId.value = props.members.find((member) => member.isDefault)?.id
  keyword.value = ''
  submitInvalid.value = false
}

watch(
  () => [props.modelValue, props.members, props.users] as const,
  ([open]) => {
    if (open) resetFromMembers()
  },
  { immediate: true },
)

function isSelected(id: string): boolean {
  return selectedIds.value.includes(id)
}

function toggleSelected(id: string): void {
  const next = toggleAccountSetUserSelection(
    { userIds: selectedIds.value, defaultUserId: defaultUserId.value },
    id,
  )
  selectedIds.value = next.userIds
  defaultUserId.value = next.defaultUserId
  submitInvalid.value = false
}

function setDefault(id: string): void {
  if (!isSelected(id)) return
  defaultUserId.value = id
  submitInvalid.value = false
}

function userLabel(user: ManagedUser): string {
  return user.nickname ? `${user.nickname} (${user.username})` : user.username
}

function handleSubmit(): void {
  const payload: AccountSetUserAssignment = {
    userIds: [...selectedIds.value],
  }
  if (defaultUserId.value) payload.defaultUserId = defaultUserId.value

  if (!isDefaultUserSelected(payload)) {
    submitInvalid.value = true
    return
  }

  emit('submit', payload)
}

defineExpose({
  setSubmitting(value: boolean) {
    submitting.value = value
  },
})
</script>

<template>
  <Modal
    v-model:open="visible"
    :title="title"
    width="640px"
    destroy-on-hidden
    :get-container="false"
    :confirm-loading="submitting"
  >
    <Spin :spinning="loading">
      <div class="account-set-users-dialog">
        <Input
          v-model:value="keyword"
          allow-clear
          :placeholder="t('accountSet.assignUsersSearch')"
          class="account-set-users-dialog__search"
        />

        <Alert
          v-if="submitInvalid"
          type="warning"
          show-icon
          :message="t('accountSet.defaultUserRequired')"
          class="account-set-users-dialog__alert"
        />

        <Empty v-if="!filteredUsers.length" :description="t('accountSet.assignUsersEmpty')" />

        <div v-else class="account-set-users-dialog__list">
          <div v-for="user in filteredUsers" :key="user.id" class="account-set-users-dialog__row">
            <Checkbox :checked="isSelected(user.id)" @change="toggleSelected(user.id)">
              {{ userLabel(user) }}
            </Checkbox>
            <Radio
              :checked="defaultUserId === user.id"
              :disabled="!isSelected(user.id)"
              @change="setDefault(user.id)"
            >
              {{ t('accountSet.defaultUser') }}
            </Radio>
          </div>
        </div>
      </div>
    </Spin>

    <template #footer>
      <Button @click="visible = false">{{ t('common.cancel') }}</Button>
      <Button type="primary" :loading="submitting" @click="handleSubmit">
        {{ t('common.confirm') }}
      </Button>
    </template>
  </Modal>
</template>

<style scoped lang="scss">
.account-set-users-dialog {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 180px;
}

.account-set-users-dialog__search {
  width: 100%;
}

.account-set-users-dialog__alert {
  margin-bottom: 0;
}

.account-set-users-dialog__list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 360px;
  overflow-y: auto;
}

.account-set-users-dialog__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 4px;
  border-bottom: 1px solid var(--app-border-color-split);
}
</style>
