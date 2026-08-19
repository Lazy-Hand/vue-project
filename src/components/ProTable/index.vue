<script setup lang="ts" generic="T extends object = ProTableRow">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  shallowRef,
  useSlots,
  watch,
} from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Alert,
  Button,
  Checkbox,
  CheckboxGroup,
  Col,
  Dropdown,
  Empty,
  Form,
  FormItem,
  Input,
  Pagination,
  Popover,
  Row,
  Select,
  Spin,
  Switch,
  Table,
  Tag,
  Space,
  type TableColumnType,
  type TableColumnsType,
  type TablePaginationConfig,
  type TableRowSelection,
  type TableSorterResult,
} from 'antdv-next'
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  ColumnHeightOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  HolderOutlined,
  ProfileOutlined,
  ReloadOutlined,
  SettingOutlined,
} from '@antdv-next/icons'

import DictSelect from '@/components/DictSelect/index.vue'
import DictTag from '@/components/DictTag/index.vue'
import { pinia } from '@/stores'
import { useDictStore } from '@/stores/dict'
import type {
  ProTableColumn,
  ProTableColumnFilter,
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
  showRefresh?: boolean
  showDensity?: boolean
  showFullscreen?: boolean
  showSettings?: boolean
  searchCollapsible?: boolean
  searchCollapseThreshold?: number
  defaultSearchCollapsed?: boolean
  /** 搜索区每行字段列数（24 栅格），默认 4 */
  searchColumnCount?: number
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
  showRefresh: true,
  showDensity: true,
  showFullscreen: true,
  showSettings: true,
  searchCollapsible: true,
  searchCollapseThreshold: 3,
  defaultSearchCollapsed: true,
  searchColumnCount: 4,
  showRequestError: true,
  emptyText: undefined,
  emptyCellText: '-',
})

const emit = defineEmits<{
  'row-click': [row: T, column: TableColumnType<T> | null, event: PointerEvent]
  'selection-change': [rows: T[]]
  'sort-change': [sort: ProTableSortState]
  'search-collapse-change': [collapsed: boolean]
  'column-visibility-change': [visibleKeys: string[]]
  'column-order-change': [orderedKeys: string[]]
  'request-success': [result: ProTableRequestData<T>, params: ProTableRequestParams]
  'request-error': [error: unknown, params: ProTableRequestParams]
}>()

const { t } = useI18n()
const slots = useSlots()
const dictStore = useDictStore(pinia)

const dictFilterCodes = computed(() =>
  Array.from(
    new Set(
      props.columns
        .filter((column) => column.filters === 'dict' && column.dictTypeCode)
        .map((column) => column.dictTypeCode as string),
    ),
  ),
)

const loading = ref(false)
const requestFailed = ref(false)
const lastRequestError = shallowRef<unknown>()
const searchCollapsed = ref(props.defaultSearchCollapsed)
const tableData = shallowRef<T[]>([])
const selectedRows = shallowRef<T[]>([])
const selectedRowKeys = ref<Array<string | number>>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const sortField = ref<string>()
const sortOrder = ref<'asc' | 'desc'>()
const searchForm = reactive<Record<string, ProTableSearchValue>>({})
const columnFilters = ref<Record<string, Array<string | number | boolean>>>({})
const dataFilterOptions = ref<Record<string, ProTableColumnFilter[]>>({})
const columnVisibility = reactive<Record<string, boolean>>({})
const columnOrder = ref<string[]>([])
const columnSettingVisible = ref(false)
const draftColumnOrder = ref<string[]>([])
const draftVisibleColumnKeys = ref<string[]>([])
const draggedColumnKey = ref<string>()
const dragOverColumnKey = ref<string>()
const expandedRowKeys = ref<Array<string | number>>([])
const expandedRowsControlled = ref(false)

const tableSize = ref<'large' | 'middle' | 'small'>('small')
const isFullscreen = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const tableWrapRef = ref<HTMLElement | null>(null)
const tableScrollY = ref<number>()
const tableSettingsVisible = ref(false)
const tableBorder = ref(props.border)
const tableStripe = ref(props.stripe)
const showHeaderBackground = ref(true)

const columnSourceHidden: Record<string, boolean> = {}

let requestSequence = 0
let lastRawItems: T[] = []
let lastRawIsArray = false
let lastRawTotal = 0

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
const showToolbar = computed(
  () =>
    Boolean(slots['toolbar-actions']) ||
    columnSettingAvailable.value ||
    props.showRefresh ||
    props.showDensity ||
    props.showFullscreen ||
    props.showSettings,
)
const visibleColumns = computed(() => {
  const columnMap = new Map(
    props.columns.map((column, index) => [columnKey(column, index), column] as const),
  )
  return normalizeColumnOrder(columnOrder.value)
    .filter((key) => columnVisibility[key])
    .map((key) => columnMap.get(key))
    .filter((column): column is ProTableColumn<T> => column !== undefined)
})
const tableColumns = computed<TableColumnsType<T>>(() =>
  visibleColumns.value
    .filter((column) => column.type !== 'selection')
    .map((column) => {
      const key = resolvedColumnKey(column)
      const tableColumn: TableColumnType<T> = {
        key,
        title: column.label,
        dataIndex: column.prop?.split('.'),
        width: column.width,
        minWidth: typeof column.minWidth === 'number' ? column.minWidth : undefined,
        fixed: column.fixed,
        align: column.align,
        className: column.className,
        ellipsis: column.showOverflowTooltip,
        sorter:
          column.sortable === 'custom'
            ? true
            : column.sortable === true
              ? (left: T, right: T) => {
                  const leftValue = getCellValue(left, column.prop)
                  const rightValue = getCellValue(right, column.prop)
                  if (leftValue === rightValue) return 0
                  if (leftValue === null || leftValue === undefined) return -1
                  if (rightValue === null || rightValue === undefined) return 1
                  return String(leftValue).localeCompare(String(rightValue), undefined, {
                    numeric: true,
                  })
                }
              : false,
        ...(column.sortable === 'custom' && sortField.value === column.prop
          ? { sortOrder: sortOrder.value === 'asc' ? 'ascend' : 'descend' }
          : {}),
        sortDirections: column.sortOrders?.map((order) =>
          order === 'ascending' ? 'ascend' : order === 'descending' ? 'descend' : null,
        ),
        filters: column.filters
          ? toAntdFilterItems(resolveColumnFilterOptions(column, key))
          : undefined,
        filterMultiple: column.filters ? (column.filterMultiple ?? true) : undefined,
        filteredValue: column.filters ? (columnFilters.value[key] ?? null) : undefined,
      }
      if (column.type === 'index') {
        tableColumn.width = column.width ?? 70
        tableColumn.align = column.align ?? 'center'
      }
      return tableColumn
    }),
)
const selectionColumn = computed(() =>
  visibleColumns.value.find((column) => column.type === 'selection'),
)
const tableRowSelection = computed<TableRowSelection<T> | undefined>(() => {
  const column = selectionColumn.value
  if (!column) return undefined
  return {
    selectedRowKeys: selectedRowKeys.value,
    preserveSelectedRowKeys: column.reserveSelection,
    onChange: (keys, rows) => {
      selectedRowKeys.value = [...keys]
      onSelectionChange(rows)
    },
    getCheckboxProps: (row) => {
      const index = tableData.value.indexOf(row)
      return {
        disabled: column.selectable ? !column.selectable(row, index) : false,
      }
    },
  }
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
/** 搜索区每行字段列数对应的 24 栅格 span（列数须整除 24：2/3/4/6/8/12） */
const fieldSpan = computed(() => Math.floor(24 / Math.max(1, Math.floor(props.searchColumnCount))))
const paginationEnabled = computed(() => props.pagination !== false)
const resolvedEmptyText = computed(() => props.emptyText ?? t('proTable.empty'))

const paginationConfig = computed<ProTablePaginationConfig>(() => {
  if (props.pagination === false || props.pagination === true) return {}
  return props.pagination
})
const pageSizes = computed(() => paginationConfig.value.pageSizes ?? [10, 20, 50])
const hidePaginationOnSinglePage = computed(() => paginationConfig.value.hideOnSinglePage ?? false)

function cloneSearchValue(value: ProTableSearchValue | undefined): ProTableSearchValue {
  if (Array.isArray(value)) return [...value]
  return value ?? null
}

function initSearchForm(): void {
  for (const key of Object.keys(searchForm)) delete searchForm[key]
  for (const field of props.searchFields)
    searchForm[field.prop] = cloneSearchValue(field.defaultValue)
}

function isEmptySearchValue(value: ProTableSearchValue): boolean {
  return value === null || value === '' || (Array.isArray(value) && value.length === 0)
}

function buildRequestParams(): ProTableRequestParams {
  const params: ProTableRequestParams = { page: page.value, pageSize: pageSize.value }
  for (const field of props.searchFields) {
    const value = searchForm[field.prop] ?? null
    if (isEmptySearchValue(value)) continue
    params[field.prop] = field.transform ? field.transform(value) : value
  }
  for (const column of visibleColumns.value) {
    if (!column.filters || column.filterMode !== 'custom') continue
    const values = columnFilters.value[resolvedColumnKey(column)] ?? []
    if (!values.length) continue
    params[column.prop ?? resolvedColumnKey(column)] = values.length === 1 ? values[0] : values
  }
  if (sortField.value && sortOrder.value) {
    params.sortField = sortField.value
    params.sortOrder = sortOrder.value
  }
  return params
}

function normalizeResult(result: ProTableRequestResult<T>): ProTableRequestData<T> {
  if (Array.isArray(result)) return { items: result, total: result.length }
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
    syncDataFilterOptions(items)
    const filteredItems = applyColumnFilters(items)
    const nextResult = {
      items: filteredItems,
      total: Array.isArray(rawResult) ? filteredItems.length : result.total,
    }
    lastRawItems = result.items
    lastRawIsArray = Array.isArray(rawResult)
    lastRawTotal = result.total
    tableData.value = nextResult.items
    total.value = nextResult.total
    if (props.defaultExpandAll && !expandedRowsControlled.value) {
      const keys: Array<string | number> = []
      visitChildren(tableData.value, props.treeProps?.children ?? 'children', (row) => {
        keys.push(getRowKeyValue(row))
      })
      expandedRowKeys.value = keys
    }
    emit('request-success', nextResult, params)
  } catch (error) {
    if (sequence !== requestSequence) return
    emit('request-error', error, params)
    requestFailed.value = true
    lastRequestError.value = error
  } finally {
    if (sequence === requestSequence) loading.value = false
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

function handleSizeChange(_current: number, size: number): void {
  pageSize.value = size
  page.value = 1
  void loadData()
}

function shouldSearchOnChange(field: ProTableSearchField): boolean {
  if (field.searchOnChange !== undefined) return field.searchOnChange
  return field.type === 'select' || field.type === 'dict-select'
}

function handleFieldChange(field: ProTableSearchField): void {
  if (shouldSearchOnChange(field)) void handleSearch()
}

function handleInputClear(field: ProTableSearchField): void {
  if (field.searchOnChange !== false) void handleSearch()
}

function setSearchCollapsed(collapsed: boolean): void {
  if (searchCollapsed.value === collapsed) return
  searchCollapsed.value = collapsed
  emit('search-collapse-change', collapsed)
}

function toggleSearchCollapse(): void {
  setSearchCollapsed(!searchCollapsed.value)
}

const densityMenuItems = computed(() =>
  (
    [
      ['large', t('proTable.densityDefault')],
      ['middle', t('proTable.densityMiddle')],
      ['small', t('proTable.densityCompact')],
    ] as const
  ).map(([key, label]) => ({ key, label })),
)

function handleDensityChange(info: { key: string | number }): void {
  const key = String(info.key)
  if (key === 'large' || key === 'middle' || key === 'small') tableSize.value = key
}

function toggleFullscreen(): void {
  const element = rootRef.value
  if (!element || typeof element.requestFullscreen !== 'function') return
  if (document.fullscreenElement === element) {
    void document.exitFullscreen()
    return
  }
  void element.requestFullscreen()
}

function handleFullscreenChange(): void {
  isFullscreen.value = document.fullscreenElement === rootRef.value
}

/** 表格容器垂直内边距（上 8px + 下 16px），计算滚动高度时扣除 */
const TABLE_WRAP_PADDING_Y = 24

function measureTableScrollY(): void {
  const wrap = tableWrapRef.value
  if (!wrap) return
  tableScrollY.value = Math.max(0, wrap.clientHeight - TABLE_WRAP_PADDING_Y)
}

function setSearchValue(prop: string, value: ProTableSearchValue): void {
  searchForm[prop] = value
}

function setInputValue(prop: string, value: string): void {
  setSearchValue(prop, value)
}

function selectOptions(field: ProTableSearchField) {
  return (field.options ?? []).map((option, index) => ({
    label: option.label,
    value: index,
    disabled: option.disabled,
  }))
}

function setSelectValue(field: ProTableSearchField, value: unknown): void {
  if (value === null || value === undefined) {
    setSearchValue(field.prop, null)
    return
  }

  const options = field.options ?? []
  if (typeof value === 'number') {
    setSearchValue(field.prop, options[value]?.value ?? null)
    return
  }

  if (Array.isArray(value) && value.every((item): item is number => typeof item === 'number')) {
    const selected = value
      .map((index) => options[index]?.value)
      .filter(
        (item): item is string | number => typeof item === 'string' || typeof item === 'number',
      )
    setSearchValue(field.prop, selected)
    return
  }

  setSearchValue(field.prop, null)
}

function inputValue(prop: string): string | number | null {
  const value = searchForm[prop]
  if (typeof value === 'string' || typeof value === 'number') return value
  if (typeof value === 'boolean') return String(value)
  return null
}

function selectValue(field: ProTableSearchField): number | number[] | undefined {
  const current = searchForm[field.prop]
  const options = field.options ?? []

  if (Array.isArray(current)) {
    return current
      .map((value) => options.findIndex((option) => Object.is(option.value, value)))
      .filter((index) => index >= 0)
  }

  if (typeof current === 'string' || typeof current === 'number' || typeof current === 'boolean') {
    const index = options.findIndex((option) => Object.is(option.value, current))
    return index >= 0 ? index : undefined
  }

  return undefined
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
    if (Object.hasOwn(params, field.prop))
      searchForm[field.prop] = cloneSearchValue(params[field.prop])
  }
  if (submit) await handleSearch()
}

function getCellValue(row: T, prop?: string): unknown {
  if (!prop) return undefined
  return prop.split('.').reduce<unknown>(
    (acc, key) => {
      if (acc && typeof acc === 'object' && key in acc) return (acc as ProTableRow)[key]
      return undefined
    },
    row as Record<string, unknown>,
  )
}

function formatCell(row: T, column: ProTableColumn<T>, index: number): string | number {
  const value = getCellValue(row, column.prop)
  if (column.formatter) return column.formatter(row, column, value, index)
  if (value === null || value === undefined || value === '') return props.emptyCellText
  return String(value)
}

function indexValue(column: ProTableColumn<T>, index: number): number {
  return typeof column.index === 'function' ? column.index(index) : (column.index ?? index + 1)
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

function tagColor(row: T, column: ProTableColumn<T>): string | undefined {
  const value = getCellValue(row, column.prop)
  if (typeof value === 'boolean') return value ? 'green' : 'blue'
  if (column.tagTypeMap && value !== null && value !== undefined) {
    const color = column.tagTypeMap[String(value)]
    if (color === 'success') return 'green'
    if (color === 'info') return 'default'
    if (color === 'warning') return 'orange'
    if (color === 'danger') return 'error'
    if (color === 'primary') return 'processing'
  }
  return undefined
}

function dictValue(row: T, prop?: string): string | number | boolean | null {
  const value = getCellValue(row, prop)
  if (value === null || value === undefined) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    return value
  return String(value)
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
  for (const key of orderedKeys) columnVisibility[key] = visibleKeys.has(key)
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
  if (sourceKey && sourceKey !== targetKey && !dragOverColumnKey.value)
    reorderDraftColumn(sourceKey, targetKey)
  handleColumnDragEnd()
}

function handleColumnDragEnd(): void {
  draggedColumnKey.value = undefined
  dragOverColumnKey.value = undefined
}

function onRowClick(row: T, event: MouseEvent): void {
  emit('row-click', row, null, event as unknown as PointerEvent)
}

function getRowProps(record: T): { onClick: (event: MouseEvent) => void } {
  return { onClick: (event) => onRowClick(record, event) }
}

function getRowClassName(record: T): string {
  if (!props.highlightCurrentRow || props.currentRowKey === undefined) return ''
  return String(getRowKeyValue(record)) === String(props.currentRowKey)
    ? 'pro-table__current-row'
    : ''
}

function onSelectionChange(rows: T[]): void {
  selectedRows.value = [...rows]
  emit('selection-change', [...rows])
}

function getRowKeyValue(row: T): string | number {
  const value = getCellValue(row, props.rowKey)
  return typeof value === 'string' || typeof value === 'number' ? value : String(value ?? '')
}

function clearSelection(): void {
  selectedRowKeys.value = []
  onSelectionChange([])
}

function toggleRowSelection(row: T, selected?: boolean): void {
  const key = getRowKeyValue(row)
  const keyString = String(key)
  const current = new Set(selectedRowKeys.value.map(String))
  const shouldSelect = selected ?? !current.has(keyString)
  if (shouldSelect) current.add(keyString)
  else current.delete(keyString)
  selectedRowKeys.value = tableData.value
    .map((item) => getRowKeyValue(item))
    .filter((item) => current.has(String(item)))
  const rows = tableData.value.filter((item) => current.has(String(getRowKeyValue(item))))
  onSelectionChange(rows)
}

function visitChildren(rows: T[], childrenKey: string, callback: (row: T) => void): void {
  for (const row of rows) {
    callback(row)
    const children = (row as Record<string, unknown>)[childrenKey]
    if (Array.isArray(children)) visitChildren(children as T[], childrenKey, callback)
  }
}

function setAllRowsExpanded(expanded: boolean): void {
  expandedRowsControlled.value = true
  const keys: Array<string | number> = []
  if (expanded) {
    visitChildren(tableData.value, props.treeProps?.children ?? 'children', (row) => {
      keys.push(getRowKeyValue(row))
    })
  }
  expandedRowKeys.value = keys
}

function handleExpandedRowsChange(keys: readonly (string | number)[]): void {
  expandedRowsControlled.value = true
  expandedRowKeys.value = [...keys]
}

function tableColumnConfig(key: string | number | undefined): ProTableColumn<T> | undefined {
  if (key === undefined) return undefined
  return visibleColumns.value.find((column) => resolvedColumnKey(column) === String(key))
}

function onTableChange(
  _pagination: TablePaginationConfig,
  filters: Record<string, unknown>,
  sorter: TableSorterResult<T> | TableSorterResult<T>[],
): void {
  const currentSorter = Array.isArray(sorter) ? sorter[0] : sorter
  const propValue = currentSorter?.field ?? currentSorter?.columnKey
  const prop = typeof propValue === 'string' ? propValue : null
  const order =
    currentSorter?.order === 'ascend'
      ? 'ascending'
      : currentSorter?.order === 'descend'
        ? 'descending'
        : null
  onSortChange({ prop, order })
  handleFilterChange(filters)
}

function toAntdFilterItems(
  filters: ProTableColumnFilter[],
): NonNullable<TableColumnType<T>['filters']> {
  return filters.map((filter) => ({
    text: filter.label,
    value: filter.value,
    children: filter.children ? toAntdFilterItems(filter.children) : undefined,
  }))
}

function sameFilterValues(
  left: Array<string | number | boolean> | undefined,
  right: Array<string | number | boolean>,
): boolean {
  if ((left?.length ?? 0) !== right.length) return false
  return (left ?? []).every((value, index) => value === right[index])
}

function resolveColumnFilterOptions(
  column: ProTableColumn<T>,
  key: string,
): ProTableColumnFilter[] {
  if (Array.isArray(column.filters)) return column.filters
  if (column.filters === true) return dataFilterOptions.value[key] ?? []
  if (column.filters === 'dict' && column.dictTypeCode) {
    return dictStore.getOptions(column.dictTypeCode).map((item) => ({
      label: item.label,
      value: item.value,
    }))
  }
  return []
}

function handleFilterChange(filters: Record<string, unknown>): void {
  let hasCustomChange = false
  let hasLocalChange = false

  for (const column of visibleColumns.value) {
    if (!resolveColumnFilterOptions(column, resolvedColumnKey(column)).length) continue
    const key = resolvedColumnKey(column)
    const rawValue = filters[key]
    const nextValue = Array.isArray(rawValue)
      ? rawValue.filter(
          (item): item is string | number | boolean =>
            typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean',
        )
      : []
    if (sameFilterValues(columnFilters.value[key], nextValue)) continue
    columnFilters.value[key] = nextValue
    if (column.filterMode === 'custom') hasCustomChange = true
    else hasLocalChange = true
  }

  if (hasCustomChange) {
    page.value = 1
    void loadData()
  } else if (hasLocalChange) {
    applyLocalFilter()
  }
}

function applyColumnFilters(items: T[]): T[] {
  const filterColumns = visibleColumns.value.filter(
    (column) =>
      column.prop && resolveColumnFilterOptions(column, resolvedColumnKey(column)).length > 0,
  )
  if (!filterColumns.length) return items
  return items.filter((row) =>
    filterColumns.every((column) => {
      const values = columnFilters.value[resolvedColumnKey(column)] ?? []
      if (!values.length) return true
      const cellValue = getCellValue(row, column.prop)
      if (column.dictTypeCode) {
        const normalized = normalizeFilterValue(cellValue)
        return values.some((value) => normalized === String(value))
      }
      return values.some((value) => cellValue === value)
    }),
  )
}

function normalizeFilterValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? '1' : '0'
  return String(value)
}

function syncDataFilterOptions(items: T[]): void {
  for (const column of props.columns) {
    if (column.filters !== true || !column.prop) continue
    const key = resolvedColumnKey(column)
    const seen = new Set<string>()
    const options: ProTableColumnFilter[] = []
    for (const row of items) {
      const value = getCellValue(row, column.prop)
      if (value === null || value === undefined || typeof value === 'object') continue
      const label = String(value)
      if (seen.has(label)) continue
      seen.add(label)
      options.push({ label, value: value as string | number | boolean })
    }
    dataFilterOptions.value[key] = options
  }
}

function applyLocalFilter(): void {
  const items = props.clientFilter
    ? props.clientFilter(lastRawItems, buildRequestParams())
    : lastRawItems
  const filteredItems = applyColumnFilters(items)
  tableData.value = filteredItems
  total.value = lastRawIsArray ? filteredItems.length : lastRawTotal
}

function onSortChange(change: TableSortChange): void {
  const state: ProTableSortState = { prop: change.prop ?? null, order: change.order ?? null }
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

const tableExpandable = computed(() => ({
  defaultExpandAllRows: props.defaultExpandAll,
  childrenColumnName: props.treeProps?.children ?? 'children',
  expandedRowKeys:
    expandedRowsControlled.value || props.defaultExpandAll ? expandedRowKeys.value : undefined,
  onExpandedRowsChange: handleExpandedRowsChange,
}))

const tableScroll = computed(() => {
  const fixed = props.maxHeight ?? props.height
  return { y: fixed ?? tableScrollY.value }
})

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
  if (visible) initColumnSettingDraft()
  else handleColumnDragEnd()
})

watch(
  () => props.searchFields,
  () => initSearchForm(),
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

watch(
  () => props.border,
  (border) => {
    tableBorder.value = border
  },
)

watch(
  () => props.stripe,
  (stripe) => {
    tableStripe.value = stripe
  },
)

let tableResizeObserver: ResizeObserver | undefined

onMounted(() => {
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  if (typeof ResizeObserver !== 'undefined') {
    tableResizeObserver = new ResizeObserver(measureTableScrollY)
    if (tableWrapRef.value) tableResizeObserver.observe(tableWrapRef.value)
  }
  if (props.immediate) void loadData()
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  tableResizeObserver?.disconnect()
})

watch(
  dictFilterCodes,
  (codes) => {
    if (codes.length) void dictStore.loadMany(codes)
  },
  { immediate: true },
)

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
  <div ref="rootRef" class="pro-table">
    <div v-if="searchFields.length" class="pro-table__search-card">
      <Form
        layout="inline"
        :model="searchForm"
        class="pro-table__search"
        @submit.prevent="handleSearch"
      >
        <Row :gutter="[16, 16]" class="pro-table__search-row">
          <Col
            v-for="field in visibleSearchFields"
            :key="field.prop"
            :xs="12"
            :md="8"
            :lg="fieldSpan"
            class="pro-table__search-col"
          >
            <FormItem :name="field.prop" :label="field.label" class="pro-table__search-item">
              <Input
                v-if="(field.type ?? 'input') === 'input'"
                :value="inputValue(field.prop) ?? undefined"
                :allow-clear="field.clearable ?? true"
                :class="['pro-table__field', field.fieldClass]"
                :placeholder="field.placeholder"
                @update:value="setInputValue(field.prop, $event)"
                @keyup.enter="handleSearch"
                @clear="handleInputClear(field)"
              />
              <Select
                v-else-if="field.type === 'select'"
                :value="selectValue(field)"
                :allow-clear="field.clearable ?? true"
                :mode="field.multiple ? 'multiple' : undefined"
                :class="['pro-table__field', field.fieldClass]"
                :options="selectOptions(field)"
                :placeholder="field.placeholder"
                @update:value="setSelectValue(field, $event)"
                @change="handleFieldChange(field)"
              />
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
            </FormItem>
          </Col>

          <Col
            v-if="showSearchActions || searchCanCollapse"
            :flex="'auto'"
            class="pro-table__search-col pro-table__search-col--actions"
          >
            <FormItem
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
                <Space>
                  <Button type="primary" :loading="loading" @click="handleSearch">
                    {{ t('proTable.search') }}
                  </Button>
                  <Button :disabled="loading" @click="handleReset">{{
                    t('proTable.reset')
                  }}</Button>
                </Space>
              </slot>
              <Button
                v-if="searchCanCollapse"
                class="pro-table__collapse-button"
                type="link"
                @click="toggleSearchCollapse"
              >
                {{ searchCollapsed ? t('proTable.expand') : t('proTable.collapse') }}
                <ArrowDownOutlined v-if="searchCollapsed" />
                <ArrowUpOutlined v-else />
              </Button>
            </FormItem>
          </Col>
        </Row>
      </Form>
    </div>

    <div class="pro-table__body-card">
      <div v-if="showToolbar" class="pro-table__toolbar">
        <div v-if="$slots['toolbar-actions']" class="pro-table__toolbar-left">
          <slot name="toolbar-actions" />
        </div>
        <div class="pro-table__toolbar-spacer" />
        <div class="pro-table__toolbar-right">
          <Button
            v-if="showRefresh"
            class="pro-table__tool-btn"
            :title="t('proTable.refresh')"
            :aria-label="t('proTable.refresh')"
            :loading="loading"
            @click="loadData"
          >
            <ReloadOutlined />
          </Button>
          <Dropdown
            v-if="showDensity"
            :menu="{
              items: densityMenuItems,
              selectedKeys: [tableSize],
            }"
            :trigger="['click']"
            placement="bottomRight"
            @menu-click="handleDensityChange"
          >
            <Button
              class="pro-table__tool-btn"
              :title="t('proTable.density')"
              :aria-label="t('proTable.density')"
            >
              <ColumnHeightOutlined />
            </Button>
          </Dropdown>
          <Button
            v-if="showFullscreen"
            class="pro-table__tool-btn"
            :title="t(isFullscreen ? 'proTable.fullscreenExit' : 'proTable.fullscreen')"
            :aria-label="t(isFullscreen ? 'proTable.fullscreenExit' : 'proTable.fullscreen')"
            @click="toggleFullscreen"
          >
            <FullscreenExitOutlined v-if="isFullscreen" />
            <FullscreenOutlined v-else />
          </Button>
          <Popover
            v-if="columnSettingAvailable"
            v-model:open="columnSettingVisible"
            placement="bottomRight"
            :classes="{ root: 'pro-table__column-setting-popover' }"
            trigger="click"
          >
            <Button
              class="pro-table__tool-btn"
              :title="t('proTable.columnSetting')"
              :aria-label="t('proTable.columnSetting')"
            >
              <ProfileOutlined />
            </Button>

            <template #content>
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

                <CheckboxGroup
                  v-model:value="selectedDraftColumnKeys"
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
                      <HolderOutlined class="pro-table__column-drag-icon" />
                    </button>
                    <Checkbox
                      :value="item.key"
                      :disabled="item.visible && draftVisibleColumnCount === 1"
                      class="pro-table__column-setting-checkbox"
                    >
                      {{ item.label }}
                    </Checkbox>
                  </div>
                </CheckboxGroup>

                <div class="pro-table__column-setting-footer">
                  <Button class="pro-table__column-setting-reset" @click="resetColumnSettings">
                    {{ t('proTable.resetColumns') }}
                  </Button>
                  <Button
                    type="primary"
                    class="pro-table__column-setting-save"
                    @click="saveColumnSettings"
                  >
                    {{ t('proTable.saveColumns') }}
                  </Button>
                </div>
              </div>
            </template>
          </Popover>
          <Popover
            v-if="showSettings"
            v-model:open="tableSettingsVisible"
            placement="bottomRight"
            :classes="{ root: 'pro-table__settings-popover' }"
            trigger="click"
          >
            <Button
              class="pro-table__tool-btn"
              :title="t('proTable.settings')"
              :aria-label="t('proTable.settings')"
            >
              <SettingOutlined />
            </Button>

            <template #content>
              <div class="pro-table__settings">
                <div class="pro-table__settings-title">{{ t('proTable.settings') }}</div>
                <div class="pro-table__settings-item">
                  <span>{{ t('proTable.settingsStripe') }}</span>
                  <Switch v-model:checked="tableStripe" size="small" />
                </div>
                <div class="pro-table__settings-item">
                  <span>{{ t('proTable.settingsBorder') }}</span>
                  <Switch v-model:checked="tableBorder" size="small" />
                </div>
                <div class="pro-table__settings-item">
                  <span>{{ t('proTable.settingsHeaderBackground') }}</span>
                  <Switch v-model:checked="showHeaderBackground" size="small" />
                </div>
              </div>
            </template>
          </Popover>
        </div>
      </div>

      <slot
        v-if="requestFailed && showRequestError"
        name="request-error"
        :error="lastRequestError"
        :retry="loadData"
      >
        <Alert :message="t('proTable.requestFailed')" type="error" show-icon />
      </slot>

      <div ref="tableWrapRef" class="pro-table__table-wrap" :aria-busy="loading">
        <Spin :spinning="loading">
          <Table
            :data-source="tableData"
            :columns="tableColumns"
            :row-key="rowKey"
            :bordered="tableBorder"
            :show-header="showHeader"
            :row-selection="tableRowSelection"
            :scroll="tableScroll"
            :expandable="tableExpandable"
            :pagination="false"
            :size="tableSize"
            :class="[
              'pro-table__table',
              {
                'pro-table__table--stripe': tableStripe,
                'pro-table__table--no-header-bg': !showHeaderBackground,
              },
            ]"
            :row-class-name="getRowClassName"
            @change="onTableChange"
            :on-row="getRowProps"
          >
            <template #headerCell="{ column: tableColumn, index }">
              <slot
                v-if="tableColumnConfig(tableColumn.key)?.headerSlot"
                :name="`header-${tableColumnConfig(tableColumn.key)?.headerSlot}`"
                :column="tableColumn"
                :index="index"
                :config="tableColumnConfig(tableColumn.key)"
              />
              <span v-else>
                <template v-if="typeof tableColumn.title === 'string'">
                  {{ tableColumn.title }}
                </template>
                <component :is="tableColumn.title" v-else />
              </span>
            </template>
            <template #bodyCell="{ column: tableColumn, record, index }">
              <template v-if="tableColumnConfig(tableColumn.key)">
                <slot
                  v-if="
                    tableColumnConfig(tableColumn.key)?.type === 'slot' &&
                    tableColumnConfig(tableColumn.key)?.slot
                  "
                  :name="`column-${tableColumnConfig(tableColumn.key)?.slot}`"
                  :row="record"
                  :index="index"
                  :column="tableColumnConfig(tableColumn.key)"
                />
                <DictTag
                  v-else-if="
                    tableColumnConfig(tableColumn.key)?.type === 'dict' &&
                    tableColumnConfig(tableColumn.key)?.dictTypeCode
                  "
                  :type-code="tableColumnConfig(tableColumn.key)?.dictTypeCode ?? ''"
                  :value="dictValue(record, tableColumnConfig(tableColumn.key)?.prop)"
                  :tag-type-map="tableColumnConfig(tableColumn.key)?.tagTypeMap"
                />
                <Tag
                  v-else-if="tableColumnConfig(tableColumn.key)?.type === 'tag'"
                  :color="tagColor(record, tableColumnConfig(tableColumn.key)!)"
                >
                  {{ tagLabel(record, tableColumnConfig(tableColumn.key)!, index) }}
                </Tag>
                <span v-else-if="tableColumnConfig(tableColumn.key)?.type === 'index'">
                  {{ indexValue(tableColumnConfig(tableColumn.key)!, index) }}
                </span>
                <span v-else>{{
                  formatCell(record, tableColumnConfig(tableColumn.key)!, index)
                }}</span>
              </template>
            </template>
            <template #emptyText>
              <slot name="empty"><Empty :description="resolvedEmptyText" /></slot>
            </template>
          </Table>
        </Spin>

        <div v-if="$slots.append" class="pro-table__append">
          <slot name="append" />
        </div>
      </div>

      <div v-if="paginationEnabled" class="pro-table__pagination">
        <Pagination
          v-model:current="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-size-options="pageSizes"
          :show-size-changer="pageSizes.length > 1"
          :hide-on-single-page="hidePaginationOnSinglePage"
          size="small"
          @change="handlePageChange"
          @show-size-change="handleSizeChange"
        >
          <template #showTotal="{ total: count }">{{ count }}</template>
        </Pagination>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.pro-table {
  /* 撑满父级剩余高度，表格内部滚动（由父级高度链路配合） */
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.pro-table__search-card {
  margin-bottom: 16px;
  padding: 20px;
  background: #fff;
  border-radius: 8px;
  box-shadow:
    0 1px 2px rgb(0 0 0 / 4%),
    0 4px 12px rgb(0 0 0 / 4%);
}

.pro-table__body-card {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  background: #fff;
  border-radius: 8px;
  box-shadow:
    0 1px 2px rgb(0 0 0 / 4%),
    0 4px 12px rgb(0 0 0 / 4%);
  overflow: hidden;
}

.pro-table:fullscreen {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  padding: 16px;
  background: var(--app-fill-color);
  overflow: auto;
}

.pro-table:fullscreen .pro-table__search-card {
  margin-bottom: 0;
}

.pro-table__search {
  margin: 0;
}

.pro-table__search-row {
  width: 100%;
}

.pro-table__search-col {
  min-width: 0;
}

/* 栅格列内 FormItem 撑满列宽，label 固定宽度右对齐，保证各查询控件起点一致 */
.pro-table__search-item {
  display: flex;
  width: 100%;
  margin-right: 0;
  margin-bottom: 0;

  :deep(.ant-form-item-row) {
    width: 100%;
  }

  :deep(.ant-form-item-label) {
    flex: none;
    width: 88px;
    padding-right: 8px;
    overflow: hidden;
    text-align: right;
    white-space: nowrap;
  }

  :deep(.ant-form-item-label label) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :deep(.ant-form-item-control) {
    flex: 1;
    min-width: 0;
  }
}

.pro-table__field {
  width: 100%;
}

/* 查询/重置按钮列：占满剩余栅格宽度并靠右 */
.pro-table__search-col--actions .pro-table__search-actions {
  display: flex;
  justify-content: flex-end;
  width: 100%;
  margin-right: 0;
  margin-bottom: 0;
}

.pro-table__toolbar {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--app-border-color-lighter);
}

.pro-table__toolbar-left {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.pro-table__toolbar-spacer {
  flex: 1;
}

.pro-table__toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pro-table__tool-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  color: var(--app-text-color-secondary);
}

.pro-table__tool-btn:hover {
  color: var(--app-color-primary);
}

.pro-table__column-setting {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 280px;
}

.pro-table__column-setting-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--app-border-color-lighter);
}

.pro-table__column-setting-title {
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  color: var(--app-text-color-primary);
}

.pro-table__column-setting-summary {
  margin-top: 2px;
  font-size: 12px;
  line-height: 18px;
  color: var(--app-text-color-secondary);
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
  border-radius: 6px;
}

.pro-table__column-setting-option:hover {
  background: var(--app-fill-color-light);
}

.pro-table__column-setting-option.is-dragging {
  opacity: 0.45;
}

.pro-table__column-setting-option.is-drag-over {
  border-color: var(--app-color-primary-light-5);
  background: var(--app-color-primary-light-9);
}

.pro-table__column-drag-handle {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  color: var(--app-text-color-secondary);
  cursor: grab;
  background: var(--app-fill-color-lighter);
  border: 0;
  border-radius: 4px;
}

.pro-table__column-drag-icon {
  font-size: 16px;
  pointer-events: none;
}

.pro-table__column-drag-handle:hover {
  color: var(--app-color-primary);
  background: var(--app-fill-color);
}

.pro-table__column-drag-handle:active {
  cursor: grabbing;
}

.pro-table__column-drag-handle:focus-visible {
  outline: 2px solid var(--app-color-primary-light-5);
  outline-offset: 1px;
}

.pro-table__column-setting-checkbox {
  flex: 1;
  min-width: 0;
  margin-right: 0;
}

.pro-table__column-setting-checkbox :deep(.ant-checkbox + span) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pro-table__column-setting-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--app-border-color-lighter);
}

.pro-table__settings {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 220px;
}

.pro-table__settings-title {
  padding-bottom: 10px;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  color: var(--app-text-color-primary);
  border-bottom: 1px solid var(--app-border-color-lighter);
}

.pro-table__settings-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
  font-size: 13px;
  color: var(--app-text-color-primary);
}

.pro-table__table {
  width: 100%;
}

/* 表头浅灰背景，干净简洁 */
.pro-table__table :deep(.ant-table-thead > tr > th) {
  background: var(--app-fill-color-lighter);
}

.pro-table__table--no-header-bg :deep(.ant-table-thead > tr > th) {
  background: transparent;
}

.pro-table__table--stripe :deep(.ant-table-tbody > tr:nth-child(even) > td) {
  background: var(--app-fill-color-lighter);
}

.pro-table__table :deep(.pro-table__current-row > td) {
  background: color-mix(in srgb, var(--app-color-primary) 10%, transparent);
}

.pro-table__table-wrap {
  flex: 1;
  min-width: 0;
  min-height: 0;
  padding: 8px 20px 16px;
}

.pro-table__pagination {
  display: flex;
  justify-content: flex-end;
  overflow-x: auto;
  padding: 16px 20px;
  border-top: 1px solid var(--app-border-color-lighter);
}

@media (width <= 768px) {
  .pro-table__toolbar {
    flex-wrap: wrap;
    gap: 8px;
  }

  .pro-table__search,
  .pro-table__search-item,
  .pro-table__field {
    width: 100%;
  }

  .pro-table__pagination {
    justify-content: flex-start;
  }
}
</style>
