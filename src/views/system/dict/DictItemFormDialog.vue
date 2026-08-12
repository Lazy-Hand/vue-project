<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FormInstance, Rule } from 'antdv-next'
import { Button, Form, FormItem, Input, InputNumber, Modal } from 'antdv-next'

import DictSelect from '@/components/DictSelect/index.vue'
import {
  DICT_CODES,
  type DictItem,
  type DictItemPayload,
  type UpdateDictItemPayload,
} from '@/types/dict'

interface Props {
  modelValue: boolean
  mode: 'create' | 'edit'
  dictTypeId: string
  editing?: DictItem | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: DictItemPayload | UpdateDictItemPayload]
}>()

const { t } = useI18n()
const formRef = ref<FormInstance>()
const submitting = ref(false)
const enabledValue = ref<string | null>('1')

const form = reactive({
  code: '',
  label: '',
  value: '',
  sort: 0,
  enabled: true,
})

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const title = computed(() =>
  props.mode === 'create' ? t('dict.createItemTitle') : t('dict.editItemTitle'),
)

const rules = computed<Record<string, Rule[]>>(() => ({
  code: [{ required: true, message: t('dict.itemCodeRequired'), trigger: 'blur' }],
  label: [{ required: true, message: t('dict.itemLabelRequired'), trigger: 'blur' }],
  value: [{ required: true, message: t('dict.itemValueRequired'), trigger: 'blur' }],
}))

watch(enabledValue, (value) => {
  form.enabled = value === '1'
})

watch(
  () => [props.modelValue, props.mode, props.editing] as const,
  ([open]) => {
    if (!open) return
    if (props.mode === 'edit' && props.editing) {
      form.code = props.editing.code
      form.label = props.editing.label
      form.value = props.editing.value
      form.sort = props.editing.sort
      form.enabled = props.editing.enabled
      enabledValue.value = props.editing.enabled ? '1' : '0'
    } else {
      form.code = ''
      form.label = ''
      form.value = ''
      form.sort = 0
      form.enabled = true
      enabledValue.value = '1'
    }
  },
)

async function handleSubmit(): Promise<void> {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  if (props.mode === 'create') {
    emit('submit', {
      dictTypeId: props.dictTypeId,
      code: form.code.trim(),
      label: form.label.trim(),
      value: form.value.trim(),
      sort: form.sort,
      enabled: form.enabled,
    })
    return
  }

  emit('submit', {
    label: form.label.trim(),
    value: form.value.trim(),
    sort: form.sort,
    enabled: form.enabled,
  })
}

defineExpose({
  setSubmitting(value: boolean) {
    submitting.value = value
  },
})
</script>

<template>
  <Modal v-model:open="visible" :title="title" width="520px" destroy-on-hidden>
    <Form ref="formRef" :model="form" :rules="rules" class="dict-item-form">
      <FormItem :label="t('dict.itemCode')" name="code">
        <Input v-model:value="form.code" :maxlength="64" :disabled="mode === 'edit'" />
      </FormItem>
      <FormItem :label="t('dict.itemLabel')" name="label">
        <Input v-model:value="form.label" :maxlength="64" />
      </FormItem>
      <FormItem :label="t('dict.itemValue')" name="value">
        <Input v-model:value="form.value" :maxlength="255" />
      </FormItem>
      <FormItem :label="t('dict.sort')" name="sort">
        <InputNumber v-model:value="form.sort" :min="0" :max="9999" />
      </FormItem>
      <FormItem :label="t('dict.enabled')" name="enabled">
        <DictSelect
          v-model="enabledValue"
          :type-code="DICT_CODES.COMMON_STATUS"
          :clearable="false"
        />
      </FormItem>
    </Form>

    <template #footer>
      <Button @click="visible = false">{{ t('common.cancel') }}</Button>
      <Button type="primary" :loading="submitting" @click="handleSubmit">
        {{ t('common.confirm') }}
      </Button>
    </template>
  </Modal>
</template>

<style scoped lang="scss">
.dict-item-form {
  :deep(.ant-form-item-label) {
    width: 108px;
  }
}
</style>
