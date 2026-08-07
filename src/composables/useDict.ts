import { computed, onMounted, type ComputedRef } from 'vue'

import { pinia } from '@/stores'
import { useDictStore } from '@/stores/dict'
import type { DictItem, DictOption } from '@/types/dict'

/**
 * Load and use dictionary data in pages/components.
 *
 * @example
 * const { options, label, items } = useDict('sys_common_status')
 * // table: label(row.enabled)
 * // form: options for el-select
 */
export function useDict(typeCode: string | string[]) {
  const dictStore = useDictStore(pinia)
  const codes = (Array.isArray(typeCode) ? typeCode : [typeCode]).filter(Boolean)

  onMounted(() => {
    void dictStore.loadMany(codes)
  })

  function options(code: string): ComputedRef<DictOption[]> {
    return computed(() => dictStore.getOptions(code))
  }

  function items(code: string): ComputedRef<DictItem[]> {
    return computed(() => dictStore.getItems(code))
  }

  function label(
    code: string,
    value: string | number | boolean | null | undefined,
    fallback?: string,
  ): string {
    return dictStore.getLabel(code, value, fallback)
  }

  const primaryCode = codes[0] ?? ''

  return {
    /** Options for the first / only typeCode (form selects). */
    options: computed(() => dictStore.getOptions(primaryCode)),
    /** Items for the first / only typeCode. */
    items: computed(() => dictStore.getItems(primaryCode)),
    /** Resolve label for the first / only typeCode (table cells). */
    label: (value: string | number | boolean | null | undefined, fallback?: string) =>
      dictStore.getLabel(primaryCode, value, fallback),
    /** Multi-code helpers */
    getOptions: options,
    getItems: items,
    getLabel: label,
    load: (code = primaryCode, force = false) => dictStore.load(code, force),
    reload: () => dictStore.loadMany(codes, true),
  }
}

/** Imperative helpers outside setup (e.g. utils / route guards). */
export async function ensureDict(typeCode: string, force = false): Promise<DictItem[]> {
  return useDictStore(pinia).load(typeCode, force)
}

export function getDictLabel(
  typeCode: string,
  value: string | number | boolean | null | undefined,
  fallback?: string,
): string {
  return useDictStore(pinia).getLabel(typeCode, value, fallback)
}

export function getDictOptions(typeCode: string): DictOption[] {
  return useDictStore(pinia).getOptions(typeCode)
}
