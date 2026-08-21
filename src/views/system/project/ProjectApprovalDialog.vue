<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FormInstance, Rule } from 'antdv-next'
import { Button, Form, FormItem, Input, Modal, Select } from 'antdv-next'

import type { ApprovalDefinition } from '@/types/approval'
import {
  buildProjectApprovalPayload,
  type ApprovalType,
  type ProjectApprovalPayload,
} from '@/types/project'

interface Props {
  modelValue: boolean
  definitions: ApprovalDefinition[]
  approvalType: ApprovalType
  defaultTitle?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: ProjectApprovalPayload]
}>()

const { t } = useI18n()
const formRef = ref<FormInstance>()
const submitting = ref(false)

interface FormModel {
  definitionId: string | undefined
  title: string
}

const form = reactive<FormModel>({
  definitionId: undefined,
  title: '',
})

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

const definitionOptions = computed(() =>
  props.definitions.map((d) => ({ label: `${d.name} (${d.code})`, value: d.id })),
)

const approvalTypeLabel = computed(() => t(`project.approvalType${props.approvalType}` as never))

const rules = computed<Partial<Record<keyof FormModel, Rule[]>>>(() => ({
  definitionId: [
    { required: true, message: t('project.approvalDefinitionRequired'), trigger: 'change' },
  ],
}))

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    form.definitionId = undefined
    form.title = props.defaultTitle ?? ''
  },
  { immediate: true },
)

async function handleSubmit(): Promise<void> {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  const payload: ProjectApprovalPayload = buildProjectApprovalPayload(
    props.approvalType,
    String(form.definitionId),
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
    <Form ref="formRef" :model="form" :rules="rules" layout="vertical">
      <div class="mb-4 rounded border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-700">
        {{ t('project.approvalTypeHint', { type: approvalTypeLabel }) }}
      </div>
      <FormItem :label="t('project.approvalDefinition')" name="definitionId">
        <Select
          v-model:value="form.definitionId"
          :options="definitionOptions"
          show-search
          :placeholder="t('project.approvalDefinitionPlaceholder')"
        />
      </FormItem>
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
