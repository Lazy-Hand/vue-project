<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Input, Modal, Pagination, Switch, Tabs, message } from 'antdv-next'
import {
  ApartmentOutlined,
  AppstoreOutlined,
  AuditOutlined,
  BankOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  CoffeeOutlined,
  DollarCircleOutlined,
  FileProtectOutlined,
  FileTextOutlined,
  FormOutlined,
  NodeIndexOutlined,
  PlusOutlined,
  ProjectOutlined,
  ReconciliationOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SendOutlined,
  SettingOutlined,
  SolutionOutlined,
  TableOutlined,
  TeamOutlined,
  ToolOutlined,
  TrophyOutlined,
  UserOutlined,
  WalletOutlined,
} from '@antdv-next/icons'

import {
  copyApprovalDefinition,
  deleteApprovalDefinition,
  fetchApprovalCategories,
  fetchApprovalDefinition,
  fetchApprovalDefinitions,
  publishApprovalDefinition,
  toggleApprovalDefinitionStatus,
} from '@/api/approval'
import ProTable from '@/components/ProTable/index.vue'
import ProTableActions from '@/components/ProTableActions/index.vue'
import SceneBindingDrawer from './SceneBindingDrawer.vue'
import { usePermission } from '@/composables/usePermission'
import type {
  ProTableAction,
  ProTableColumn,
  ProTableExpose,
  ProTableRequestParams,
  ProTableSearchField,
} from '@/types/pro-table'
import type {
  ApprovalCategoryCount,
  ApprovalDefinition,
  ApprovalDefinitionCategory,
} from '@/types/approval'
import { ApiRequestError } from '@/utils/request'
import DefinitionCardView from './DefinitionCardView.vue'
import DefinitionDesignerDialog from './designer/DefinitionDesignerDialog.vue'
import { mapDefinitionQuery } from './utils'

const { t, locale } = useI18n()
const { hasPermission } = usePermission()

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
  if (!iconName) return FileTextOutlined
  return iconMap[iconName] ?? FileTextOutlined
}

const canQuery = computed(() => hasPermission('system:approval:definition:query'))
const canCreate = computed(() => hasPermission('system:approval:definition:create'))
const canUpdate = computed(() => hasPermission('system:approval:definition:update'))
const canDelete = computed(() => hasPermission('system:approval:definition:delete'))

const viewMode = ref<'card' | 'table'>('card')
const activeCategory = ref<string>('all')
const categories = ref<ApprovalDefinitionCategory[]>([])

const searchKeyword = ref('')
const selectedEnabled = ref<boolean | null>(null)

// 卡片视图数据与分页
const cardItems = ref<ApprovalDefinition[]>([])
const cardTotal = ref(0)
const cardPage = ref(1)
const cardPageSize = ref(12)
const cardLoading = ref(false)

const tableRef = ref<ProTableExpose<ApprovalDefinition> | null>(null)
const designerOpen = ref(false)
const editing = ref<ApprovalDefinition | null>(null)

const categoryTabItems = computed(() => {
  const totalCount = categories.value.reduce(
    (acc: number, cur: ApprovalCategoryCount) => acc + cur.count,
    0,
  )
  const tabs = [
    {
      key: 'all',
      label: `${t('approval.definition.categoryAll')} (${totalCount})`,
    },
  ]
  for (const c of categories.value) {
    tabs.push({
      key: c.category,
      label: `${c.category} (${c.count})`,
    })
  }
  return tabs
})

const categoryList = computed(() => categories.value.map((c: ApprovalCategoryCount) => c.category))

async function loadCategories(): Promise<void> {
  if (!canQuery.value) return
  try {
    const list = await fetchApprovalCategories()
    categories.value = list
  } catch {
    categories.value = []
  }
}

async function loadCardData(): Promise<void> {
  if (!canQuery.value) return
  cardLoading.value = true
  try {
    const res = await fetchApprovalDefinitions({
      page: cardPage.value,
      pageSize: cardPageSize.value,
      category: activeCategory.value === 'all' ? undefined : activeCategory.value,
      keyword: searchKeyword.value.trim() || undefined,
      enabled: selectedEnabled.value !== null ? selectedEnabled.value : undefined,
    })
    cardItems.value = res.items
    cardTotal.value = res.total
  } catch (error) {
    message.error(errorMessage(error))
  } finally {
    cardLoading.value = false
  }
}

function handleCategoryChange(key: string): void {
  activeCategory.value = key
  cardPage.value = 1
  if (viewMode.value === 'card') {
    void loadCardData()
  } else {
    void tableRef.value?.reload()
  }
}

function handleSearch(): void {
  cardPage.value = 1
  if (viewMode.value === 'card') {
    void loadCardData()
  } else {
    void tableRef.value?.reload()
  }
}

function handleReset(): void {
  searchKeyword.value = ''
  selectedEnabled.value = null
  cardPage.value = 1
  if (viewMode.value === 'card') {
    void loadCardData()
  } else {
    void tableRef.value?.reload()
  }
}

const searchFields = computed<ProTableSearchField[]>(() => [
  {
    prop: 'keyword',
    label: t('approval.definition.keyword'),
    type: 'input',
    placeholder: t('approval.definition.keywordPlaceholder'),
    defaultValue: '',
  },
  {
    prop: 'enabled',
    label: t('approval.definition.status'),
    type: 'select',
    options: [
      { label: t('approval.definition.enabled'), value: true },
      { label: t('approval.definition.disabled'), value: false },
    ],
    placeholder: t('common.enabled'),
    defaultValue: null,
  },
])

const columns = computed<ProTableColumn<ApprovalDefinition>[]>(() => [
  { prop: 'code', label: t('approval.definition.code'), minWidth: 120 },
  { prop: 'name', label: t('approval.definition.name'), minWidth: 150, showOverflowTooltip: true },
  {
    prop: 'category',
    label: t('approval.definition.category'),
    width: 130,
    type: 'slot',
    slot: 'category',
  },
  { prop: 'version', label: t('approval.definition.version'), width: 80 },
  {
    prop: 'enabled',
    label: t('approval.definition.status'),
    width: 100,
    type: 'slot',
    slot: 'enabled',
  },
  {
    prop: 'nodes',
    label: t('approval.definition.nodes'),
    width: 90,
    formatter: (row) => String(row.nodes?.length ?? '-'),
  },
  {
    prop: 'remark',
    label: t('approval.definition.remark'),
    minWidth: 140,
    showOverflowTooltip: true,
    formatter: (row) => row.remark ?? '-',
  },
  {
    prop: 'updatedAt',
    label: t('approval.definition.updatedAt'),
    minWidth: 165,
    formatter: (row) => formatDateTime(row.updatedAt, locale.value),
  },
  {
    key: 'actions',
    label: t('common.actions'),
    width: 170,
    fixed: 'right',
    type: 'slot',
    slot: 'actions',
  },
])

const actions = computed<ProTableAction<ApprovalDefinition>[]>(() => [
  {
    key: 'edit',
    label: t('approval.definition.designFlow'),
    placement: 'inline',
    visible: canUpdate.value,
    onClick: (row) => handleEdit(row),
  },
  {
    key: 'publish',
    label: t('approval.definition.publishVersion'),
    placement: 'menu',
    visible: canUpdate.value,
    onClick: (row) => void handlePublish(row),
  },
  {
    key: 'bindings',
    label: t('approval.definition.sceneBindings'),
    placement: 'menu',
    visible: canUpdate.value,
    onClick: () => {
      bindingDrawerOpen.value = true
    },
  },
  {
    key: 'copy',
    label: t('approval.definition.copyFlow'),
    placement: 'inline',
    visible: canCreate.value,
    onClick: (row) => void handleCopy(row),
  },
  {
    key: 'delete',
    label: t('common.delete'),
    placement: 'inline',
    danger: true,
    visible: canDelete.value,
    onClick: (row) => void handleDelete(row),
  },
])

function formatDateTime(value: string, localeCode: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  try {
    return new Intl.DateTimeFormat(localeCode, { dateStyle: 'medium', timeStyle: 'short' }).format(
      date,
    )
  } catch {
    return value
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message
  if (error instanceof Error) return error.message
  return t('approval.requestFailed')
}

async function requestDefinitions(params: ProTableRequestParams) {
  if (!canQuery.value) return { items: [], total: 0 }
  const q = mapDefinitionQuery(params)
  if (activeCategory.value !== 'all') {
    q.category = activeCategory.value
  }
  return fetchApprovalDefinitions(q)
}

function handleCreate(): void {
  editing.value = null
  designerOpen.value = true
}

async function handleEdit(row: ApprovalDefinition): Promise<void> {
  try {
    const detail = await fetchApprovalDefinition(row.id)
    editing.value = detail
    designerOpen.value = true
  } catch (error) {
    message.error(errorMessage(error))
  }
}

async function handleCopy(row: ApprovalDefinition): Promise<void> {
  try {
    await copyApprovalDefinition(row.id)
    message.success(t('approval.definition.copySuccess'))
    await refreshAll()
  } catch (error) {
    message.error(errorMessage(error))
  }
}

async function handlePublish(row: ApprovalDefinition): Promise<void> {
  const confirmed = await new Promise<boolean>((resolve) => {
    Modal.confirm({
      title: t('common.tip'),
      content: t('approval.definition.publishConfirm'),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
  if (!confirmed) return
  try {
    await publishApprovalDefinition(row.id)
    message.success(t('approval.definition.publishSuccess'))
    await refreshAll()
  } catch (error) {
    message.error(errorMessage(error))
  }
}

// 场景绑定抽屉状态
const bindingDrawerOpen = ref(false)

async function handleToggleStatus(row: ApprovalDefinition, enabled: boolean): Promise<void> {
  try {
    await toggleApprovalDefinitionStatus(row.id, enabled)
    row.enabled = enabled
    message.success(t('approval.definition.statusToggleSuccess'))
  } catch (error) {
    message.error(errorMessage(error))
    if (viewMode.value === 'card') {
      void loadCardData()
    } else {
      void tableRef.value?.reload()
    }
  }
}

async function handleDelete(row: ApprovalDefinition): Promise<void> {
  const confirmed = await new Promise<boolean>((resolve) => {
    Modal.confirm({
      title: t('common.tip'),
      content: t('approval.definition.deleteConfirm', { name: row.name }),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      okType: 'danger',
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
  if (!confirmed) return

  try {
    await deleteApprovalDefinition(row.id)
    message.success(t('approval.definition.deleteSuccess'))
    await refreshAll()
  } catch (error) {
    message.error(errorMessage(error))
  }
}

async function refreshAll(): Promise<void> {
  await loadCategories()
  if (viewMode.value === 'card') {
    await loadCardData()
  } else {
    await tableRef.value?.reload()
  }
}

function handleDesignerSuccess(): void {
  void refreshAll()
}

onMounted(() => {
  void loadCategories()
  void loadCardData()
})
</script>

<template>
  <div class="definition-page h-full flex flex-col">
    <!-- 顶部操作区 -->
    <div class="definition-header">
      <div class="flex items-center justify-between gap-4 mb-3">
        <div>
          <h1 class="definition-title">
            <NodeIndexOutlined class="text-blue-500 text-xl" />
            {{ t('approval.definition.title') }}
          </h1>
          <p class="definition-subtitle">
            {{ t('approval.definition.subtitle') }}
          </p>
        </div>

        <div class="flex items-center gap-2">
          <!-- 视图切换 -->
          <div class="view-mode-toggle">
            <button
              type="button"
              :class="['view-mode-btn', viewMode === 'card' && 'is-active']"
              @click="viewMode = 'card'"
            >
              <AppstoreOutlined />
              {{ t('approval.definition.cardView') }}
            </button>
            <button
              type="button"
              :class="['view-mode-btn', viewMode === 'table' && 'is-active']"
              @click="viewMode = 'table'"
            >
              <TableOutlined />
              {{ t('approval.definition.tableView') }}
            </button>
          </div>

          <Button v-if="canCreate" type="primary" class="h-9 font-medium" @click="handleCreate">
            <PlusOutlined />
            {{ t('approval.definition.create') }}
          </Button>
        </div>
      </div>

      <!-- 分类 Tab 栏 + 卡片视图查询（仅 card 展示，table 走 ProTable 自带表单） -->
      <template v-if="viewMode === 'card'">
        <div class="definition-tabs-row">
          <Tabs
            :active-key="activeCategory"
            class="definition-category-tabs"
            :items="categoryTabItems"
            @change="(key) => handleCategoryChange(String(key))"
          />

          <div class="flex items-center gap-2">
            <Input
              v-model:value="searchKeyword"
              size="small"
              :placeholder="t('approval.definition.keywordPlaceholder')"
              class="w-56"
              allow-clear
              @press-enter="handleSearch"
            >
              <template #prefix>
                <SearchOutlined class="text-slate-400" />
              </template>
            </Input>

            <Button size="small" type="primary" @click="handleSearch">
              {{ t('common.search') }}
            </Button>
            <Button size="small" @click="handleReset">
              {{ t('common.reset') }}
            </Button>
          </div>
        </div>
      </template>
      <template v-else>
        <div class="definition-tabs-row">
          <Tabs
            :active-key="activeCategory"
            class="definition-category-tabs"
            :items="categoryTabItems"
            @change="(key) => handleCategoryChange(String(key))"
          />
        </div>
      </template>
    </div>

    <!-- 主展示区 -->
    <div class="flex-1 min-h-0 flex flex-col">
      <template v-if="viewMode === 'card'">
        <DefinitionCardView
          :items="cardItems"
          :loading="cardLoading"
          @edit="handleEdit"
          @copy="handleCopy"
          @delete="handleDelete"
          @toggle-status="handleToggleStatus"
        />

        <!-- 卡片分页 -->
        <div class="definition-pagination">
          <Pagination
            v-model:current="cardPage"
            v-model:page-size="cardPageSize"
            :total="cardTotal"
            :show-total="(total) => `共 ${total} 条`"
            show-size-changer
            size="small"
            @change="loadCardData"
          />
        </div>
      </template>

      <template v-else>
        <ProTable
          ref="tableRef"
          :columns="columns"
          :search-fields="searchFields"
          :request="requestDefinitions"
          :immediate="canQuery"
          :show-request-error="false"
        >
          <template #column-category="{ row }">
            <div class="flex items-center gap-2">
              <div
                class="w-7 h-7 rounded-lg flex items-center justify-center text-white text-sm shadow-2xs shrink-0"
                :style="{ backgroundColor: row.color || '#1677ff' }"
              >
                <component :is="getIconComponent(row.icon)" />
              </div>
              <span class="text-sm font-medium definition-table-category">
                {{ row.category || t('approval.definition.categoryDefault') }}
              </span>
            </div>
          </template>

          <template #column-enabled="{ row }">
            <Switch
              size="small"
              :checked="row.enabled"
              @change="(val) => handleToggleStatus(row, Boolean(val))"
            />
          </template>

          <template #column-actions="{ row }">
            <ProTableActions :row="row" :actions="actions" />
          </template>
        </ProTable>
      </template>
    </div>

    <!-- 4步式可视化流程设计器 -->
    <DefinitionDesignerDialog
      v-model:open="designerOpen"
      :definition="editing"
      :categories="categoryList"
      @success="handleDesignerSuccess"
    />

    <SceneBindingDrawer v-model:open="bindingDrawerOpen" />
  </div>
</template>

<style scoped lang="scss">
.definition-page {
  background-color: var(--app-fill-color, #f8fafc);
  color: var(--app-text-color-primary, #0f172a);
  transition:
    background-color 0.2s,
    color 0.2s;

  :deep(.definition-category-tabs) {
    margin-bottom: -16px;
    .ant-tabs-nav {
      margin-bottom: 0;
      &::before {
        border-bottom: none;
      }
    }
  }
}

.definition-header {
  background-color: #ffffff;
  border-bottom: 1px solid #eaedf3;
  padding: 16px 24px;
  transition: all 0.2s ease;
}

.definition-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
  display: flex;
  align-items: center;
  gap: 8px;
}

.definition-subtitle {
  margin: 2px 0 0;
  font-size: 12px;
  color: #94a3b8;
}

.view-mode-toggle {
  background-color: #f1f5f9;
  border: 1px solid #e2e8f0;
  padding: 3px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 2px;
  transition: all 0.2s ease;
}

.view-mode-btn {
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
  color: #64748b;
  cursor: pointer;
  border: none;
  background: transparent;
  transition: all 0.2s ease;

  &:hover {
    color: #0f172a;
  }

  &.is-active {
    background-color: #ffffff;
    color: var(--app-color-primary, #3b82f6);
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
  }
}

.definition-tabs-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid #f1f5f9;
  padding-top: 12px;
  transition: border-color 0.2s;
}

.definition-table-category {
  color: #334155;
}

.definition-pagination {
  padding: 12px 24px;
  background-color: #ffffff;
  border-top: 1px solid #eaedf3;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  transition: all 0.2s ease;
}

/* ==========================================================================
   暗黑模式 (Dark Mode)
   ========================================================================== */
html.dark {
  .definition-page {
    background-color: #16171a;
    color: #f1f5f9;
  }

  .definition-header {
    background-color: #1c1d22;
    border-bottom-color: #2a2c33;
  }

  .definition-title {
    color: #ffffff;
  }

  .definition-subtitle {
    color: #8b909a;
  }

  .view-mode-toggle {
    background-color: #22242a;
    border-color: #2e3038;
  }

  .view-mode-btn {
    color: #8b909a;

    &:hover {
      color: #cbd5e1;
    }

    &.is-active {
      background-color: #2e3038;
      color: #ffffff;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    }
  }

  .definition-tabs-row {
    border-top-color: #262830;
  }

  .definition-table-category {
    color: #cbd5e1;
  }

  .definition-pagination {
    background-color: #1c1d22;
    border-top-color: #2a2c33;
  }
}
</style>
