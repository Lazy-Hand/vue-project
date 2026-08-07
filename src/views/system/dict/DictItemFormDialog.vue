<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FormInstance, FormRules } from 'element-plus'
import {
  ElButton,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
} from 'element-plus'

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

const rules = computed<FormRules<typeof form>>(() => ({
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
  <el-dialog v-model="visible" :title="title" width="520px" destroy-on-close>
    <el-form ref="formRef" :model="form" :rules="rules" label-width="108px">
      <el-form-item :label="t('dict.itemCode')" prop="code">
        <el-input v-model="form.code" maxlength="64" :disabled="mode === 'edit'" />
      </el-form-item>
      <el-form-item :label="t('dict.itemLabel')" prop="label">
        <el-input v-model="form.label" maxlength="64" />
      </el-form-item>
      <el-form-item :label="t('dict.itemValue')" prop="value">
        <el-input v-model="form.value" maxlength="255" />
      </el-form-item>
      <el-form-item :label="t('dict.sort')" prop="sort">
        <el-input-number v-model="form.sort" :min="0" :max="9999" controls-position="right" />
      </el-form-item>
      <el-form-item :label="t('dict.enabled')" prop="enabled">
        <DictSelect v-model="enabledValue" :type-code="DICT_CODES.COMMON_STATUS" :clearable="false" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        {{ t('common.confirm') }}
      </el-button>
    </template>
  </el-dialog>
</template>
