<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Form, FormItem, Input, Modal, Select, TextArea, message } from 'antdv-next'
import type { FormInstance } from 'antdv-next'

import { createApprovalInstance, fetchApprovalDefinitions } from '@/api/approval'
import type { ApprovalDefinition } from '@/types/approval'
import { ApiRequestError } from '@/utils/request'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean]; success: [] }>()

const { t } = useI18n()
const formRef = ref<FormInstance>()
const submitting = ref(false)
const definitions = ref<ApprovalDefinition[]>([])
const loadingDefs = ref(false)

const formState = reactive<{
  definitionId: string
  title: string
  businessType: string
  businessId: string
  formDataJson: string
}>({
  definitionId: '',
  title: '',
  businessType: '',
  businessId: '',
  formDataJson: '',
})

const definitionOptions = computed(() =>
  definitions.value
    .filter((d) => d.enabled)
    .map((d) => ({ label: `${d.name} (${d.code})`, value: d.id })),
)

async function loadDefinitions(): Promise<void> {
  loadingDefs.value = true
  try {
    const result = await fetchApprovalDefinitions({ page: 1, pageSize: 100, enabled: true })
    definitions.value = result.items
  } catch {
    // ignore
  } finally {
    loadingDefs.value = false
  }
}

watch(
  () => props.open,
  (val) => {
    if (val) {
      formState.definitionId = ''
      formState.title = ''
      formState.businessType = ''
      formState.businessId = ''
      formState.formDataJson = ''
      void loadDefinitions()
    }
  },
)

async function handleSubmit(): Promise<void> {
  if (!formState.definitionId) {
    message.warning(t('approval.instance.definitionRequired'))
    return
  }
  if (!formState.title.trim()) {
    message.warning(t('approval.instance.titleRequired'))
    return
  }

  let formData: Record<string, unknown> | undefined
  if (formState.formDataJson.trim()) {
    try {
      formData = JSON.parse(formState.formDataJson) as Record<string, unknown>
    } catch {
      message.error(t('approval.instance.formDataInvalid'))
      return
    }
  }

  submitting.value = true
  try {
    await createApprovalInstance({
      definitionId: formState.definitionId,
      title: formState.title.trim(),
      businessType: formState.businessType.trim() || undefined,
      businessId: formState.businessId.trim() || undefined,
      formData,
    })
    message.success(t('approval.instance.createSuccess'))
    emit('update:open', false)
    emit('success')
  } catch (error) {
    const msg =
      error instanceof ApiRequestError
        ? error.message
        : error instanceof Error
          ? error.message
          : t('approval.requestFailed')
    message.error(msg)
  } finally {
    submitting.value = false
  }
}

function handleCancel(): void {
  emit('update:open', false)
}

function getPopupContainer(triggerNode?: HTMLElement): HTMLElement {
  return triggerNode?.parentElement ?? document.body
}
</script>

<template>
  <Modal
    :open="open"
    :title="t('approval.instance.createTitle')"
    width="560px"
    destroy-on-hidden
    :confirm-loading="submitting"
    :get-container="false"
    @ok="handleSubmit"
    @cancel="handleCancel"
  >
    <Form ref="formRef" :model="formState" layout="vertical">
      <FormItem :label="t('approval.instance.definition')" required>
        <Select
          v-model:value="formState.definitionId"
          :options="definitionOptions"
          :placeholder="t('approval.instance.definitionPlaceholder')"
          :loading="loadingDefs"
          :get-popup-container="getPopupContainer"
          show-search
          :filter-option="
            (input: string, option: { label: string }) =>
              option.label.toLowerCase().includes(input.toLowerCase())
          "
        />
      </FormItem>

      <FormItem :label="t('approval.instance.titleLabel')" required>
        <Input
          v-model:value="formState.title"
          :placeholder="t('approval.instance.titlePlaceholder')"
          :maxlength="255"
          show-count
        />
      </FormItem>

      <div class="grid grid-cols-2 gap-3">
        <FormItem :label="t('approval.instance.businessType')">
          <Input
            v-model:value="formState.businessType"
            :placeholder="t('approval.instance.businessTypePlaceholder')"
            :maxlength="64"
          />
        </FormItem>
        <FormItem :label="t('approval.instance.businessId')">
          <Input
            v-model:value="formState.businessId"
            :placeholder="t('approval.instance.businessIdPlaceholder')"
            :maxlength="128"
          />
        </FormItem>
      </div>

      <FormItem :label="t('approval.instance.formData')">
        <TextArea
          v-model:value="formState.formDataJson"
          :placeholder="t('approval.instance.formDataPlaceholder')"
          :rows="4"
          class="font-mono text-xs"
        />
      </FormItem>
    </Form>
  </Modal>
</template>
