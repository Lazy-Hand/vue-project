<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElButton, ElDialog, ElEmpty, ElInput, ElTree } from 'element-plus'

import type { PermissionTreeNode } from '@/types/permission'
import type { Role } from '@/types/role'

interface Props {
  modelValue: boolean
  role: Role | null
  permissionTree: PermissionTreeNode[]
  checkedIds: string[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [permissionIds: string[]]
}>()

const { t } = useI18n()
const treeRef = ref<InstanceType<typeof ElTree>>()
const keyword = ref('')
const submitting = ref(false)

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const title = computed(() =>
  props.role ? t('role.assignPermissionsTitle', { name: props.role.name }) : t('role.assignPermissions'),
)

const treeData = computed(() => {
  const mapNodes = (nodes: PermissionTreeNode[]): Array<Record<string, unknown>> =>
    nodes.map((node) => ({
      id: node.id,
      label: `${node.name} (${node.code})`,
      children: mapNodes(node.children ?? []),
    }))
  return mapNodes(props.permissionTree)
})

function filterNode(value: string, data: { label?: string }): boolean {
  if (!value) return true
  return (data.label ?? '').toLowerCase().includes(value.toLowerCase())
}

watch(keyword, (value) => {
  treeRef.value?.filter(value)
})

watch(
  () => [props.modelValue, props.checkedIds] as const,
  async ([open]) => {
    if (!open) return
    keyword.value = ''
    await nextTick()
    treeRef.value?.setCheckedKeys(props.checkedIds)
  },
)

function collectPermissionIds(): string[] {
  const checked = (treeRef.value?.getCheckedKeys(false) ?? []) as string[]
  const half = (treeRef.value?.getHalfCheckedKeys() ?? []) as string[]
  return [...new Set([...checked, ...half])]
}

function handleSubmit(): void {
  emit('submit', collectPermissionIds())
}

defineExpose({
  setSubmitting(value: boolean) {
    submitting.value = value
  },
})
</script>

<template>
  <el-dialog v-model="visible" :title="title" width="520px" destroy-on-close>
    <el-input
      v-model="keyword"
      clearable
      class="role-permission-search"
      :placeholder="t('role.permissionSearch')"
    />

    <div class="role-permission-tree">
      <el-tree
        v-if="treeData.length"
        ref="treeRef"
        :data="treeData"
        node-key="id"
        show-checkbox
        default-expand-all
        :filter-node-method="filterNode"
        :props="{ label: 'label', children: 'children' }"
      />
      <el-empty v-else :description="t('role.permissionEmpty')" :image-size="72" />
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
.role-permission-search {
  margin-bottom: 12px;
}

.role-permission-tree {
  max-height: 420px;
  overflow: auto;
  padding: 8px 4px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}
</style>
