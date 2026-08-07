<script setup lang="ts" generic="T extends object = ProTableRow">
import { computed, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowDown, ArrowUp, Loading, Rank, Setting } from '@element-plus/icons-vue'
import {
  ElAlert,
  ElButton,
  ElCheckbox,
  ElCheckboxGroup,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElOption,
  ElPagination,
  ElPopover,
  ElSelect,
  ElTable,
  ElTableColumn,
  ElTag,
} from 'element-plus'
import type { TableColumnCtx, TableInstance, TagProps } from 'element-plus'

import DictSelect from '@/components/DictSelect/index.vue'
import DictTag from '@/components/DictTag/index.vue'
import type {
  ProTableColumn,
  ProTableDefaultSort,
  ProTablePaginationConfig,
  ProTableRequestData,
  ProTableRequestParams,
  ProTableRequestResult,
  ProTableRow,
  ProTableSearchField,
  ProTableSearchValue,
  ProTableSortState,
  ProTableTreeProps,
} from '@/types/pro-table'

interface Props {
  columns: ProTableColumn<T>[]
  searchFields?: ProTableSearchField[]
  request: (params: ProTableRequestParams) => Promise<ProTableRequestResult<T>>
  rowKey?: string
  pagination?: boolean | ProTablePaginationConfig
  defaultSort?: ProTableDefaultSort
  immediate?: boolean
  clientFilter?: (items: T[], params: ProTableRequestParams) => T[]
  border?: boolean
  stripe?: boolean
  height?: string | number
  maxHeight?: string | number
  showHeader?: boolean
  highlightCurrentRow?: boolean
  currentRowKey?: string | number
  defaultExpandAll?: boolean
  treeProps?: ProTableTreeProps
  showSearchActions?: boolean
  showColumnSetting?: boolean
  searchCollapsible?: boolean
  searchCollapseThreshold?: number
  defaultSearchCollapsed?: boolean
  showRequestError?: boolean
  emptyText?: string
  emptyCellText?: string
}

interface SearchSlotProps {
  field: ProTableSearchField
  modelValue: ProTableSearchValue
  setValue: (value: ProTableSearchValue) => void
  search: () => Promise<void>
}

interface TableSortChange {
  prop: string | null
  order?: 'ascending' | 'descending' | null
}

interface ColumnSettingItem {
  key: string
  label: string
  visible: boolean
}

const props = withDefaults(defineProps<Props>(), {
  searchFields: () => [],
  rowKey: 'id',
  pagination: true,
  defaultSort: undefined,
  immediate: true,
  clientFilter: undefined,
  border: false,
  stripe: false,
  height: undefined,
  maxHeight: undefined,
  showHeader: true,
  highlightCurrentRow: false,
  currentRowKey: undefined,
  defaultExpandAll: false,
  treeProps: undefined,
  showSearchActions: true,
  showColumnSetting: true,
  searchCollapsible: true,
  searchCollapseThreshold: 3,
  defaultSearchCollapsed: true,
  showRequestError: true,
  emptyText: undefined,
  emptyCellText: '-',
})

const emit = defineEmits<{
  'row-click': [row: T, column: TableColumnCtx<T> | null, event: PointerEvent]
  'selection-change': [rows: T[]]
  'sort-change': [sort: ProTableSortState]
  'search-collapse-change': [collapsed: boolean]
  'column-visibility-change': [visibleKeys: string[]]
  'column-order-change': [orderedKeys: string[]]
  'request-success': [result: ProTableRequestData<T>, params: ProTableRequestParams]
  'request-error': [error: unknown, params: ProTableRequestParams]
}>()

const { t } = useI18n()

const tableRef = ref<TableInstance>()
const loading = ref(false)
const requestFailed = ref(false)
const lastRequestError = shallowRef<unknown>()
const searchCollapsed = ref(props.defaultSearchCollapsed)
const tableData = shallowRef<T[]>([])
const selectedRows = shallowRef<T[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const sortField = ref<string>()
const sortOrder = ref<'asc' | 'desc'>()
const searchForm = reactive<Record<string, ProTableSearchValue>>({})
const columnVisibility = reactive<Record<string, boolean>>({})
const columnOrder = ref<string[]>([])
const columnSettingVisible = ref(false)
const draftColumnOrder = ref<string[]>([])
const draftVisibleColumnKeys = ref<string[]>([])
const draggedColumnKey = ref<string>()
const dragOverColumnKey = ref<string>()

const columnSourceHidden: Record<string, boolean> = {}

let requestSequence = 0

const sourceColumnSettingItems = computed<ColumnSettingItem[]>(() =>
  props.columns.map((column, index) => {
    const key = columnKey(column, index)
    return {
      key,
      label: columnSettingLabel(column),
      visible: columnVisibility[key] ?? !column.hidden,
    }
  }),
)
const draftColumnSettingItems = computed<ColumnSettingItem[]>(() => {
  const itemMap = new Map(sourceColumnSettingItems.value.map((item) => [item.key, item]))
  return normalizeColumnOrder(draftColumnOrder.value)
    .map((key) => itemMap.get(key))
    .filter((item): item is ColumnSettingItem => item !== undefined)
    .map((item) => ({ ...item, visible: draftVisibleColumnKeys.value.includes(item.key) }))
})
const selectedDraftColumnKeys = computed<string[]>({
  get: () => draftVisibleColumnKeys.value,
  set: (keys) => setDraftVisibleColumnKeys(keys),
})
const draftVisibleColumnCount = computed(() => draftVisibleColumnKeys.value.length)
const columnSettingAvailable = computed(() => props.showColumnSetting && props.columns.length > 0)
const visibleColumns = computed(() => {
  const columnMap = new Map(
    props.columns.map((column, index) => [columnKey(column, index), column] as const),
  )
  return normalizeColumnOrder(columnOrder.value)
    .filter((key) => columnVisibility[key])
    .map((key) => columnMap.get(key))
    .filter((column): column is ProTableColumn<T> => column !== undefined)
})
const searchCollapseThreshold = computed(() =>
  Math.max(1, Math.floor(props.searchCollapseThreshold)),
)
const searchCanCollapse = computed(
  () => props.searchCollapsible && props.searchFields.length > searchCollapseThreshold.value,
)
const visibleSearchFields = computed(() => {
  if (!searchCanCollapse.value || !searchCollapsed.value) return props.searchFields
  return props.searchFields.slice(0, searchCollapseThreshold.value)
})
const paginationEnabled = computed(() => props.pagination !== false)
const resolvedEmptyText = computed(() => props.emptyText ?? t('proTable.empty'))

const paginationConfig = computed<ProTablePaginationConfig>(() => {
  if (props.pagination === false || props.pagination === true) return {}
  return props.pagination
})

const pageSizes = computed(() => paginationConfig.value.pageSizes ?? [10, 20, 50])
const paginationLayout = computed(
  () => paginationConfig.value.layout ?? 'total, sizes, prev, pager, next',
)
const paginationSmall = computed(() => paginationConfig.value.small ?? false)
const paginationBackground = computed(() => paginationConfig.value.background ?? true)
const hidePaginationOnSinglePage = computed(() => paginationConfig.value.hideOnSinglePage ?? false)
const paginationPagerCount = computed(() => paginationConfig.value.pagerCount ?? 7)

function cloneSearchValue(value: ProTableSearchValue | undefined): ProTableSearchValue {
  if (Array.isArray(value)) return [...value]
  return value ?? null
}

function initSearchForm(): void {
  for (const key of Object.keys(searchForm)) {
    delete searchForm[key]
  }
  for (const field of props.searchFields) {
    searchForm[field.prop] = cloneSearchValue(field.defaultValue)
  }
}

function isEmptySearchValue(value: ProTableSearchValue): boolean {
  return value === null || value === '' || (Array.isArray(value) && value.length === 0)
}

function buildRequestParams(): ProTableRequestParams {
  const params: ProTableRequestParams = {
    page: page.value,
    pageSize: pageSize.value,
  }

  for (const field of props.searchFields) {
    const value = searchForm[field.prop] ?? null
    if (isEmptySearchValue(value)) continue
    params[field.prop] = field.transform ? field.transform(value) : value
  }

  if (sortField.value && sortOrder.value) {
    params.sortField = sortField.value
    params.sortOrder = sortOrder.value
  }

  return params
}

function normalizeResult(result: ProTableRequestResult<T>): ProTableRequestData<T> {
  if (Array.isArray(result)) {
    return { items: result, total: result.length }
  }
  return result
}

async function loadData(): Promise<void> {
  const sequence = ++requestSequence
  const params = buildRequestParams()
  loading.value = true
  requestFailed.value = false
  lastRequestError.value = undefined

  try {
    const rawResult = await props.request(params)
    if (sequence !== requestSequence) return

    const result = normalizeResult(rawResult)
    if (paginationEnabled.value && page.value > 1) {
      const lastPage = Math.max(1, Math.ceil(result.total / pageSize.value))
      if (page.value > lastPage) {
        page.value = lastPage
        await loadData()
        return
      }
    }

    const items = props.clientFilter ? props.clientFilter(result.items, params) : result.items
    const nextResult = {
      items,
      total: Array.isArray(rawResult) && props.clientFilter ? items.length : result.total,
    }

    tableData.value = nextResult.items
    total.value = nextResult.total
    emit('request-success', nextResult, params)
  } catch (error) {
    if (sequence !== requestSequence) return
    emit('request-error', error, params)
    requestFailed.value = true
    lastRequestError.value = error
  } finally {
    if (sequence === requestSequence) {
      loading.value = false
    }
  }
}

async function handleSearch(): Promise<void> {
  page.value = 1
  await loadData()
}

async function handleReset(): Promise<void> {
  initSearchForm()
  page.value = 1
  await loadData()
}

function handlePageChange(next: number): void {
  page.value = next
  void loadData()
}

function handleSizeChange(size: number): void {
  pageSize.value = size
  page.value = 1
  void loadData()
}

function shouldSearchOnChange(field: ProTableSearchField): boolean {
  if (field.searchOnChange !== undefined) return field.searchOnChange
  return field.type === 'select' || field.type === 'dict-select'
}

function handleFieldChange(field: ProTableSearchField): void {
  if (shouldSearchOnChange(field)) {
    void handleSearch()
  }
}

function handleInputClear(field: ProTableSearchField): void {
  if (field.searchOnChange !== false) {
    void handleSearch()
  }
}

function setSearchCollapsed(collapsed: boolean): void {
  if (searchCollapsed.value === collapsed) return
  searchCollapsed.value = collapsed
  emit('search-collapse-change', collapsed)
}

function toggleSearchCollapse(): void {
  setSearchCollapsed(!searchCollapsed.value)
}

function setSearchValue(prop: string, value: ProTableSearchValue): void {
  searchForm[prop] = value
}

function inputValue(prop: string): string | number | null {
  const value = searchForm[prop]
  if (typeof value === 'string' || typeof value === 'number') return value
  if (typeof value === 'boolean') return String(value)
  return null
}

function setDictSelectValue(field: ProTableSearchField, value: string | null): void {
  setSearchValue(field.prop, value)
  handleFieldChange(field)
}

function getSearchSlotProps(field: ProTableSearchField): SearchSlotProps {
  return {
    field,
    modelValue: searchForm[field.prop] ?? null,
    setValue: (value) => setSearchValue(field.prop, value),
    search: handleSearch,
  }
}

async function setSearchParams(
  params: Record<string, ProTableSearchValue>,
  submit = false,
): Promise<void> {
  for (const field of props.searchFields) {
    if (Object.hasOwn(params, field.prop)) {
      searchForm[field.prop] = cloneSearchValue(params[field.prop])
    }
  }
  if (submit) {
    await handleSearch()
  }
}

function getCellValue(row: T, prop?: string): unknown {
  if (!prop) return undefined
  return prop.split('.').reduce<unknown>(
    (acc, key) => {
      if (acc && typeof acc === 'object' && key in acc) {
        return (acc as ProTableRow)[key]
      }
      return undefined
    },
    row as Record<string, unknown>,
  )
}

function formatCell(row: T, column: ProTableColumn<T>, index: number): string | number {
  const value = getCellValue(row, column.prop)
  if (column.formatter) {
    return column.formatter(row, column, value, index)
  }
  if (value === null || value === undefined || value === '') return props.emptyCellText
  return String(value)
}

function tagLabel(row: T, column: ProTableColumn<T>, index: number): string | number {
  const value = getCellValue(row, column.prop)
  if (typeof value === 'boolean') {
    return value
      ? (column.trueLabel ?? t('common.enabled'))
      : (column.falseLabel ?? t('common.disabled'))
  }
  return formatCell(row, column, index)
}

function tagType(row: T, column: ProTableColumn<T>): TagProps['type'] {
  const value = getCellValue(row, column.prop)
  if (typeof value === 'boolean') {
    return value ? 'success' : 'info'
  }
  if (column.tagTypeMap && value !== null && value !== undefined) {
    return column.tagTypeMap[String(value)]
  }
  return undefined
}

function dictValue(row: T, prop?: string): string | number | boolean | null {
  const value = getCellValue(row, prop)
  if (value === null || value === undefined) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  return String(value)
}

function tableColumnType(column: ProTableColumn<T>): 'selection' | 'index' | undefined {
  if (column.type === 'selection' || column.type === 'index') return column.type
  return undefined
}

function isStructuralColumn(column: ProTableColumn<T>): boolean {
  return column.type === 'selection' || column.type === 'index'
}

function columnKey(column: ProTableColumn<T>, index: number): string {
  return column.key ?? column.slot ?? column.prop ?? `${column.type ?? 'column'}-${index}`
}

function resolvedColumnKey(column: ProTableColumn<T>): string {
  const sourceIndex = props.columns.indexOf(column)
  return columnKey(column, sourceIndex >= 0 ? sourceIndex : 0)
}

function normalizeColumnOrder(order: string[]): string[] {
  const sourceKeys = props.columns.map((column, index) => columnKey(column, index))
  const availableKeys = new Set(sourceKeys)
  const normalized = order.filter(
    (key, index) => availableKeys.has(key) && order.indexOf(key) === index,
  )
  const normalizedKeys = new Set(normalized)
  return [...normalized, ...sourceKeys.filter((key) => !normalizedKeys.has(key))]
}

function columnSettingLabel(column: ProTableColumn<T>): string {
  if (column.label) return column.label
  if (column.type === 'selection') return t('proTable.selectionColumn')
  if (column.type === 'index') return t('proTable.indexColumn')
  return t('proTable.unnamedColumn')
}

function setDraftVisibleColumnKeys(keys: string[]): void {
  const availableKeys = new Set(sourceColumnSettingItems.value.map((item) => item.key))
  const nextKeys = keys.filter((key) => availableKeys.has(key))
  if (availableKeys.size > 0 && nextKeys.length === 0) return

  draftVisibleColumnKeys.value = nextKeys
}

function initColumnSettingDraft(): void {
  draftColumnOrder.value = normalizeColumnOrder(columnOrder.value)
  draftVisibleColumnKeys.value = draftColumnOrder.value.filter(
    (key) => columnVisibility[key] ?? true,
  )
  draggedColumnKey.value = undefined
  dragOverColumnKey.value = undefined
}

function resetColumnSettings(): void {
  draftColumnOrder.value = props.columns.map((column, index) => columnKey(column, index))
  const visibleKeys = props.columns
    .map((column, index) => ({ key: columnKey(column, index), visible: !column.hidden }))
    .filter((item) => item.visible)
    .map((item) => item.key)
  draftVisibleColumnKeys.value =
    visibleKeys.length > 0 ? visibleKeys : draftColumnOrder.value.slice(0, 1)
}

function saveColumnSettings(): void {
  const orderedKeys = normalizeColumnOrder(draftColumnOrder.value)
  const visibleKeys = new Set(draftVisibleColumnKeys.value)

  for (const key of orderedKeys) {
    columnVisibility[key] = visibleKeys.has(key)
  }
  columnOrder.value = orderedKeys
  emit(
    'column-visibility-change',
    orderedKeys.filter((key) => visibleKeys.has(key)),
  )
  emit('column-order-change', orderedKeys)
  columnSettingVisible.value = false
}

function moveDraftColumn(key: string, offset: -1 | 1): void {
  const order = normalizeColumnOrder(draftColumnOrder.value)
  const currentIndex = order.indexOf(key)
  const nextIndex = currentIndex + offset
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= order.length) return

  order.splice(currentIndex, 1)
  order.splice(nextIndex, 0, key)
  draftColumnOrder.value = order
}

function handleColumnDragStart(event: DragEvent, key: string): void {
  draggedColumnKey.value = key
  event.dataTransfer?.setData('text/plain', key)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function reorderDraftColumn(sourceKey: string, targetKey: string): void {
  if (sourceKey === targetKey) return

  const order = normalizeColumnOrder(draftColumnOrder.value)
  const sourceIndex = order.indexOf(sourceKey)
  const targetIndex = order.indexOf(targetKey)
  if (sourceIndex < 0 || targetIndex < 0) return

  order.splice(sourceIndex, 1)
  order.splice(targetIndex, 0, sourceKey)
  draftColumnOrder.value = order
}

function handleColumnDragEnter(targetKey: string): void {
  const sourceKey = draggedColumnKey.value
  if (!sourceKey || sourceKey === targetKey || dragOverColumnKey.value === targetKey) return

  dragOverColumnKey.value = targetKey
  reorderDraftColumn(sourceKey, targetKey)
}

function handleColumnDrop(event: DragEvent, targetKey: string): void {
  const sourceKey = draggedColumnKey.value ?? event.dataTransfer?.getData('text/plain')
  if (sourceKey && sourceKey !== targetKey && !dragOverColumnKey.value) {
    reorderDraftColumn(sourceKey, targetKey)
  }
  handleColumnDragEnd()
}

function handleColumnDragEnd(): void {
  draggedColumnKey.value = undefined
  dragOverColumnKey.value = undefined
}

function onRowClick(row: T, column: TableColumnCtx<T> | null, event: PointerEvent): void {
  emit('row-click', row, column, event)
}

function onSelectionChange(rows: T[]): void {
  selectedRows.value = [...rows]
  emit('selection-change', [...rows])
}

function onSortChange(change: TableSortChange): void {
  const state: ProTableSortState = {
    prop: change.prop ?? null,
    order: change.order ?? null,
  }
  emit('sort-change', state)

  const remoteProp = state.prop ?? sortField.value
  const remoteColumn = props.columns.find((column) => column.prop === remoteProp)
  if (remoteColumn?.sortable !== 'custom') return

  sortField.value = state.order ? (state.prop ?? undefined) : undefined
  sortOrder.value =
    state.order === 'ascending' ? 'asc' : state.order === 'descending' ? 'desc' : undefined
  page.value = 1
  void loadData()
}

function clearSelection(): void {
  tableRef.value?.clearSelection()
  selectedRows.value = []
}

function toggleRowSelection(row: T, selected?: boolean): void {
  tableRef.value?.toggleRowSelection(row, selected)
}

function setAllRowsExpanded(expanded: boolean): void {
  const childrenKey = props.treeProps?.children ?? 'children'

  function visit(rows: T[]): void {
    for (const row of rows) {
      tableRef.value?.toggleRowExpansion(row, expanded)
      const children = (row as Record<string, unknown>)[childrenKey]
      if (Array.isArray(children)) {
        visit(children as T[])
      }
    }
  }

  visit(tableData.value)
}

watch(
  () =>
    props.columns.map((column, index) => ({
      key: columnKey(column, index),
      hidden: Boolean(column.hidden),
    })),
  (columns) => {
    const activeKeys = new Set(columns.map((column) => column.key))

    for (const column of columns) {
      const sourceChanged =
        Object.hasOwn(columnSourceHidden, column.key) &&
        columnSourceHidden[column.key] !== column.hidden
      if (!Object.hasOwn(columnSourceHidden, column.key) || sourceChanged) {
        columnVisibility[column.key] = !column.hidden
      }
      columnSourceHidden[column.key] = column.hidden
    }

    for (const key of Object.keys(columnSourceHidden)) {
      if (activeKeys.has(key)) continue
      delete columnSourceHidden[key]
      delete columnVisibility[key]
    }

    columnOrder.value = normalizeColumnOrder(columnOrder.value)
    if (columnSettingVisible.value) initColumnSettingDraft()
  },
  { deep: true, immediate: true },
)

watch(columnSettingVisible, (visible) => {
  if (visible) {
    initColumnSettingDraft()
  } else {
    handleColumnDragEnd()
  }
})

watch(
  () => props.searchFields,
  () => {
    initSearchForm()
  },
  { deep: true, immediate: true },
)

watch(
  () => paginationConfig.value.pageSize,
  (size) => {
    if (typeof size === 'number' && size > 0) pageSize.value = size
  },
  { immediate: true },
)

watch(
  () => props.defaultSort,
  (defaultSort) => {
    const column = props.columns.find((item) => item.prop === defaultSort?.prop)
    if (!defaultSort || column?.sortable !== 'custom') {
      sortField.value = undefined
      sortOrder.value = undefined
      return
    }
    sortField.value = defaultSort.prop
    sortOrder.value = defaultSort.order === 'ascending' ? 'asc' : 'desc'
  },
  { deep: true, immediate: true },
)

watch(
  () => props.defaultSearchCollapsed,
  (collapsed) => {
    searchCollapsed.value = collapsed
  },
)

onMounted(() => {
  if (props.immediate) {
    void loadData()
  }
})

defineExpose({
  reload: loadData,
  search: handleSearch,
  resetSearch: handleReset,
  getSearchParams: buildRequestParams,
  setSearchParams,
  setSearchCollapsed,
  toggleSearchCollapse,
  setAllRowsExpanded,
  getTableData: () => tableData.value,
  getSelectedRows: () => selectedRows.value,
  clearSelection,
  toggleRowSelection,
})
</script>

<template>
  <div class="pro-table">
    <div
      v-if="searchFields.length || $slots['toolbar-actions'] || columnSettingAvailable"
      class="pro-table__toolbar"
    >
      <el-form
        v-if="searchFields.length"
        inline
        class="pro-table__search"
        @submit.prevent="handleSearch"
      >
        <el-form-item
          v-for="field in visibleSearchFields"
          :key="field.prop"
          :label="field.label"
          class="pro-table__search-item"
        >
          <el-input
            v-if="(field.type ?? 'input') === 'input'"
            :model-value="inputValue(field.prop)"
            :clearable="field.clearable ?? true"
            :class="['pro-table__field', field.fieldClass]"
            :placeholder="field.placeholder"
            @update:model-value="setSearchValue(field.prop, $event)"
            @keyup.enter="handleSearch"
            @clear="handleInputClear(field)"
          />
          <el-select
            v-else-if="field.type === 'select'"
            v-model="searchForm[field.prop]"
            :clearable="field.clearable ?? true"
            :multiple="field.multiple"
            :class="['pro-table__field', field.fieldClass]"
            :placeholder="field.placeholder"
            @change="handleFieldChange(field)"
          >
            <el-option
              v-for="option in field.options ?? []"
              :key="String(option.value)"
              :label="option.label"
              :value="option.value"
              :disabled="option.disabled"
            />
          </el-select>
          <DictSelect
            v-else-if="field.type === 'dict-select' && field.dictTypeCode"
            :model-value="String(searchForm[field.prop] ?? '') || null"
            :type-code="field.dictTypeCode"
            :clearable="field.clearable ?? true"
            :class="['pro-table__field', field.fieldClass]"
            :placeholder="field.placeholder"
            @update:model-value="setDictSelectValue(field, $event)"
          />
          <slot
            v-else-if="field.type === 'slot'"
            :name="`search-${field.slot ?? field.prop}`"
            v-bind="getSearchSlotProps(field)"
          />
        </el-form-item>

        <el-form-item
          v-if="showSearchActions || searchCanCollapse"
          class="pro-table__search-actions"
        >
          <slot
            v-if="showSearchActions"
            name="search-actions"
            :search="handleSearch"
            :reset="handleReset"
            :loading="loading"
            :collapsible="searchCanCollapse"
            :collapsed="searchCollapsed"
            :toggle-collapse="toggleSearchCollapse"
          >
            <el-button type="primary" :loading="loading" @click="handleSearch">
              {{ t('proTable.search') }}
            </el-button>
            <el-button :disabled="loading" @click="handleReset">{{
              t('proTable.reset')
            }}</el-button>
          </slot>
          <el-button
            v-if="searchCanCollapse"
            class="pro-table__collapse-button"
            link
            type="primary"
            @click="toggleSearchCollapse"
          >
            {{ searchCollapsed ? t('proTable.expand') : t('proTable.collapse') }}
            <el-icon>
              <ArrowDown v-if="searchCollapsed" />
              <ArrowUp v-else />
            </el-icon>
          </el-button>
        </el-form-item>
      </el-form>

      <div v-if="$slots['toolbar-actions'] || columnSettingAvailable" class="pro-table__actions">
        <slot name="toolbar-actions" />
        <el-popover
          v-if="columnSettingAvailable"
          v-model:visible="columnSettingVisible"
          placement="bottom-end"
          :width="280"
          trigger="click"
          :teleported="false"
        >
          <template #reference>
            <el-button class="pro-table__column-setting-trigger" plain>
              <el-icon><Setting /></el-icon>
              {{ t('proTable.columnSetting') }}
            </el-button>
          </template>

          <div class="pro-table__column-setting">
            <div class="pro-table__column-setting-header">
              <div>
                <div class="pro-table__column-setting-title">
                  {{ t('proTable.columnSetting') }}
                </div>
                <div class="pro-table__column-setting-summary" aria-live="polite">
                  {{
                    t('proTable.visibleColumns', {
                      visible: draftVisibleColumnCount,
                      total: draftColumnSettingItems.length,
                    })
                  }}
                </div>
              </div>
            </div>

            <el-checkbox-group
              v-model="selectedDraftColumnKeys"
              class="pro-table__column-setting-list"
            >
              <div
                v-for="item in draftColumnSettingItems"
                :key="item.key"
                :class="[
                  'pro-table__column-setting-option',
                  {
                    'is-dragging': draggedColumnKey === item.key,
                    'is-drag-over': dragOverColumnKey === item.key,
                  },
                ]"
                @dragenter.prevent="handleColumnDragEnter(item.key)"
                @dragover.prevent
                @drop.prevent="handleColumnDrop($event, item.key)"
              >
                <button
                  type="button"
                  class="pro-table__column-drag-handle"
                  draggable="true"
                  :aria-label="t('proTable.dragColumn', { label: item.label })"
                  :title="t('proTable.dragColumn', { label: item.label })"
                  @dragstart="handleColumnDragStart($event, item.key)"
                  @dragend="handleColumnDragEnd"
                  @keydown.up.prevent="moveDraftColumn(item.key, -1)"
                  @keydown.down.prevent="moveDraftColumn(item.key, 1)"
                >
                  <el-icon class="pro-table__column-drag-icon"><Rank /></el-icon>
                </button>
                <el-checkbox
                  :value="item.key"
                  :disabled="item.visible && draftVisibleColumnCount === 1"
                  class="pro-table__column-setting-checkbox"
                >
                  {{ item.label }}
                </el-checkbox>
              </div>
            </el-checkbox-group>

            <div class="pro-table__column-setting-footer">
              <el-button class="pro-table__column-setting-reset" @click="resetColumnSettings">
                {{ t('proTable.resetColumns') }}
              </el-button>
              <el-button
                class="pro-table__column-setting-save"
                type="primary"
                @click="saveColumnSettings"
              >
                {{ t('proTable.saveColumns') }}
              </el-button>
            </div>
          </div>
        </el-popover>
      </div>
    </div>

    <slot
      v-if="requestFailed && showRequestError"
      name="request-error"
      :error="lastRequestError"
      :retry="loadData"
    >
      <el-alert :title="t('proTable.requestFailed')" type="error" show-icon :closable="false" />
    </slot>

    <div class="pro-table__table-wrap" :aria-busy="loading">
      <el-table
        ref="tableRef"
        :data="tableData"
        :row-key="rowKey"
        :border="border"
        :stripe="stripe"
        :height="height"
        :max-height="maxHeight"
        :show-header="showHeader"
        :highlight-current-row="highlightCurrentRow"
        :current-row-key="currentRowKey"
        :default-expand-all="defaultExpandAll"
        :tree-props="treeProps"
        :default-sort="defaultSort"
        :empty-text="resolvedEmptyText"
        class="pro-table__table"
        @row-click="onRowClick"
        @selection-change="onSelectionChange"
        @sort-change="onSortChange"
      >
        <el-table-column
          v-for="column in visibleColumns"
          :key="resolvedColumnKey(column)"
          :type="tableColumnType(column)"
          :prop="column.prop"
          :label="column.label"
          :width="column.width"
          :min-width="column.minWidth"
          :fixed="column.fixed"
          :align="column.align"
          :header-align="column.headerAlign"
          :class-name="column.className"
          :show-overflow-tooltip="column.showOverflowTooltip"
          :sortable="column.sortable"
          :sort-orders="column.sortOrders"
          :index="column.index"
          :selectable="column.selectable"
          :reserve-selection="column.reserveSelection"
        >
          <template v-if="column.headerSlot" #header="{ column: tableColumn, $index }">
            <slot
              :name="`header-${column.headerSlot}`"
              :column="tableColumn"
              :index="$index"
              :config="column"
            />
          </template>
          <template v-if="!isStructuralColumn(column)" #default="{ row, $index }">
            <slot
              v-if="column.type === 'slot' && column.slot"
              :name="`column-${column.slot}`"
              :row="row"
              :index="$index"
              :column="column"
            />
            <DictTag
              v-else-if="column.type === 'dict' && column.dictTypeCode"
              :type-code="column.dictTypeCode"
              :value="dictValue(row, column.prop)"
              :tag-type-map="column.tagTypeMap"
            />
            <el-tag v-else-if="column.type === 'tag'" :type="tagType(row, column)" size="small">
              {{ tagLabel(row, column, $index) }}
            </el-tag>
            <span v-else>{{ formatCell(row, column, $index) }}</span>
          </template>
        </el-table-column>

        <template #empty>
          <slot name="empty">{{ resolvedEmptyText }}</slot>
        </template>
        <template v-if="$slots.append" #append>
          <slot name="append" />
        </template>
      </el-table>

      <div v-if="loading" class="pro-table__loading" role="status">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>{{ t('proTable.loading') }}</span>
      </div>
    </div>

    <div v-if="paginationEnabled" class="pro-table__pagination">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :background="paginationBackground"
        :small="paginationSmall"
        :layout="paginationLayout"
        :total="total"
        :page-sizes="pageSizes"
        :hide-on-single-page="hidePaginationOnSinglePage"
        :pager-count="paginationPagerCount"
        @current-change="handlePageChange"
        @size-change="handleSizeChange"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.pro-table {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.pro-table__toolbar {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
}

.pro-table__search {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
  margin: 0;
}

.pro-table__search-item,
.pro-table__search-actions {
  margin-right: 0;
  margin-bottom: 0;
}

.pro-table__field {
  width: 220px;
}

.pro-table__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.pro-table__column-setting {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pro-table__column-setting-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.pro-table__column-setting-title {
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  color: var(--el-text-color-primary);
}

.pro-table__column-setting-summary {
  margin-top: 2px;
  font-size: 12px;
  line-height: 18px;
  color: var(--el-text-color-secondary);
}

.pro-table__column-setting-reset {
  flex: none;
}

.pro-table__column-setting-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 320px;
  overflow-y: auto;
}

.pro-table__column-setting-option {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
  padding: 5px 8px 5px 4px;
  border: 1px solid transparent;
  border-radius: var(--el-border-radius-base);
}

.pro-table__column-setting-option:hover {
  background: var(--el-fill-color-light);
}

.pro-table__column-setting-option.is-dragging {
  opacity: 0.45;
}

.pro-table__column-setting-option.is-drag-over {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-9);
}

.pro-table__column-drag-handle {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  color: var(--el-text-color-secondary);
  cursor: grab;
  background: var(--el-fill-color-lighter);
  border: 0;
  border-radius: var(--el-border-radius-small);
}

.pro-table__column-drag-icon {
  font-size: 16px;
  pointer-events: none;
}

.pro-table__column-drag-handle:hover {
  color: var(--el-color-primary);
  background: var(--el-fill-color);
}

.pro-table__column-drag-handle:active {
  cursor: grabbing;
}

.pro-table__column-drag-handle:focus-visible {
  outline: 2px solid var(--el-color-primary-light-5);
  outline-offset: 1px;
}

.pro-table__column-setting-checkbox {
  flex: 1;
  min-width: 0;
  margin-right: 0;
}

.pro-table__column-setting-checkbox :deep(.el-checkbox__label) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pro-table__column-setting-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.pro-table__table {
  width: 100%;
  background: var(--el-bg-color);
}

.pro-table__table-wrap {
  position: relative;
}

.pro-table__loading {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-bg-color) 72%, transparent);
}

.pro-table__pagination {
  display: flex;
  justify-content: flex-end;
  overflow-x: auto;
}

@media (width <= 768px) {
  .pro-table__toolbar,
  .pro-table__search {
    align-items: stretch;
  }

  .pro-table__search,
  .pro-table__search-item,
  .pro-table__field {
    width: 100%;
  }

  .pro-table__actions {
    width: 100%;
  }

  .pro-table__pagination {
    justify-content: flex-start;
  }
}
</style>
