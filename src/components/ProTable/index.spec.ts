import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import type {
  ProTableColumn,
  ProTableExpose,
  ProTableRequestResult,
  ProTableRow,
  ProTableSearchField,
} from '@/types/pro-table'
import ProTable from './index.vue'

const columns: ProTableColumn<object>[] = [
  { prop: 'name', label: 'Name' },
  { prop: 'status', label: 'Status', type: 'tag' },
]

type TableRequest = (params: Record<string, unknown>) => Promise<ProTableRequestResult<ProTableRow>>

function mountTable(
  request: TableRequest,
  options: {
    columns?: ProTableColumn<object>[]
    searchFields?: ProTableSearchField[]
    immediate?: boolean
    searchCollapsible?: boolean
    searchCollapseThreshold?: number
    defaultSearchCollapsed?: boolean
    pagination?: boolean
    defaultExpandAll?: boolean
    treeProps?: { children?: string; hasChildren?: string }
    showColumnSetting?: boolean
    showRequestError?: boolean
  } = {},
) {
  return mount(ProTable, {
    props: {
      columns: options.columns ?? columns,
      searchFields: options.searchFields ?? [],
      request,
      immediate: options.immediate ?? true,
      searchCollapsible: options.searchCollapsible,
      searchCollapseThreshold: options.searchCollapseThreshold,
      defaultSearchCollapsed: options.defaultSearchCollapsed,
      pagination: options.pagination,
      defaultExpandAll: options.defaultExpandAll,
      treeProps: options.treeProps,
      showColumnSetting: options.showColumnSetting,
      showRequestError: options.showRequestError ?? false,
    },
    global: {
      plugins: [i18n, ElementPlus],
    },
  })
}

function exposed(wrapper: ReturnType<typeof mountTable>): ProTableExpose {
  return wrapper.vm as unknown as ProTableExpose
}

describe('ProTable', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'zh-CN'
  })

  it('loads request data with the default pagination params', async () => {
    const request = vi.fn<TableRequest>().mockResolvedValue({
      items: [{ id: '1', name: 'Admin', status: true }],
      total: 1,
    })
    const wrapper = mountTable(request)

    await flushPromises()

    expect(request).toHaveBeenCalledWith({ page: 1, pageSize: 10 })
    expect(wrapper.text()).toContain('Admin')
    expect(wrapper.text()).toContain('启用')
  })

  it('applies column visibility only after saving and resets through the draft', async () => {
    const request = vi.fn<TableRequest>().mockResolvedValue({
      items: [{ id: '1', name: 'Admin', status: true }],
      total: 1,
    })
    const wrapper = mountTable(request)
    await flushPromises()

    wrapper.findComponent({ name: 'ElPopover' }).vm.$emit('update:visible', true)
    await flushPromises()

    const options = wrapper.findAll('.pro-table__column-setting-option')
    expect(options).toHaveLength(2)
    expect(
      options.every((option) => option.find('.pro-table__column-drag-icon svg').exists()),
    ).toBe(true)
    await options[0]!.find('input').setValue(false)
    await flushPromises()

    expect(wrapper.findComponent({ name: 'ElTable' }).text()).toContain('Admin')
    expect(wrapper.emitted('column-visibility-change')).toBeUndefined()

    wrapper.findComponent({ name: 'ElPopover' }).vm.$emit('update:visible', false)
    await flushPromises()
    wrapper.findComponent({ name: 'ElPopover' }).vm.$emit('update:visible', true)
    await flushPromises()

    const reopenedOptions = wrapper.findAll('.pro-table__column-setting-option')
    expect((reopenedOptions[0]!.find('input').element as HTMLInputElement).checked).toBe(true)
    await reopenedOptions[0]!.find('input').setValue(false)

    await wrapper.find('.pro-table__column-setting-save').trigger('click')
    await flushPromises()

    expect(wrapper.findComponent({ name: 'ElTable' }).text()).not.toContain('Admin')
    expect(wrapper.emitted('column-visibility-change')?.[0]).toEqual([['status']])

    wrapper.findComponent({ name: 'ElPopover' }).vm.$emit('update:visible', true)
    await flushPromises()
    await wrapper.find('.pro-table__column-setting-reset').trigger('click')
    await flushPromises()

    expect(wrapper.findComponent({ name: 'ElTable' }).text()).not.toContain('Admin')

    await wrapper.find('.pro-table__column-setting-save').trigger('click')
    await flushPromises()

    expect(wrapper.findComponent({ name: 'ElTable' }).text()).toContain('Admin')
  })

  it('reorders column drafts by dragging and applies the order after saving', async () => {
    const request = vi.fn<TableRequest>().mockResolvedValue({
      items: [{ id: '1', name: 'Admin', status: true }],
      total: 1,
    })
    const wrapper = mountTable(request)
    await flushPromises()

    const rowCells = () =>
      wrapper
        .findAll('.el-table__body-wrapper tbody tr:first-child .cell')
        .map((cell) => cell.text())

    expect(rowCells()).toEqual(['Admin', '启用'])

    wrapper.findComponent({ name: 'ElPopover' }).vm.$emit('update:visible', true)
    await flushPromises()

    const options = wrapper.findAll('.pro-table__column-setting-option')
    const dataTransfer = {
      effectAllowed: 'none',
      getData: vi.fn<(format: string) => string>(() => 'status'),
      setData: vi.fn<(format: string, data: string) => void>(),
    }
    await options[1]!.find('.pro-table__column-drag-handle').trigger('dragstart', { dataTransfer })
    expect(wrapper.findAll('.pro-table__column-setting-option')[1]!.classes()).toContain(
      'is-dragging',
    )
    await wrapper.findAll('.pro-table__column-setting-option')[0]!.trigger('dragenter')
    expect(wrapper.findAll('.pro-table__column-setting-option')[0]!.classes()).toContain(
      'is-dragging',
    )
    await wrapper.findAll('.pro-table__column-setting-option')[1]!.trigger('drop', { dataTransfer })
    await flushPromises()

    expect(
      wrapper.findAll('.pro-table__column-setting-checkbox').map((item) => item.text()),
    ).toEqual(['Status', 'Name'])

    expect(rowCells()).toEqual(['Admin', '启用'])
    expect(wrapper.emitted('column-order-change')).toBeUndefined()

    await wrapper.find('.pro-table__column-setting-save').trigger('click')
    await flushPromises()

    expect(rowCells()).toEqual(['启用', 'Admin'])
    expect(wrapper.emitted('column-order-change')?.[0]).toEqual([['status', 'name']])
  })

  it('sets, submits, and resets search params through the exposed API', async () => {
    const request = vi.fn<TableRequest>().mockResolvedValue([])
    const searchFields: ProTableSearchField[] = [
      { prop: 'keyword', defaultValue: 'initial' },
      {
        prop: 'status',
        type: 'select',
        defaultValue: null,
        options: [
          { label: 'Enabled', value: true },
          { label: 'Disabled', value: false },
        ],
      },
    ]
    const wrapper = mountTable(request, { searchFields, immediate: false })

    await exposed(wrapper).setSearchParams({ keyword: 'admin', status: false })
    await exposed(wrapper).search()

    expect(request).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 10,
      keyword: 'admin',
      status: false,
    })

    await exposed(wrapper).resetSearch()
    expect(request).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 10,
      keyword: 'initial',
    })
  })

  it('collapses excess search fields without dropping their request values', async () => {
    const request = vi.fn<TableRequest>().mockResolvedValue([])
    const searchFields: ProTableSearchField[] = Array.from({ length: 4 }, (_, index) => ({
      prop: `filter${index + 1}`,
      label: `Filter ${index + 1}`,
      defaultValue: `value${index + 1}`,
    }))
    const wrapper = mountTable(request, { searchFields, immediate: false })

    expect(wrapper.findAll('.pro-table__search-item')).toHaveLength(3)
    expect(wrapper.text()).not.toContain('Filter 4')

    await exposed(wrapper).search()
    expect(request).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 10,
      filter1: 'value1',
      filter2: 'value2',
      filter3: 'value3',
      filter4: 'value4',
    })

    await wrapper.find('.pro-table__collapse-button').trigger('click')

    expect(wrapper.findAll('.pro-table__search-item')).toHaveLength(4)
    expect(wrapper.text()).toContain('Filter 4')
    expect(wrapper.emitted('search-collapse-change')?.[0]).toEqual([false])
  })

  it('reloads with normalized remote sort params', async () => {
    const request = vi.fn<TableRequest>().mockResolvedValue([])
    const sortableColumns: ProTableColumn<object>[] = [
      { prop: 'name', label: 'Name', sortable: 'custom' },
    ]
    const wrapper = mountTable(request, { columns: sortableColumns })
    await flushPromises()

    wrapper.findComponent({ name: 'ElTable' }).vm.$emit('sort-change', {
      column: {},
      prop: 'name',
      order: 'descending',
    })
    await flushPromises()

    expect(request).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 10,
      sortField: 'name',
      sortOrder: 'desc',
    })
  })

  it('falls back to the last valid page after data deletion', async () => {
    const request = vi.fn<TableRequest>(async (params) => {
      if (params.page === 2) {
        return { items: [], total: 10 }
      }
      return { items: [{ id: '1', name: 'First page' }], total: 10 }
    })
    const wrapper = mountTable(request)
    await flushPromises()

    wrapper.findComponent({ name: 'ElPagination' }).vm.$emit('current-change', 2)
    await flushPromises()

    expect(request).toHaveBeenNthCalledWith(2, { page: 2, pageSize: 10 })
    expect(request).toHaveBeenLastCalledWith({ page: 1, pageSize: 10 })
    expect(wrapper.text()).toContain('First page')
  })

  it('passes tree props and expands or collapses all nested rows', async () => {
    const request = vi.fn<TableRequest>().mockResolvedValue([
      {
        id: 'parent',
        name: 'Parent',
        children: [{ id: 'child', name: 'Child', children: [] }],
      },
    ])
    const wrapper = mountTable(request, {
      pagination: false,
      defaultExpandAll: true,
      treeProps: { children: 'children' },
    })
    await flushPromises()

    const tableWrapper = wrapper.findComponent({ name: 'ElTable' })
    expect(tableWrapper.props('defaultExpandAll')).toBe(true)
    expect(tableWrapper.props('treeProps')).toEqual({ children: 'children' })
    expect(() => exposed(wrapper).setAllRowsExpanded(false)).not.toThrow()
  })

  it('ignores a stale response when a newer reload finishes first', async () => {
    const resolvers: Array<(result: ProTableRequestResult<ProTableRow>) => void> = []
    const request = vi.fn<TableRequest>(
      () =>
        new Promise<ProTableRequestResult<ProTableRow>>((resolve) => {
          resolvers.push(resolve)
        }),
    )
    const wrapper = mountTable(request)
    await flushPromises()

    const latestRequest = exposed(wrapper).reload()
    resolvers[1]?.({ items: [{ id: '2', name: 'Latest' }], total: 1 })
    await latestRequest

    resolvers[0]?.({ items: [{ id: '1', name: 'Stale' }], total: 1 })
    await flushPromises()

    expect(wrapper.text()).toContain('Latest')
    expect(wrapper.text()).not.toContain('Stale')
  })

  it('emits request-error without rejecting the render cycle', async () => {
    const error = new Error('network unavailable')
    const wrapper = mountTable(vi.fn<TableRequest>().mockRejectedValue(error))

    await flushPromises()

    expect(wrapper.emitted('request-error')?.[0]?.[0]).toBe(error)
    expect(wrapper.text()).toContain('暂无数据')
  })
})
