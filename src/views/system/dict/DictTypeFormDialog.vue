<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FormInstance, Rule } from 'antdv-next'
import { Button, Form, FormItem, Input, Modal, TextArea } from 'antdv-next'

import DictSelect from '@/components/DictSelect/index.vue'
import {
  DICT_CODES,
  type DictType,
  type DictTypePayload,
  type UpdateDictTypePayload,
} from '@/types/dict'

interface Props {
  modelValue: boolean
  mode: 'create' | 'edit'
  editing?: DictType | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: DictTypePayload | UpdateDictTypePayload]
}>()

const { t } = useI18n()
const formRef = ref<FormInstance>()
const submitting = ref(false)
const enabledValue = ref<string | null>('1')

const form = reactive({
  code: '',
  name: '',
  description: '',
  enabled: true,
})

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const title = computed(() =>
  props.mode === 'create' ? t('dict.createTypeTitle') : t('dict.editTypeTitle'),
)

const rules = computed<Record<string, Rule[]>>(() => ({
  code: [
    { required: true, message: t('dict.typeCodeRequired'), trigger: 'blur' },
    { min: 2, max: 64, message: t('dict.typeCodeLength'), trigger: 'blur' },
  ],
  name: [{ required: true, message: t('dict.typeNameRequired'), trigger: 'blur' }],
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
      form.name = props.editing.name
      form.description = props.editing.description ?? ''
      form.enabled = props.editing.enabled
      enabledValue.value = props.editing.enabled ? '1' : '0'
    } else {
      form.code = ''
      form.name = ''
      form.description = ''
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
      code: form.code.trim(),
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      enabled: form.enabled,
    })
    return
  }

  emit('submit', {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
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
    <Form ref="formRef" :model="form" :rules="rules" class="dict-type-form">
      <FormItem :label="t('dict.typeCode')" name="code">
        <Input v-model:value="form.code" :maxlength="64" :disabled="mode === 'edit'" />
      </FormItem>
      <FormItem :label="t('dict.typeName')" name="name">
        <Input v-model:value="form.name" :maxlength="64" />
      </FormItem>
      <FormItem :label="t('dict.description')" name="description">
        <TextArea v-model:value="form.description" :rows="2" :maxlength="255" />
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
.dict-type-form {
  :deep(.ant-form-item-label) {
    width: 108px;
  }
}
</style>
