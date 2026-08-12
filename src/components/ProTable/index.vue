<script setup lang="ts" generic="T extends object = ProTableRow">
import { computed, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Alert,
  Button,
  Checkbox,
  CheckboxGroup,
  Empty,
  Form,
  FormItem,
  Input,
  Pagination,
  Popover,
  Select,
  Spin,
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
  HolderOutlined,
  LoadingOutlined,
  SettingOutlined,
} from '@antdv-next/icons'

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
const columnVisibility = reactive<Record<string, boolean>>({})
const columnOrder = ref<string[]>([])
const columnSettingVisible = ref(false)
const draftColumnOrder = ref<string[]>([])
const draftVisibleColumnKeys = ref<string[]>([])
const draggedColumnKey = ref<string>()
const dragOverColumnKey = ref<string>()
const expandedRowKeys = ref<Array<string | number>>([])
const expandedRowsControlled = ref(false)

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
        sortOrder:
          sortField.value === column.prop
            ? sortOrder.value === 'asc'
              ? 'ascend'
              : 'descend'
            : null,
        sortDirections: column.sortOrders?.map((order) =>
          order === 'ascending' ? 'ascend' : order === 'descending' ? 'descend' : null,
        ),
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
const paginationEnabled = computed(() => props.pagination !== false)
const resolvedEmptyText = computed(() => props.emptyText ?? t('proTable.empty'))

const paginationConfig = computed<ProTablePaginationConfig>(() => {
  if (props.pagination === false || props.pagination === true) return {}
  return props.pagination
})
const pageSizes = computed(() => paginationConfig.value.pageSizes ?? [10, 20, 50])
const paginationSmall = computed(() => paginationConfig.value.small ?? false)
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
    const nextResult = {
      items,
      total: Array.isArray(rawResult) && props.clientFilter ? items.length : result.total,
    }
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
  _filters: Record<string, unknown>,
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
  const value = props.maxHeight ?? props.height
  return value === undefined ? undefined : { y: value }
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

onMounted(() => {
  if (props.immediate) void loadData()
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
      <Form
        v-if="searchFields.length"
        layout="inline"
        :model="searchForm"
        class="pro-table__search"
        @submit.prevent="handleSearch"
      >
        <FormItem
          v-for="field in visibleSearchFields"
          :key="field.prop"
          :name="field.prop"
          :label="field.label"
          class="pro-table__search-item"
        >
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

        <FormItem v-if="showSearchActions || searchCanCollapse" class="pro-table__search-actions">
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
              <Button :disabled="loading" @click="handleReset">{{ t('proTable.reset') }}</Button>
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
      </Form>

      <div v-if="$slots['toolbar-actions'] || columnSettingAvailable" class="pro-table__actions">
        <slot name="toolbar-actions" />
        <Popover
          v-if="columnSettingAvailable"
          v-model:open="columnSettingVisible"
          placement="bottomRight"
          :classes="{ root: 'pro-table__column-setting-popover' }"
          trigger="click"
        >
          <Button class="pro-table__column-setting-trigger">
            <SettingOutlined />
            {{ t('proTable.columnSetting') }}
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

    <div class="pro-table__table-wrap" :aria-busy="loading">
      <Spin :spinning="loading">
        <Table
          :data-source="tableData"
          :columns="tableColumns"
          :row-key="rowKey"
          :bordered="border"
          :show-header="showHeader"
          :row-selection="tableRowSelection"
          :scroll="tableScroll"
          :expandable="tableExpandable"
          :pagination="false"
          :class="['pro-table__table', { 'pro-table__table--stripe': stripe }]"
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
            <span v-else>{{ tableColumn.title }}</span>
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

      <div v-if="loading" class="pro-table__loading" role="status">
        <LoadingOutlined spin />
        <span>{{ t('proTable.loading') }}</span>
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
        :size="paginationSmall ? 'small' : 'middle'"
        @change="handlePageChange"
        @show-size-change="handleSizeChange"
      >
        <template #showTotal="{ total: count }">{{ count }}</template>
      </Pagination>
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

.pro-table__table {
  width: 100%;
}

.pro-table__table--stripe :deep(.ant-table-tbody > tr:nth-child(even) > td) {
  background: var(--app-fill-color-lighter);
}

.pro-table__table :deep(.pro-table__current-row > td) {
  background: color-mix(in srgb, var(--app-color-primary) 10%, transparent);
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
  color: var(--app-color-primary);
  pointer-events: none;
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
