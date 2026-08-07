<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { ElOption, ElSelect } from 'element-plus'

import { useDict } from '@/composables/useDict'

interface Props {
  typeCode: string
  modelValue?: string | number | null
  clearable?: boolean
  disabled?: boolean
  placeholder?: string
  /** Include disabled dict items */
  includeDisabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  clearable: true,
  disabled: false,
  placeholder: undefined,
  includeDisabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const { options, load } = useDict(props.typeCode)

onMounted(() => {
  void load(props.typeCode)
})

watch(
  () => props.typeCode,
  (code) => {
    void load(code)
  },
)

function onChange(value: string | number | boolean | null | undefined): void {
  if (value === null || value === undefined || value === '') {
    emit('update:modelValue', null)
    return
  }
  emit('update:modelValue', String(value))
}
</script>

<template>
  <el-select
    class="dict-select"
    :model-value="modelValue == null ? null : String(modelValue)"
    :clearable="clearable"
    :disabled="disabled"
    :placeholder="placeholder"
    @update:model-value="onChange"
  >
    <el-option
      v-for="item in options.filter((entry) => includeDisabled || !entry.disabled)"
      :key="item.value"
      :label="item.label"
      :value="item.value"
      :disabled="item.disabled"
    />
  </el-select>
</template>

<style scoped lang="scss">
.dict-select {
  width: 100%;
}
</style>
