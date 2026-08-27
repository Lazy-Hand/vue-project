<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Button,
  Form,
  FormItem,
  Input,
  Modal,
  Switch,
  TextArea,
  type FormInstance,
  type Rule,
} from 'antdv-next'

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
  group: string
  enabled: boolean
}

const form = reactive<FormModel>({
  key: '',
  name: '',
  value: '',
  description: '',
  group: 'general',
  enabled: true,
})

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const title = computed(() =>
  props.mode === 'create' ? t('config.createTitle') : t('config.editTitle'),
)

const rules = computed<Partial<Record<keyof FormModel, Rule[]>>>(() => ({
  key: [
    {
      validator: async (_rule, value) => {
        const key = (typeof value === 'string' ? value : '').trim()
        if (!key) {
          throw new Error(t('config.keyRequired'))
        }
        if (key.length < 2 || key.length > 128) {
          throw new Error(t('config.keyLength'))
        }
      },
      trigger: 'blur',
    },
  ],
  name: [
    {
      validator: async (_rule, value) => {
        const name = (typeof value === 'string' ? value : '').trim()
        if (!name) {
          throw new Error(t('config.nameRequired'))
        }
        if (name.length > 64) {
          throw new Error(t('config.nameLength'))
        }
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
  form.group = 'general'
  form.enabled = true
}

function fillFromEditing(config: SystemConfig): void {
  form.key = config.key
  form.name = config.name
  form.value = config.value ?? ''
  form.description = config.description ?? ''
  form.group = config.group
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
  const group = form.group.trim() || 'general'

  if (props.mode === 'create') {
    return {
      key: form.key.trim(),
      name,
      value,
      description,
      group,
      enabled: form.enabled,
    }
  }

  return {
    name,
    value,
    description,
    group,
    enabled: form.enabled,
  }
}

async function handleSubmit(): Promise<void> {
  if (!formRef.value) return
  const valid = await formRef.value
    .validate()
    .then(() => true)
    .catch(() => false)
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
  <Modal
    v-model:open="visible"
    :title="title"
    width="560px"
    destroy-on-hidden
    :get-container="false"
    :confirm-loading="submitting"
  >
    <Form
      ref="formRef"
      :model="form"
      :rules="rules"
      :label-col="{ span: 5 }"
      :wrapper-col="{ span: 19 }"
    >
      <FormItem :label="t('config.key')" name="key">
        <Input
          v-model:value="form.key"
          :maxlength="128"
          show-count
          :disabled="mode === 'edit'"
          :placeholder="t('config.keyPlaceholder')"
        />
      </FormItem>

      <FormItem :label="t('config.name')" name="name">
        <Input
          v-model:value="form.name"
          :maxlength="64"
          show-count
          :placeholder="t('config.namePlaceholder')"
        />
      </FormItem>

      <FormItem :label="t('config.value')" name="value">
        <TextArea
          v-model:value="form.value"
          :rows="3"
          :placeholder="t('config.valuePlaceholder')"
        />
      </FormItem>

      <FormItem :label="t('config.group')" name="group">
        <Input
          v-model:value="form.group"
          :maxlength="64"
          show-count
          :placeholder="t('config.groupPlaceholder')"
        />
      </FormItem>

      <FormItem :label="t('config.description')" name="description">
        <TextArea
          v-model:value="form.description"
          :rows="2"
          :maxlength="255"
          show-count
          :placeholder="t('config.descriptionPlaceholder')"
        />
      </FormItem>

      <FormItem :label="t('config.enabled')" name="enabled">
        <Switch v-model:checked="form.enabled" />
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
