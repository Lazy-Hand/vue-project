import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useDictStore } from './dict'
import type { DictTypeWithItems } from '@/types/dict'

vi.mock('@/api/dict', () => ({
  fetchDictByCode: vi.fn<(code: string) => Promise<DictTypeWithItems>>(),
}))

import { fetchDictByCode } from '@/api/dict'

const sample: DictTypeWithItems = {
  id: '1',
  code: 'sys_common_status',
  name: 'Common status',
  description: null,
  enabled: true,
  items: [
    {
      id: '1',
      dictTypeId: '1',
      code: 'enabled',
      label: 'Enabled',
      value: '1',
      sort: 0,
      enabled: true,
    },
    {
      id: '2',
      dictTypeId: '1',
      code: 'disabled',
      label: 'Disabled',
      value: '0',
      sort: 1,
      enabled: true,
    },
  ],
}

describe('dict store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(fetchDictByCode).mockReset()
    vi.mocked(fetchDictByCode).mockResolvedValue(sample)
  })

  it('loads and caches options / labels', async () => {
    const store = useDictStore()
    await store.load('sys_common_status')

    expect(store.getOptions('sys_common_status')).toEqual([
      { label: 'Enabled', value: '1', code: 'enabled', disabled: false },
      { label: 'Disabled', value: '0', code: 'disabled', disabled: false },
    ])
    expect(store.getLabel('sys_common_status', true)).toBe('Enabled')
    expect(store.getLabel('sys_common_status', '0')).toBe('Disabled')
    expect(store.getLabel('sys_common_status', '9', 'Unknown')).toBe('Unknown')

    await store.load('sys_common_status')
    expect(fetchDictByCode).toHaveBeenCalledTimes(1)
  })

  it('clears cache for a type code', async () => {
    const store = useDictStore()
    await store.load('sys_common_status')
    store.clear('sys_common_status')
    expect(store.getItems('sys_common_status')).toEqual([])

    await store.load('sys_common_status')
    expect(fetchDictByCode).toHaveBeenCalledTimes(2)
  })
})
