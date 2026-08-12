<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { Select } from 'antdv-next'

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

const selectOptions = computed(() =>
  options.value
    .filter((item) => props.includeDisabled || !item.disabled)
    .map((item) => ({
      label: item.label,
      value: item.value,
      disabled: item.disabled,
    })),
)

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
  <Select
    class="dict-select"
    :value="modelValue == null ? undefined : String(modelValue)"
    :allow-clear="clearable"
    :disabled="disabled"
    :options="selectOptions"
    :placeholder="placeholder"
    @change="onChange"
  />
</template>

<style scoped lang="scss">
.dict-select {
  width: 100%;
}
</style>
