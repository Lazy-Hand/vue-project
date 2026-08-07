<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FormInstance, FormRules } from 'element-plus'
import { ElButton, ElDialog, ElForm, ElFormItem, ElInput, ElSwitch } from 'element-plus'

import type {
  SystemConfig,
  SystemConfigPayload,
  UpdateSystemConfigPayload,
} from '@/types/system-config'

interface Props {
  modelValue: boolean
  mode: 'create' | 'edit'
  editing?: SystemConfig | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: SystemConfigPayload | UpdateSystemConfigPayload]
}>()

const { t } = useI18n()
const formRef = ref<FormInstance>()
const submitting = ref(false)

interface FormModel {
  key: string
  name: string
  value: string
  description: string
  enabled: boolean
}

const form = reactive<FormModel>({
  key: '',
  name: '',
  value: '',
  description: '',
  enabled: true,
})

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const title = computed(() =>
  props.mode === 'create' ? t('config.createTitle') : t('config.editTitle'),
)

const rules = computed<FormRules<FormModel>>(() => ({
  key: [
    { required: true, message: t('config.keyRequired'), trigger: 'blur' },
    {
      validator: (_rule, value: string, callback) => {
        const length = value.trim().length
        if (length < 2 || length > 128) {
          callback(new Error(t('config.keyLength')))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
  name: [
    { required: true, message: t('config.nameRequired'), trigger: 'blur' },
    {
      validator: (_rule, value: string, callback) => {
        const name = value.trim()
        if (!name) {
          callback(new Error(t('config.nameRequired')))
          return
        }
        if (name.length > 64) {
          callback(new Error(t('config.nameLength')))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
  description: [{ max: 255, message: t('config.descriptionLength'), trigger: 'blur' }],
}))

function resetForm(): void {
  form.key = ''
  form.name = ''
  form.value = ''
  form.description = ''
  form.enabled = true
}

function fillFromEditing(config: SystemConfig): void {
  form.key = config.key
  form.name = config.name
  form.value = config.value ?? ''
  form.description = config.description ?? ''
  form.enabled = config.enabled
}

watch(
  () => [props.modelValue, props.mode, props.editing] as const,
  ([open]) => {
    if (!open) return
    if (props.mode === 'edit' && props.editing) {
      fillFromEditing(props.editing)
    } else {
      resetForm()
    }
  },
  { immediate: true },
)

function buildPayload(): SystemConfigPayload | UpdateSystemConfigPayload {
  const name = form.name.trim()
  const value = form.value.trim() ? form.value : null
  const description = form.description.trim() || null

  if (props.mode === 'create') {
    return {
      key: form.key.trim(),
      name,
      value,
      description,
      enabled: form.enabled,
    }
  }

  return {
    name,
    value,
    description,
    enabled: form.enabled,
  }
}

async function handleSubmit(): Promise<void> {
  if (!formRef.value) return

  const keyLength = form.key.trim().length
  const nameLength = form.name.trim().length
  const descriptionLength = form.description.trim().length
  if (keyLength < 2 || keyLength > 128 || nameLength === 0 || nameLength > 64) {
    await formRef.value.validateField(['key', 'name']).catch(() => false)
    return
  }
  if (descriptionLength > 255) {
    await formRef.value.validateField('description').catch(() => false)
    return
  }

  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  emit('submit', buildPayload())
}

defineExpose({
  setSubmitting(value: boolean) {
    submitting.value = value
  },
})
</script>

<template>
  <el-dialog v-model="visible" :title="title" width="560px" destroy-on-close :teleported="false">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="108px">
      <el-form-item :label="t('config.key')" prop="key">
        <el-input v-model="form.key" maxlength="128" show-word-limit :disabled="mode === 'edit'" />
      </el-form-item>

      <el-form-item :label="t('config.name')" prop="name">
        <el-input v-model="form.name" maxlength="64" show-word-limit />
      </el-form-item>

      <el-form-item :label="t('config.value')" prop="value">
        <el-input v-model="form.value" type="textarea" :rows="3" />
      </el-form-item>

      <el-form-item :label="t('config.description')" prop="description">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="2"
          maxlength="255"
          show-word-limit
        />
      </el-form-item>

      <el-form-item :label="t('config.enabled')" prop="enabled">
        <el-switch v-model="form.enabled" />
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
