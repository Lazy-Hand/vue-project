<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TreeProps } from 'antdv-next'
import { Button, Empty, Input, Modal, Tree } from 'antdv-next'

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
const keyword = ref('')
const selectedIds = ref<string[]>([])
const halfCheckedIds = ref<string[]>([])
const submitting = ref(false)

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const title = computed(() =>
  props.role
    ? t('role.assignPermissionsTitle', { name: props.role.name })
    : t('role.assignPermissions'),
)

interface PermissionTreeDataNode {
  key: string
  title: string
  children?: PermissionTreeDataNode[]
}

const treeData = computed<PermissionTreeDataNode[]>(() => {
  const mapNodes = (nodes: PermissionTreeNode[]): PermissionTreeDataNode[] =>
    nodes.map((node) => ({
      key: node.id,
      title: `${node.name} (${node.code})`,
      children: mapNodes(node.children ?? []),
    }))
  return mapNodes(props.permissionTree)
})

function filterTreeNodes(nodes: PermissionTreeDataNode[], query: string): PermissionTreeDataNode[] {
  if (!query) return nodes
  return nodes.flatMap((node) => {
    const children = filterTreeNodes(node.children ?? [], query)
    if (node.title.toLowerCase().includes(query) || children.length) {
      return [{ ...node, children }]
    }
    return []
  })
}

const filteredTreeData = computed(() =>
  filterTreeNodes(treeData.value, keyword.value.trim().toLowerCase()),
)

type TreeCheckHandler = NonNullable<TreeProps['onCheck']>

function handleCheck(...args: Parameters<TreeCheckHandler>): void {
  const [checked, info] = args
  if (Array.isArray(checked)) {
    selectedIds.value = checked.filter((key): key is string => typeof key === 'string')
  } else {
    selectedIds.value = checked.checked.filter((key): key is string => typeof key === 'string')
    halfCheckedIds.value = checked.halfChecked.filter(
      (key): key is string => typeof key === 'string',
    )
  }
  halfCheckedIds.value = (info.halfCheckedKeys ?? []).filter(
    (key): key is string => typeof key === 'string',
  )
}

watch(
  () => [props.modelValue, props.checkedIds] as const,
  ([open]) => {
    if (!open) return
    keyword.value = ''
    selectedIds.value = [...props.checkedIds]
    halfCheckedIds.value = []
  },
)

function collectPermissionIds(): string[] {
  return [...new Set([...selectedIds.value, ...halfCheckedIds.value])]
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
  <Modal v-model:open="visible" :title="title" width="520px" destroy-on-hidden>
    <Input
      v-model:value="keyword"
      allow-clear
      class="role-permission-search"
      :placeholder="t('role.permissionSearch')"
    />

    <div class="role-permission-tree">
      <Tree
        v-if="filteredTreeData.length"
        :tree-data="filteredTreeData"
        :checked-keys="{ checked: selectedIds, halfChecked: halfCheckedIds }"
        checkable
        default-expand-all
        @check="handleCheck"
      />
      <Empty v-else :description="t('role.permissionEmpty')" />
    </div>

    <template #footer>
      <Button @click="visible = false">{{ t('common.cancel') }}</Button>
      <Button type="primary" :loading="submitting" @click="handleSubmit">
        {{ t('common.confirm') }}
      </Button>
    </template>
  </Modal>
</template>

<style scoped lang="scss">
.role-permission-search {
  margin-bottom: 12px;
}

.role-permission-tree {
  max-height: 420px;
  overflow: auto;
  padding: 8px 4px;
  border: 1px solid var(--ant-color-border-secondary);
  border-radius: 8px;
}
</style>
