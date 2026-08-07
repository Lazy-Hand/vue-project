<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElButton, ElCheckbox, ElCheckboxGroup, ElDialog, ElEmpty, ElInput } from 'element-plus'

import type { Role } from '@/types/role'
import type { ManagedUser } from '@/types/user'

interface Props {
  modelValue: boolean
  user: ManagedUser | null
  roles: Role[]
  checkedIds: string[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [roleIds: string[]]
}>()

const { t } = useI18n()
const keyword = ref('')
const selectedIds = ref<string[]>([])
const submitting = ref(false)

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const title = computed(() =>
  props.user ? t('user.assignRolesTitle', { name: props.user.username }) : t('user.assignRoles'),
)

const filteredRoles = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  const enabledRoles = props.roles.filter((role) => role.enabled)
  if (!q) return enabledRoles
  return enabledRoles.filter(
    (role) => role.name.toLowerCase().includes(q) || role.code.toLowerCase().includes(q),
  )
})

watch(
  () => [props.modelValue, props.checkedIds] as const,
  ([open]) => {
    if (!open) return
    keyword.value = ''
    selectedIds.value = [...props.checkedIds]
  },
)

function handleSubmit(): void {
  emit('submit', [...selectedIds.value])
}

defineExpose({
  setSubmitting(value: boolean) {
    submitting.value = value
  },
})
</script>

<template>
  <el-dialog v-model="visible" :title="title" width="480px" destroy-on-close>
    <el-input
      v-model="keyword"
      clearable
      class="user-roles-search"
      :placeholder="t('user.roleSearch')"
    />

    <div class="user-roles-list">
      <el-checkbox-group v-if="filteredRoles.length" v-model="selectedIds" class="user-roles-group">
        <el-checkbox v-for="role in filteredRoles" :key="role.id" :value="role.id">
          {{ role.name }} ({{ role.code }})
        </el-checkbox>
      </el-checkbox-group>
      <el-empty v-else :description="t('user.roleEmpty')" :image-size="72" />
    </div>

    <template #footer>
      <el-button @click="visible = false">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        {{ t('common.confirm') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.user-roles-search {
  margin-bottom: 12px;
}

.user-roles-list {
  max-height: 360px;
  overflow: auto;
  padding: 8px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.user-roles-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}
</style>
