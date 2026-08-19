<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Form, FormItem, Input, Modal, type FormInstance, type Rule } from 'antdv-next'

import RichEditor from '@/components/RichEditor/index.vue'
import type { Notice, NoticePayload, UpdateNoticePayload } from '@/types/notice'

interface Props {
  modelValue: boolean
  mode: 'create' | 'edit'
  editing?: Notice | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: NoticePayload | UpdateNoticePayload]
}>()

const { t } = useI18n()
const formRef = ref<FormInstance>()
const submitting = ref(false)

interface FormModel {
  title: string
  content: string
}

const form = reactive<FormModel>({
  title: '',
  content: '',
})

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const title = computed(() =>
  props.mode === 'create' ? t('notice.createTitle') : t('notice.editTitle'),
)

const rules = computed<Partial<Record<keyof FormModel, Rule[]>>>(() => ({
  title: [
    {
      validator: async (_rule, value) => {
        const titleValue = (typeof value === 'string' ? value : '').trim()
        if (!titleValue) {
          throw new Error(t('notice.titleRequired'))
        }
        if (titleValue.length > 255) {
          throw new Error(t('notice.titleMaxLength'))
        }
      },
      trigger: 'change',
    },
  ],
  content: [
    {
      validator: async (_rule, value) => {
        const contentValue = (typeof value === 'string' ? value : '').trim()
        if (!contentValue) {
          throw new Error(t('notice.contentRequired'))
        }
        if (contentValue.length > 100000) {
          throw new Error(t('notice.contentMaxLength'))
        }
      },
      trigger: 'change',
    },
  ],
}))

function resetForm(): void {
  form.title = ''
  form.content = ''
  formRef.value?.resetFields()
}

function syncFromEditing(notice?: Notice | null): void {
  if (notice) {
    form.title = notice.title
    form.content = notice.content
  } else {
    resetForm()
  }
}

watch(
  () => props.editing,
  (notice) => {
    syncFromEditing(notice)
  },
  { immediate: true },
)

watch(
  () => props.modelValue,
  (opened) => {
    if (opened) {
      syncFromEditing(props.editing)
    } else {
      resetForm()
    }
  },
)

function buildPayload(): NoticePayload | UpdateNoticePayload {
  const payload: NoticePayload = {
    title: form.title.trim(),
    content: form.content.trim(),
  }

  if (props.mode === 'create') return payload

  return {
    title: payload.title,
    content: payload.content,
  } satisfies UpdateNoticePayload
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
    width="780px"
    destroy-on-hidden
    :get-container="false"
    :confirm-loading="submitting"
  >
    <Form
      ref="formRef"
      :model="form"
      :rules="rules"
      :label-col="{ span: 4 }"
      :wrapper-col="{ span: 20 }"
    >
      <FormItem :label="t('notice.title')" name="title">
        <Input
          v-model:value="form.title"
          :maxlength="255"
          show-count
          :placeholder="t('notice.titlePlaceholder')"
        />
      </FormItem>

      <FormItem :label="t('notice.content')" name="content">
        <RichEditor
          v-model="form.content"
          :min-height="220"
          :max-height="450"
          :placeholder="t('notice.contentPlaceholder')"
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
