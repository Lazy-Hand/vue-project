<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Form, FormItem, Input, Modal } from 'antdv-next'

import {
  buildProjectApprovalPayload,
  type ApprovalType,
  type ProjectApprovalPayload,
} from '@/types/project'

interface Props {
  modelValue: boolean
  approvalType: ApprovalType
  defaultTitle?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: ProjectApprovalPayload]
}>()

const { t } = useI18n()
const formRef = ref()
const submitting = ref(false)

interface FormModel {
  title: string
}

const form = reactive<FormModel>({
  title: '',
})

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

const approvalTypeLabel = computed(() => t(`project.approvalType${props.approvalType}` as never))

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    form.title = props.defaultTitle ?? ''
  },
  { immediate: true },
)

async function handleSubmit(): Promise<void> {
  // B2-03：流程版本由服务端按场景绑定解析，业务用户只确认类型与标题
  const payload: ProjectApprovalPayload = buildProjectApprovalPayload(
    props.approvalType,
    form.title,
  )
  emit('submit', payload)
}

defineExpose({ setSubmitting: (v: boolean) => (submitting.value = v) })
</script>

<template>
  <Modal
    v-model:open="visible"
    :title="t('project.approvalCreateTitle', { type: approvalTypeLabel })"
    width="520px"
    destroy-on-hidden
    :get-container="false"
    :confirm-loading="submitting"
  >
    <Form ref="formRef" :model="form" layout="vertical">
      <div class="mb-4 rounded border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-700">
        {{ t('project.approvalTypeHint', { type: approvalTypeLabel }) }}
      </div>
      <div
        class="mb-4 rounded border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-600"
      >
        {{ t('project.approvalBindingHint') }}
      </div>
      <FormItem :label="t('project.approvalTitle')" name="title">
        <Input
          v-model:value="form.title"
          :maxlength="255"
          :placeholder="t('project.approvalTitlePlaceholder')"
        />
      </FormItem>
    </Form>
    <template #footer>
      <Button @click="visible = false">{{ t('common.cancel') }}</Button>
      <Button type="primary" :loading="submitting" @click="handleSubmit">{{
        t('common.confirm')
      }}</Button>
    </template>
  </Modal>
</template>
