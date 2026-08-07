<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ElButton,
  ElInput,
  ElMessage,
  ElMessageBox,
  ElTable,
  ElTableColumn,
  ElTag,
} from 'element-plus'

import {
  createPermission,
  deletePermission,
  fetchPermissionTree,
  updatePermission,
} from '@/api/permission'
import MenuIcon from '@/components/MenuIcon/index.vue'
import { usePermission } from '@/composables/usePermission'
import type { PermissionPayload, PermissionTreeNode, PermissionType } from '@/types/permission'
import { ApiRequestError } from '@/utils/request'
import PermissionFormDialog from './PermissionFormDialog.vue'
import { filterTreeByKeyword } from './utils'

const { t } = useI18n()
const { hasPermission } = usePermission()

const loading = ref(false)
const keyword = ref('')
const tree = ref<PermissionTreeNode[]>([])
const expandAll = ref(true)

const dialogVisible = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const editingNode = ref<PermissionTreeNode | null>(null)
const initialParentId = ref<string | null>(null)
const formDialogRef = ref<InstanceType<typeof PermissionFormDialog> | null>(null)

const displayTree = computed(() => filterTreeByKeyword(tree.value, keyword.value))

const canCreate = computed(() => hasPermission('system:permission:create'))
const canUpdate = computed(() => hasPermission('system:permission:update'))
const canDelete = computed(() => hasPermission('system:permission:delete'))

function typeTagType(type: PermissionType): 'primary' | 'success' | 'info' {
  if (type === 'DIRECTORY') return 'primary'
  if (type === 'MENU') return 'success'
  return 'info'
}

function typeLabel(type: PermissionType): string {
  if (type === 'DIRECTORY') return t('permission.typeDirectory')
  if (type === 'MENU') return t('permission.typeMenu')
  return t('permission.typeButton')
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message
  if (error instanceof Error) return error.message
  return t('permission.requestFailed')
}

async function loadTree(): Promise<void> {
  loading.value = true
  try {
    tree.value = await fetchPermissionTree()
  } catch (error) {
    ElMessage.error(errorMessage(error))
  } finally {
    loading.value = false
  }
}

function openCreate(parentId?: string | null): void {
  dialogMode.value = 'create'
  editingNode.value = null
  initialParentId.value = parentId ?? null
  dialogVisible.value = true
}

function openEdit(row: PermissionTreeNode): void {
  dialogMode.value = 'edit'
  editingNode.value = row
  initialParentId.value = row.parentId
  dialogVisible.value = true
}

async function handleSubmit(payload: PermissionPayload): Promise<void> {
  formDialogRef.value?.setSubmitting(true)
  try {
    if (dialogMode.value === 'create') {
      await createPermission(payload)
      ElMessage.success(t('permission.createSuccess'))
    } else if (editingNode.value) {
      await updatePermission(editingNode.value.id, payload)
      ElMessage.success(t('permission.updateSuccess'))
    }
    dialogVisible.value = false
    await loadTree()
  } catch (error) {
    ElMessage.error(errorMessage(error))
  } finally {
    formDialogRef.value?.setSubmitting(false)
  }
}

async function handleDelete(row: PermissionTreeNode): Promise<void> {
  try {
    await ElMessageBox.confirm(
      t('permission.deleteConfirm', { name: row.name }),
      t('common.tip'),
      { type: 'warning' },
    )
  } catch {
    return
  }

  try {
    await deletePermission(row.id)
    ElMessage.success(t('permission.deleteSuccess'))
    await loadTree()
  } catch (error) {
    ElMessage.error(errorMessage(error))
  }
}

function onCreateChild(row: unknown): void {
  openCreate((row as PermissionTreeNode).id)
}

function onEdit(row: unknown): void {
  openEdit(row as PermissionTreeNode)
}

function onDelete(row: unknown): void {
  void handleDelete(row as PermissionTreeNode)
}

function toggleExpand(): void {
  expandAll.value = !expandAll.value
}

onMounted(() => {
  void loadTree()
})
</script>

<template>
  <div class="permission-page">
    <div class="permission-page__toolbar">
      <el-input
        v-model="keyword"
        clearable
        class="permission-page__search"
        :placeholder="t('permission.searchPlaceholder')"
      />
      <div class="permission-page__actions">
        <el-button @click="toggleExpand">
          {{ expandAll ? t('permission.collapseAll') : t('permission.expandAll') }}
        </el-button>
        <el-button @click="loadTree">{{ t('common.refresh') }}</el-button>
        <el-button v-if="canCreate" type="primary" @click="openCreate()">
          {{ t('permission.create') }}
        </el-button>
      </div>
    </div>

    <el-table
      :key="String(expandAll)"
      v-loading="loading"
      :data="displayTree"
      row-key="id"
      :default-expand-all="expandAll"
      :tree-props="{ children: 'children' }"
      class="permission-page__table"
    >
      <el-table-column :label="t('permission.name')" min-width="220">
        <template #default="{ row }">
          <span class="permission-page__name-cell">
            <MenuIcon v-if="row.icon" :icon="row.icon" class="permission-page__icon" />
            <span>{{ row.name }}</span>
          </span>
        </template>
      </el-table-column>

      <el-table-column prop="code" :label="t('permission.code')" min-width="180" />

      <el-table-column :label="t('permission.type')" width="110">
        <template #default="{ row }">
          <el-tag :type="typeTagType(row.type)" size="small">{{ typeLabel(row.type) }}</el-tag>
        </template>
      </el-table-column>

      <el-table-column prop="path" :label="t('permission.path')" min-width="160" show-overflow-tooltip />
      <el-table-column
        prop="component"
        :label="t('permission.component')"
        min-width="160"
        show-overflow-tooltip
      />
      <el-table-column prop="sort" :label="t('permission.sort')" width="80" />

      <el-table-column :label="t('permission.enabled')" width="90">
        <template #default="{ row }">
          <el-tag :type="row.enabled ? 'success' : 'info'" size="small">
            {{ row.enabled ? t('common.enabled') : t('common.disabled') }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column :label="t('common.actions')" width="220" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="canCreate && row.type !== 'BUTTON'"
            link
            type="primary"
            @click="onCreateChild(row)"
          >
            {{ t('permission.createChild') }}
          </el-button>
          <el-button v-if="canUpdate" link type="primary" @click="onEdit(row)">
            {{ t('common.edit') }}
          </el-button>
          <el-button v-if="canDelete" link type="danger" @click="onDelete(row)">
            {{ t('common.delete') }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <PermissionFormDialog
      ref="formDialogRef"
      v-model="dialogVisible"
      :mode="dialogMode"
      :tree="tree"
      :editing="editingNode"
      :initial-parent-id="initialParentId"
      @submit="handleSubmit"
    />
  </div>
</template>

<style scoped lang="scss">
.permission-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.permission-page__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.permission-page__search {
  width: 260px;
}

.permission-page__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.permission-page__table {
  width: 100%;
  background: #fff;
}

.permission-page__name-cell {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.permission-page__icon {
  font-size: 16px;
  color: var(--el-text-color-regular);
}
</style>
