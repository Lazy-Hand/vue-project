import { flushPromises, mount } from '@vue/test-utils'
import { Dropdown } from 'antdv-next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import type { ProTableAction } from '@/types/pro-table'
import ProTableActions from './index.vue'

interface TestRow {
  id: string
  locked: boolean
}

const row: TestRow = { id: '1', locked: false }

function mountActions(actions: ProTableAction<TestRow>[], maxInline = 2) {
  return mount(ProTableActions<TestRow>, {
    props: { row, actions, maxInline },
    global: { plugins: [i18n] },
  })
}

describe('ProTableActions', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'zh-CN'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps the preferred action inline and groups dangerous overflow actions last', () => {
    const actions: ProTableAction<TestRow>[] = [
      {
        key: 'edit',
        label: 'Edit',
        placement: 'inline',
        onClick: vi.fn<(row: TestRow) => void>(),
      },
      { key: 'roles', label: 'Roles', onClick: vi.fn<(row: TestRow) => void>() },
      { key: 'reset', label: 'Reset', onClick: vi.fn<(row: TestRow) => void>() },
      { key: 'delete', label: 'Delete', danger: true, onClick: vi.fn<(row: TestRow) => void>() },
    ]
    const wrapper = mountActions(actions)

    expect(wrapper.findAll('.pro-table-actions__inline').map((item) => item.text())).toEqual([
      'Edit',
      'Roles',
    ])

    const items = wrapper.findComponent(Dropdown).props('menu')?.items
    expect(items).toEqual([
      expect.objectContaining({ key: 'reset', label: 'Reset' }),
      { type: 'divider' },
      expect.objectContaining({ key: 'delete', label: 'Delete', danger: true }),
    ])
  })

  it('keeps all actions inline when the count does not exceed three', () => {
    const wrapper = mountActions([
      { key: 'edit', label: 'Edit', onClick: vi.fn<(row: TestRow) => void>() },
      { key: 'roles', label: 'Roles', onClick: vi.fn<(row: TestRow) => void>() },
      { key: 'reset', label: 'Reset', onClick: vi.fn<(row: TestRow) => void>() },
    ])

    expect(wrapper.findAll('.pro-table-actions__inline').map((item) => item.text())).toEqual([
      'Edit',
      'Roles',
      'Reset',
    ])
    expect(wrapper.findComponent(Dropdown).exists()).toBe(false)
  })

  it('filters hidden actions and respects disabled actions', async () => {
    const hiddenAction = vi.fn<(row: TestRow) => void>()
    const disabledAction = vi.fn<(row: TestRow) => void>()
    const actions: ProTableAction<TestRow>[] = [
      { key: 'hidden', label: 'Hidden', visible: false, onClick: hiddenAction },
      { key: 'edit', label: 'Edit', disabled: true, onClick: disabledAction },
    ]
    const wrapper = mountActions(actions)

    expect(wrapper.text()).not.toContain('Hidden')
    const editButton = wrapper.find('.pro-table-actions__inline')
    expect(editButton.attributes('disabled')).toBeDefined()
    await editButton.trigger('click')
    expect(hiddenAction).not.toHaveBeenCalled()
    expect(disabledAction).not.toHaveBeenCalled()
  })

  it('runs a selected overflow action for the current row', () => {
    const handleDelete = vi.fn<(row: TestRow) => void>()
    const actions: ProTableAction<TestRow>[] = [
      {
        key: 'edit',
        label: 'Edit',
        placement: 'inline',
        onClick: vi.fn<(row: TestRow) => void>(),
      },
      { key: 'delete', label: 'Delete', placement: 'menu', onClick: handleDelete },
    ]
    const wrapper = mountActions(actions)

    wrapper.findComponent(Dropdown).vm.$emit('menuClick', { key: 'delete' })

    expect(handleDelete).toHaveBeenCalledWith(row)
  })

  it('runs an inline action without bubbling to the table row', async () => {
    const handleEdit = vi.fn<(row: TestRow) => void>()
    const handleRowClick = vi.fn<(event: Event) => void>()
    const host = document.createElement('div')
    host.addEventListener('click', handleRowClick)
    document.body.appendChild(host)

    const wrapper = mount(ProTableActions<TestRow>, {
      attachTo: host,
      props: {
        row,
        actions: [{ key: 'edit', label: 'Edit', onClick: handleEdit }],
      },
      global: { plugins: [i18n] },
    })

    await wrapper.find('.pro-table-actions__inline').trigger('click')

    expect(handleEdit).toHaveBeenCalledWith(row)
    expect(handleRowClick).not.toHaveBeenCalled()
    wrapper.unmount()
    host.remove()
  })

  it('moves inline actions into the menu when the container is too narrow', async () => {
    let resizeCallback: ResizeObserverCallback | undefined
    class ResizeObserverMock {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback
      }

      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)

    const wrapper = mountActions([
      {
        key: 'edit',
        label: 'Edit',
        placement: 'inline',
        onClick: vi.fn<(row: TestRow) => void>(),
      },
      {
        key: 'delete',
        label: 'Delete',
        placement: 'menu',
        onClick: vi.fn<(row: TestRow) => void>(),
      },
    ])
    const container = wrapper.find('.pro-table-actions').element
    Object.defineProperties(container, {
      clientWidth: { configurable: true, value: 108 },
      scrollWidth: { configurable: true, value: 140 },
    })

    await flushPromises()
    if (!resizeCallback) throw new Error('ResizeObserver was not created')
    resizeCallback([], {} as ResizeObserver)
    await flushPromises()

    expect(wrapper.findAll('.pro-table-actions__inline')).toHaveLength(0)
    expect(
      wrapper
        .findComponent(Dropdown)
        .props('menu')
        ?.items?.filter((item) => item?.type !== 'divider')
        .map((item) => item?.key),
    ).toEqual(['edit', 'delete'])

    Object.defineProperty(container, 'clientWidth', { configurable: true, value: 148 })
    resizeCallback([], {} as ResizeObserver)
    await flushPromises()

    expect(wrapper.findAll('.pro-table-actions__inline')).toHaveLength(1)
    expect(
      wrapper
        .findComponent(Dropdown)
        .props('menu')
        ?.items?.filter((item) => item?.type !== 'divider')
        .map((item) => item?.key),
    ).toEqual(['delete'])
  })

  it('renders an empty marker when no actions are visible', () => {
    const wrapper = mountActions([
      {
        key: 'hidden',
        label: 'Hidden',
        visible: () => false,
        onClick: vi.fn<(row: TestRow) => void>(),
      },
    ])

    expect(wrapper.find('.pro-table-actions__empty').text()).toBe('-')
    expect(wrapper.findComponent(Dropdown).exists()).toBe(false)
  })
})
