<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Modal, Switch, Tag, message } from 'antdv-next'
import {
  ApartmentOutlined,
  AppstoreOutlined,
  AuditOutlined,
  BankOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  CoffeeOutlined,
  DeleteOutlined,
  DollarCircleOutlined,
  EditOutlined,
  FileProtectOutlined,
  FileTextOutlined,
  FormOutlined,
  NodeIndexOutlined,
  PlusOutlined,
  ProjectOutlined,
  ReconciliationOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  SettingOutlined,
  SolutionOutlined,
  TeamOutlined,
  ToolOutlined,
  TrophyOutlined,
  UserOutlined,
  WalletOutlined,
} from '@antdv-next/icons'

import {
  deleteApprovalCategory,
  fetchApprovalCategoryList,
  toggleApprovalCategoryStatus,
} from '@/api/approval'
import ProTable from '@/components/ProTable/index.vue'
import ProTableActions from '@/components/ProTableActions/index.vue'
import { usePermission } from '@/composables/usePermission'
import type { ApprovalCategory, ApprovalDefinition } from '@/types/approval'
import type {
  ProTableAction,
  ProTableColumn,
  ProTableExpose,
  ProTableRequestParams,
  ProTableSearchField,
} from '@/types/pro-table'
import { ApiRequestError } from '@/utils/request'
import CategoryFormDialog from './CategoryFormDialog.vue'
import CategoryFlowDrawer from './CategoryFlowDrawer.vue'
import DefinitionDesignerDialog from '../definition/designer/DefinitionDesignerDialog.vue'

const { t, locale } = useI18n()
const { hasPermission } = usePermission()

const tableRef = ref<ProTableExpose<ApprovalCategory> | null>(null)
const formDialogOpen = ref(false)
const editingCategory = ref<ApprovalCategory | null>(null)
const statusToggling = ref<Record<string, boolean>>({})

// 关联流程抽屉与设计器
const flowDrawerOpen = ref(false)
const drawerCategory = ref<ApprovalCategory | null>(null)
const designerOpen = ref(false)
const designerEditing = ref<ApprovalDefinition | null>(null)

const iconMap: Record<string, unknown> = {
  UserOutlined,
  DollarCircleOutlined,
  WalletOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  ApartmentOutlined,
  FileTextOutlined,
  FormOutlined,
  SolutionOutlined,
  ProjectOutlined,
  ToolOutlined,
  BankOutlined,
  CalendarOutlined,
  AuditOutlined,
  CoffeeOutlined,
  ClockCircleOutlined,
  TrophyOutlined,
  SendOutlined,
  ReconciliationOutlined,
  FileProtectOutlined,
  SettingOutlined,
  AppstoreOutlined,
}

function getIconComponent(iconName?: string | null): unknown {
  if (!iconName) return UserOutlined
  return iconMap[iconName] ?? UserOutlined
}

const searchFields = computed<ProTableSearchField[]>(() => [
  {
    prop: 'keyword',
    label: t('approval.category.keyword'),
    type: 'input',
    placeholder: t('approval.category.keywordPlaceholder'),
    defaultValue: '',
  },
  {
    prop: 'enabled',
    label: t('approval.category.status'),
    type: 'select',
    options: [
      { label: t('approval.category.enabled'), value: true },
      { label: t('approval.category.disabled'), value: false },
    ],
  },
])

const columns = computed<ProTableColumn<ApprovalCategory>[]>(() => [
  {
    prop: 'code',
    label: t('approval.category.code'),
    width: 130,
    type: 'slot',
    slot: 'code',
  },
  {
    prop: 'name',
    label: t('approval.category.name'),
    minWidth: 160,
    type: 'slot',
    slot: 'name',
  },
  {
    prop: 'definitionCount',
    label: '关联流程',
    width: 130,
    align: 'center',
    type: 'slot',
    slot: 'flows',
  },
  {
    prop: 'sort',
    label: t('approval.category.sort'),
    width: 90,
    align: 'center',
    type: 'slot',
    slot: 'sort',
  },
  {
    prop: 'enabled',
    label: t('approval.category.status'),
    width: 100,
    align: 'center',
    type: 'slot',
    slot: 'enabled',
  },
  {
    prop: 'remark',
    label: t('approval.category.remark'),
    minWidth: 160,
    showOverflowTooltip: true,
  },
  {
    prop: 'createdAt',
    label: t('common.createdAt'),
    width: 170,
    formatter: (row) =>
      row.createdAt ? new Date(String(row.createdAt)).toLocaleString(locale.value) : '-',
  },
  {
    key: 'actions',
    label: t('common.actions'),
    width: 180,
    fixed: 'right',
    type: 'slot',
    slot: 'actions',
  },
])

const categoryActions = computed<ProTableAction<ApprovalCategory>[]>(() => [
  {
    key: 'viewFlows',
    label: '查看流程',
    placement: 'inline',
    onClick: (row: ApprovalCategory) => handleOpenFlowDrawer(row),
  },
  {
    key: 'edit',
    label: t('common.edit'),
    placement: 'inline',
    visible: hasPermission('system:approval:category:update'),
    onClick: (row: ApprovalCategory) => handleOpenEdit(row),
  },
  {
    key: 'delete',
    label: t('common.delete'),
    placement: 'inline',
    danger: true,
    visible: hasPermission('system:approval:category:delete'),
    onClick: (row: ApprovalCategory) => handleDelete(row),
  },
])

async function requestCategories(params: ProTableRequestParams) {
  return fetchApprovalCategoryList({
    page: params.page,
    pageSize: params.pageSize,
    keyword: String(params.keyword ?? '').trim() || undefined,
    enabled: typeof params.enabled === 'boolean' ? params.enabled : undefined,
  })
}

function handleOpenCreate(): void {
  editingCategory.value = null
  formDialogOpen.value = true
}

function handleOpenEdit(cat: ApprovalCategory): void {
  editingCategory.value = cat
  formDialogOpen.value = true
}

function handleOpenFlowDrawer(cat: ApprovalCategory): void {
  drawerCategory.value = cat
  flowDrawerOpen.value = true
}

function handleDesignFlowFromDrawer(def: ApprovalDefinition): void {
  designerEditing.value = def
  designerOpen.value = true
}

function handleCreateFlowForCategory(categoryName: string): void {
  designerEditing.value = null
  designerOpen.value = true
}

async function handleToggleStatus(cat: ApprovalCategory, enabled: boolean): Promise<void> {
  statusToggling.value = { ...statusToggling.value, [cat.id]: true }
  try {
    await toggleApprovalCategoryStatus(cat.id, enabled)
    void message.success(enabled ? t('approval.category.enabled') : t('approval.category.disabled'))
    await tableRef.value?.reload()
  } catch (error) {
    const msg =
      error instanceof ApiRequestError
        ? error.message
        : error instanceof Error
          ? error.message
          : t('approval.requestFailed')
    void message.error(msg)
  } finally {
    const copy = { ...statusToggling.value }
    delete copy[cat.id]
    statusToggling.value = copy
  }
}

function handleDelete(cat: ApprovalCategory): void {
  Modal.confirm({
    title: t('common.tip'),
    content: t('approval.category.deleteConfirm', { name: cat.name }),
    okType: 'danger',
    okText: t('common.confirm'),
    cancelText: t('common.cancel'),
    onOk: async () => {
      try {
        await deleteApprovalCategory(cat.id)
        void message.success(t('approval.category.deleteSuccess'))
        await tableRef.value?.reload()
      } catch (error) {
        const msg =
          error instanceof ApiRequestError
            ? error.message
            : error instanceof Error
              ? error.message
              : t('approval.requestFailed')
        void message.error(msg)
      }
    },
  })
}

function handleFormSuccess(): void {
  void tableRef.value?.reload()
}
</script>

<template>
  <div class="approval-category-view">
    <!-- 主体表格 -->
    <ProTable
      ref="tableRef"
      :columns="columns"
      :search-fields="searchFields"
      :request="requestCategories"
    >
      <template #toolbar-actions>
        <Button
          v-if="hasPermission('system:approval:category:create')"
          type="primary"
          @click="handleOpenCreate"
        >
          <PlusOutlined />
          {{ t('approval.category.create') }}
        </Button>
      </template>

      <template #column-code="{ row }">
        <Tag class="font-mono font-medium text-blue-700 bg-blue-50 border-blue-200">
          {{ row.code }}
        </Tag>
      </template>

      <template #column-name="{ row }">
        <div class="flex items-center gap-2.5">
          <div
            class="w-7 h-7 rounded-lg flex items-center justify-center text-white text-sm shadow-2xs shrink-0 bg-blue-600"
          >
            <component :is="getIconComponent(row.icon)" />
          </div>
          <span class="font-semibold text-slate-800">{{ row.name }}</span>
        </div>
      </template>

      <template #column-flows="{ row }">
        <Button
          type="link"
          size="small"
          class="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center gap-1 mx-auto cursor-pointer"
          @click="handleOpenFlowDrawer(row)"
        >
          <NodeIndexOutlined />
          <span>{{ row.definitionCount ?? 0 }} 个流程</span>
        </Button>
      </template>

      <template #column-sort="{ row }">
        <Tag class="font-mono text-slate-600 bg-slate-100 border-slate-200">
          {{ row.sort ?? 0 }}
        </Tag>
      </template>

      <template #column-enabled="{ row }">
        <Switch
          :checked="row.enabled"
          :loading="Boolean(statusToggling[row.id])"
          size="small"
          :disabled="!hasPermission('system:approval:category:update')"
          @update:checked="(val) => handleToggleStatus(row, Boolean(val))"
        />
      </template>

      <template #column-actions="{ row }">
        <ProTableActions :row="row" :actions="categoryActions" />
      </template>
    </ProTable>

    <!-- 新建 / 编辑分类弹窗 -->
    <CategoryFormDialog
      v-model:open="formDialogOpen"
      :category="editingCategory"
      @success="handleFormSuccess"
    />

    <!-- 关联流程抽屉 -->
    <CategoryFlowDrawer
      v-model:open="flowDrawerOpen"
      :category="drawerCategory"
      @design-flow="handleDesignFlowFromDrawer"
      @create-flow="handleCreateFlowForCategory"
    />

    <!-- 流程设计器弹窗 -->
    <DefinitionDesignerDialog
      v-model:open="designerOpen"
      :definition="designerEditing"
      @success="() => tableRef?.reload()"
    />
  </div>
</template>

<style scoped lang="scss">
.approval-category-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  min-height: 0;
}
</style>
