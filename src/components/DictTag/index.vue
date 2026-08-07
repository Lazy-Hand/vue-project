<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { ElTag } from 'element-plus'

import { useDictStore } from '@/stores/dict'

interface Props {
  typeCode: string
  value?: string | number | boolean | null
  fallback?: string
  /** Map value to Element Plus tag type */
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
</script>

<template>
  <el-tag v-if="tagType" :type="tagType" size="small">{{ text }}</el-tag>
  <span v-else>{{ text }}</span>
</template>
