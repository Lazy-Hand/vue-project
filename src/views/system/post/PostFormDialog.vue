<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FormInstance, Rule } from 'antdv-next'
import { Button, Form, FormItem, Input, InputNumber, Modal, Switch, TextArea } from 'antdv-next'

import type { Post, PostPayload, UpdatePostPayload } from '@/types/post'

interface Props {
  modelValue: boolean
  mode: 'create' | 'edit'
  editing?: Post | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: PostPayload | UpdatePostPayload]
}>()

const { t } = useI18n()
const formRef = ref<FormInstance>()
const submitting = ref(false)

interface FormModel {
  code: string
  name: string
  sort: number
  enabled: boolean
  description: string
}

const form = reactive<FormModel>({
  code: '',
  name: '',
  sort: 0,
  enabled: true,
  description: '',
})

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const title = computed(() =>
  props.mode === 'create' ? t('post.createTitle') : t('post.editTitle'),
)

const rules = computed<Partial<Record<keyof FormModel, Rule[]>>>(() => ({
  code: [
    { required: true, message: t('post.codeRequired'), trigger: 'blur' },
    {
      validator: async (_rule, value) => {
        const length = (typeof value === 'string' ? value : '').trim().length
        if (length < 2 || length > 64) throw new Error(t('post.codeLength'))
      },
      trigger: 'blur',
    },
  ],
  name: [
    { required: true, message: t('post.nameRequired'), trigger: 'blur' },
    {
      validator: async (_rule, value) => {
        const name = (typeof value === 'string' ? value : '').trim()
        if (!name) throw new Error(t('post.nameRequired'))
        if (name.length > 64) throw new Error(t('post.nameLength'))
      },
      trigger: 'blur',
    },
  ],
  description: [{ max: 255, message: t('post.descriptionLength'), trigger: 'blur' }],
}))

function resetForm(): void {
  form.code = ''
  form.name = ''
  form.sort = 0
  form.enabled = true
  form.description = ''
}

function fillFromEditing(post: Post): void {
  form.code = post.code
  form.name = post.name
  form.sort = post.sort
  form.enabled = post.enabled
  form.description = post.description ?? ''
}

watch(
  () => [props.modelValue, props.mode, props.editing] as const,
  ([open]) => {
    if (!open) return
    if (props.mode === 'edit' && props.editing) fillFromEditing(props.editing)
    else resetForm()
  },
  { immediate: true },
)

function buildPayload(): PostPayload | UpdatePostPayload {
  const name = form.name.trim()
  const description = form.description.trim()

  if (props.mode === 'create') {
    const payload: PostPayload = {
      code: form.code.trim(),
      name,
      sort: form.sort,
      enabled: form.enabled,
    }
    if (description) payload.description = description
    return payload
  }

  const payload: UpdatePostPayload = {
    name,
    sort: form.sort,
    enabled: form.enabled,
  }
  if (description) payload.description = description
  return payload
}

async function handleSubmit(): Promise<void> {
  if (!formRef.value) return
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
  <Modal
    v-model:open="visible"
    :title="title"
    width="560px"
    destroy-on-hidden
    :get-container="false"
    :confirm-loading="submitting"
  >
    <Form ref="formRef" :model="form" :rules="rules" class="post-form">
      <FormItem :label="t('post.code')" name="code">
        <Input v-model:value="form.code" :maxlength="64" show-count :disabled="mode === 'edit'" />
      </FormItem>

      <FormItem :label="t('post.name')" name="name">
        <Input v-model:value="form.name" :maxlength="64" show-count />
      </FormItem>

      <FormItem :label="t('post.sort')" name="sort">
        <InputNumber v-model:value="form.sort" :min="0" :max="9999" class="w-full" />
      </FormItem>

      <FormItem :label="t('post.description')" name="description">
        <TextArea v-model:value="form.description" :rows="2" :maxlength="255" show-count />
      </FormItem>

      <FormItem :label="t('post.enabled')" name="enabled">
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
