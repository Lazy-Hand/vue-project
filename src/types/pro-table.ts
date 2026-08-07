export type ProTableRow = Record<string, unknown>

export type ProTableSearchValue = string | number | boolean | Array<string | number> | null

export type ProTableSearchFieldType = 'input' | 'select' | 'dict-select' | 'slot'

export interface ProTableSearchFieldOption {
  label: string
  value: string | number | boolean
  disabled?: boolean
}

export interface ProTableSearchField {
  prop: string
  label?: string
  type?: ProTableSearchFieldType
  placeholder?: string
  defaultValue?: ProTableSearchValue
  options?: ProTableSearchFieldOption[]
  dictTypeCode?: string
  clearable?: boolean
  multiple?: boolean
  /** Whether a changed or cleared field immediately submits the search. Defaults to true for selects. */
  searchOnChange?: boolean
  /** Named slot: `#search-{slot}`. Defaults to `#search-{prop}`. */
  slot?: string
  /** Convert a non-empty form value before it is added to request params. */
  transform?: (value: ProTableSearchValue) => unknown
  /** Extra class for the field control, e.g. pro-table__field--wide. */
  fieldClass?: string
}

export type ProTableColumnType = 'text' | 'dict' | 'tag' | 'slot' | 'selection' | 'index'
export type ProTableSortOrder = 'ascending' | 'descending' | null
export type ProTableRequestSortOrder = 'asc' | 'desc'

export interface ProTableColumn<T = ProTableRow> {
  key?: string
  prop?: string
  label?: string
  width?: number | string
  minWidth?: number | string
  fixed?: 'left' | 'right'
  align?: 'left' | 'center' | 'right'
  headerAlign?: 'left' | 'center' | 'right'
  className?: string
  showOverflowTooltip?: boolean
  type?: ProTableColumnType
  dictTypeCode?: string
  tagTypeMap?: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'primary'>
  trueLabel?: string
  falseLabel?: string
  formatter?: (
    row: T,
    column: ProTableColumn<T>,
    cellValue: unknown,
    index: number,
  ) => string | number
  sortable?: boolean | 'custom'
  sortOrders?: ProTableSortOrder[]
  /** Custom index value, only used by an `index` column. */
  index?: number | ((index: number) => number)
  /** Row selection guard, only used by a `selection` column. */
  selectable?: (row: T, index: number) => boolean
  /** Preserve selections across data refreshes. Requires `rowKey`. */
  reserveSelection?: boolean
  /** Named slot: `#column-{slot}`. */
  slot?: string
  /** Named slot: `#header-{headerSlot}`. */
  headerSlot?: string
  hidden?: boolean
}

export interface ProTablePaginationConfig {
  pageSize?: number
  pageSizes?: number[]
  layout?: string
  small?: boolean
  background?: boolean
  hideOnSinglePage?: boolean
  pagerCount?: number
}

export interface ProTableTreeProps {
  children?: string
  hasChildren?: string
}

export interface ProTableDefaultSort {
  prop: string
  order: Exclude<ProTableSortOrder, null>
}

export interface ProTableSortState {
  prop: string | null
  order: ProTableSortOrder
}

export interface ProTableRequestParams {
  page: number
  pageSize: number
  sortField?: string
  sortOrder?: ProTableRequestSortOrder
  [key: string]: unknown
}

export interface ProTableRequestData<T = unknown> {
  items: T[]
  total: number
}

export type ProTableRequestResult<T = unknown> = ProTableRequestData<T> | T[]

export interface ProTableExpose<T = ProTableRow> {
  reload: () => Promise<void>
  search: () => Promise<void>
  resetSearch: () => Promise<void>
  getSearchParams: () => ProTableRequestParams
  setSearchParams: (params: Record<string, ProTableSearchValue>, submit?: boolean) => Promise<void>
  setSearchCollapsed: (collapsed: boolean) => void
  toggleSearchCollapse: () => void
  setAllRowsExpanded: (expanded: boolean) => void
  getTableData: () => T[]
  getSelectedRows: () => T[]
  clearSelection: () => void
  toggleRowSelection: (row: T, selected?: boolean) => void
}
