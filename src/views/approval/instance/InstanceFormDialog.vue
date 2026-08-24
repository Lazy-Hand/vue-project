<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  CheckboxGroup,
  Form,
  FormItem,
  Input,
  Modal,
  Select,
  Switch,
  TextArea,
  message,
} from 'antdv-next'
import type { FormInstance } from 'antdv-next'

import {
  createApprovalInstance,
  fetchApprovalDefinition,
  fetchApprovalDefinitions,
} from '@/api/approval'
import type { ApprovalDefinition } from '@/types/approval'
import { ApiRequestError } from '@/utils/request'

interface RenderField {
  id: string
  type: string
  label: string
  required: boolean
  options?: { label: string; value: string | number }[]
}

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
}>({
  definitionId: '',
  title: '',
  businessType: '',
  businessId: '',
})

// B2-03/F2-03：按所选定义的表单 Schema 渲染控件，取代原始 JSON 输入
const renderFields = ref<RenderField[]>([])
const fieldValues = reactive<Record<string, unknown>>({})

const definitionOptions = computed(() =>
  definitions.value
    .filter((d) => d.enabled && d.publishedVersion !== null && d.publishedVersion !== undefined)
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

function parseFields(definition: ApprovalDefinition): RenderField[] {
  const schema = definition.formSchema
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return []
  const rawFields = (schema as Record<string, unknown>)['fields']
  if (!Array.isArray(rawFields)) return []
  const fields: RenderField[] = []
  for (const raw of rawFields) {
    if (!raw || typeof raw !== 'object') continue
    const item = raw as Record<string, unknown>
    if (typeof item.id !== 'string' || typeof item.type !== 'string') continue
    fields.push({
      id: item.id,
      type: item.type,
      label: typeof item.label === 'string' ? item.label : item.id,
      required: item.required === true,
      options: Array.isArray(item.options)
        ? (item.options as { label: string; value: string | number }[])
        : undefined,
    })
  }
  return fields
}

watch(
  () => formState.definitionId,
  async (definitionId) => {
    renderFields.value = []
    Object.keys(fieldValues).forEach((key) => delete fieldValues[key])
    if (!definitionId) return
    try {
      const detail = await fetchApprovalDefinition(definitionId)
      renderFields.value = parseFields(detail)
    } catch {
      // ignore：保留无动态字段的表单
    }
  },
)

watch(
  () => props.open,
  (val) => {
    if (val) {
      formState.definitionId = ''
      formState.title = ''
      formState.businessType = ''
      formState.businessId = ''
      renderFields.value = []
      Object.keys(fieldValues).forEach((key) => delete fieldValues[key])
      void loadDefinitions()
    }
  },
)

function isEmptyValue(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0)
  )
}

function buildFormData(): Record<string, unknown> | undefined {
  const data: Record<string, unknown> = {}
  let hasValue = false
  for (const field of renderFields.value) {
    const value = fieldValues[field.id]
    if (isEmptyValue(value)) continue
    data[field.id] = value
    hasValue = true
  }
  return hasValue ? data : undefined
}

async function handleSubmit(): Promise<void> {
  if (!formState.definitionId) {
    message.warning(t('approval.instance.definitionRequired'))
    return
  }
  if (!formState.title.trim()) {
    message.warning(t('approval.instance.titleRequired'))
    return
  }

  // 客户端必填校验；最终以后端 Schema 校验为准（B2-05）
  for (const field of renderFields.value) {
    if (field.required && isEmptyValue(fieldValues[field.id])) {
      message.warning(`${field.label}: ${t('approval.instance.fieldRequired')}`)
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
      formData: buildFormData(),
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

      <!-- 动态表单字段：按发布版本的表单 Schema 渲染 -->
      <template v-for="field in renderFields" :key="field.id">
        <FormItem :label="field.label" :required="field.required">
          <Select
            v-if="field.type === 'select'"
            v-model:value="(fieldValues as Record<string, unknown>)[field.id]"
            :options="field.options"
            :placeholder="t('approval.instance.fieldPlaceholder')"
            :get-popup-container="getPopupContainer"
          />
          <CheckboxGroup
            v-else-if="field.type === 'checkbox'"
            v-model:value="(fieldValues as Record<string, string[]>)[field.id]"
            :options="field.options"
          />
          <Switch
            v-else-if="field.type === 'switch'"
            :checked="Boolean((fieldValues as Record<string, unknown>)[field.id])"
            @change="(val) => ((fieldValues as Record<string, unknown>)[field.id] = Boolean(val))"
          />
          <TextArea
            v-else-if="field.type === 'textarea'"
            v-model:value="(fieldValues as Record<string, string>)[field.id]"
            :rows="3"
            :maxlength="500"
          />
          <Input
            v-else
            v-model:value="(fieldValues as Record<string, string>)[field.id]"
            :type="field.type === 'number' || field.type === 'money' ? 'number' : 'text'"
            :placeholder="
              field.type === 'date' || field.type === 'daterange'
                ? t('approval.instance.dateIsoPlaceholder')
                : t('approval.instance.fieldPlaceholder')
            "
          />
        </FormItem>
      </template>

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
    </Form>
  </Modal>
</template>
