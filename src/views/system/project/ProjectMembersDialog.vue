<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Modal, Select, Tag } from 'antdv-next'

import type { MemberRole } from '@/types/project'
import type { ManagedUser } from '@/types/user'

interface Props {
  modelValue: boolean
  users: ManagedUser[]
  initialMembers: { userId: string; role: MemberRole }[]
  title?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [members: { userId: string; role: MemberRole }[]]
}>()

const { t } = useI18n()
const submitting = ref(false)

const selectedUserIds = ref<string[]>([])
const roleByUser = ref<Record<string, MemberRole>>({})

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const userOptions = computed(() =>
  props.users.map((u) => ({ label: u.nickname ?? u.username, value: u.id })),
)

const roleOptions = computed(() => [
  { label: t('project.rolePM'), value: 'PM' as MemberRole },
  { label: t('project.roleDEV'), value: 'DEV' as MemberRole },
  { label: t('project.roleTEST'), value: 'TEST' as MemberRole },
  { label: t('project.roleDESIGN'), value: 'DESIGN' as MemberRole },
  { label: t('project.roleOPS'), value: 'OPS' as MemberRole },
  { label: t('project.roleOTHER'), value: 'OTHER' as MemberRole },
])

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    selectedUserIds.value = props.initialMembers.map((m) => m.userId)
    const map: Record<string, MemberRole> = {}
    for (const m of props.initialMembers) map[m.userId] = m.role
    roleByUser.value = map
  },
  { immediate: true },
)

function handleUserChange(ids: string[]): void {
  selectedUserIds.value = ids
  for (const id of ids) {
    if (!roleByUser.value[id]) roleByUser.value[id] = 'DEV'
  }
}

function buildPayload(): { userId: string; role: MemberRole }[] {
  return selectedUserIds.value.map((id) => ({ userId: id, role: roleByUser.value[id] ?? 'DEV' }))
}

function handleSubmit(): void {
  emit('submit', buildPayload())
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
    :title="title ?? t('project.membersAssignTitle', { name: '' })"
    width="600px"
    destroy-on-hidden
    :get-container="false"
    :confirm-loading="submitting"
  >
    <div class="flex flex-col gap-4">
      <Select
        v-model:value="selectedUserIds"
        mode="multiple"
        :options="userOptions"
        :placeholder="t('project.userSearch')"
        show-search
        :filter-option="
          (input: string, option: unknown) =>
            String((option as { label: string }).label ?? '')
              .toLowerCase()
              .includes(input.toLowerCase())
        "
        @change="handleUserChange"
      />

      <div v-if="selectedUserIds.length" class="flex flex-col gap-2">
        <div
          v-for="id in selectedUserIds"
          :key="id"
          class="flex items-center justify-between gap-3 rounded border px-3 py-2"
        >
          <Tag>{{
            users.find((u) => u.id === id)?.nickname ??
            users.find((u) => u.id === id)?.username ??
            id
          }}</Tag>
          <Select
            :value="roleByUser[id] ?? 'DEV'"
            :options="roleOptions"
            style="width: 160px"
            :placeholder="t('project.memberRolePlaceholder')"
            @change="(val: MemberRole) => (roleByUser[id] = val)"
          />
        </div>
      </div>

      <div v-else class="text-center text-gray-400 py-4">
        {{ t('project.memberEmpty') }}
      </div>
    </div>

    <template #footer>
      <Button @click="visible = false">{{ t('common.cancel') }}</Button>
      <Button type="primary" :loading="submitting" @click="handleSubmit">
        {{ t('common.confirm') }}
      </Button>
    </template>
  </Modal>
</template>
