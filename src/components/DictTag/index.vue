<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { Tag } from 'antdv-next'

import { useDictStore } from '@/stores/dict'

interface Props {
  typeCode: string
  value?: string | number | boolean | null
  fallback?: string
  /** Map value to an Antdv tag color */
  tagTypeMap?: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'primary'>
}

const props = withDefaults(defineProps<Props>(), {
  value: null,
  fallback: undefined,
  tagTypeMap: undefined,
})

const dictStore = useDictStore()

onMounted(() => {
  void dictStore.load(props.typeCode)
})

watch(
  () => props.typeCode,
  (code) => {
    void dictStore.load(code)
  },
)

const text = computed(() => dictStore.getLabel(props.typeCode, props.value, props.fallback))

const tagType = computed(() => {
  if (!props.tagTypeMap) return undefined
  const key =
    props.value === null || props.value === undefined
      ? ''
      : typeof props.value === 'boolean'
        ? props.value
          ? '1'
          : '0'
        : String(props.value)
  return props.tagTypeMap[key]
})

const antColor = computed(() => {
  switch (tagType.value) {
    case 'success':
      return 'green'
    case 'warning':
      return 'orange'
    case 'danger':
      return 'error'
    case 'primary':
      return 'processing'
    case 'info':
      return 'default'
    default:
      return undefined
  }
})
</script>

<template>
  <Tag v-if="antColor" :color="antColor" :bordered="false">{{ text }}</Tag>
  <span v-else>{{ text }}</span>
</template>
