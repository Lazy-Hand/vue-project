<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Badge,
  Button,
  Input,
  Modal,
  Pagination,
  Radio,
  RadioGroup,
  Select,
  Switch,
  Tabs,
  Tag,
  message,
} from 'antdv-next'
import {
  AppstoreOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  NodeIndexOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  TableOutlined,
  UnorderedListOutlined,
} from '@antdv-next/icons'

import {
  copyApprovalDefinition,
  deleteApprovalDefinition,
  fetchApprovalCategories,
  fetchApprovalDefinition,
  fetchApprovalDefinitions,
  toggleApprovalDefinitionStatus,
} from '@/api/approval'
import ProTable from '@/components/ProTable/index.vue'
import ProTableActions from '@/components/ProTableActions/index.vue'
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
      tab: `${t('approval.definition.categoryAll')} (${totalCount})`,
    },
  ]
  for (const c of categories.value) {
    tabs.push({
      key: c.category,
      tab: `${c.category} (${c.count})`,
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
    width: 120,
    formatter: (row) => row.category ?? '-',
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
    icon: EditOutlined,
    placement: 'inline',
    hidden: !canUpdate.value,
    onClick: (row) => handleEdit(row),
  },
  {
    key: 'copy',
    label: t('approval.definition.copyFlow'),
    icon: CopyOutlined,
    placement: 'inline',
    hidden: !canCreate.value,
    onClick: (row) => void handleCopy(row),
  },
  {
    key: 'delete',
    label: t('common.delete'),
    icon: DeleteOutlined,
    placement: 'inline',
    danger: true,
    hidden: !canDelete.value,
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
  <div class="definition-page h-full flex flex-col bg-slate-50/50">
    <!-- 顶部操作区 -->
    <div class="bg-white border-b border-slate-200 px-6 py-4">
      <div class="flex items-center justify-between gap-4 mb-3">
        <div>
          <h1 class="text-lg font-bold text-slate-800 flex items-center gap-2">
            <NodeIndexOutlined class="text-blue-600 text-xl" />
            {{ t('approval.definition.title') }}
          </h1>
          <p class="text-xs text-slate-400 mt-0.5">
            {{ t('approval.definition.subtitle') }}
          </p>
        </div>

        <div class="flex items-center gap-2">
          <!-- 视图切换 -->
          <div class="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200">
            <button
              type="button"
              :class="[
                'px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer',
                viewMode === 'card'
                  ? 'bg-white text-blue-600 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-700',
              ]"
              @click="viewMode = 'card'"
            >
              <AppstoreOutlined />
              {{ t('approval.definition.cardView') }}
            </button>
            <button
              type="button"
              :class="[
                'px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer',
                viewMode === 'table'
                  ? 'bg-white text-blue-600 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-700',
              ]"
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

      <!-- 分类 Tab 栏 -->
      <div class="flex items-center justify-between border-t border-slate-100 pt-3">
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
        <div class="p-3 bg-white border-t border-slate-200 flex items-center justify-end px-6">
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
  </div>
</template>

<style scoped lang="scss">
.definition-page {
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
</style>
