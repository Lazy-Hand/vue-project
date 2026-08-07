import { ref } from 'vue'
import { defineStore } from 'pinia'

import { fetchDictByCode } from '@/api/dict'
import type { DictItem, DictOption } from '@/types/dict'

function normalizeDictValue(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? '1' : '0'
  return String(value)
}

export const useDictStore = defineStore('dict', () => {
  const cache = ref<Record<string, DictItem[]>>({})
  const loadingMap = ref<Record<string, boolean>>({})

  async function load(typeCode: string, force = false): Promise<DictItem[]> {
    const code = typeCode.trim()
    if (!code) return []

    if (!force && cache.value[code]) {
      return cache.value[code]
    }

    loadingMap.value[code] = true
    try {
      const result = await fetchDictByCode(code)
      cache.value[code] = result.items
      return result.items
    } finally {
      loadingMap.value[code] = false
    }
  }

  async function loadMany(typeCodes: string[], force = false): Promise<void> {
    await Promise.all(typeCodes.map((code) => load(code, force)))
  }

  function getItems(typeCode: string): DictItem[] {
    return cache.value[typeCode] ?? []
  }

  function getOptions(typeCode: string): DictOption[] {
    return getItems(typeCode).map((item) => ({
      label: item.label,
      value: item.value,
      code: item.code,
      disabled: !item.enabled,
    }))
  }

  function getLabel(
    typeCode: string,
    value: string | number | boolean | null | undefined,
    fallback?: string,
  ): string {
    const normalized = normalizeDictValue(value)
    if (!normalized) return fallback ?? ''
    const matched = getItems(typeCode).find((item) => item.value === normalized)
    return matched?.label ?? fallback ?? normalized
  }

  function clear(typeCode?: string): void {
    if (!typeCode) {
      cache.value = {}
      return
    }
    const next = { ...cache.value }
    delete next[typeCode]
    cache.value = next
  }

  return {
    cache,
    loadingMap,
    load,
    loadMany,
    getItems,
    getOptions,
    getLabel,
    clear,
  }
})
