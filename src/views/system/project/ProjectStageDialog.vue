<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FormInstance, Rule } from 'antdv-next'
import {
  Button,
  DatePicker,
  Form,
  FormItem,
  Input,
  InputNumber,
  Modal,
  Select,
  TextArea,
} from 'antdv-next'
import dayjs, { type Dayjs } from 'dayjs'

import type { ProjectStage, ProjectStagePayload, UpdateProjectStagePayload } from '@/types/project'

interface Props {
  modelValue: boolean
  mode: 'create' | 'edit'
  editing?: ProjectStage | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: ProjectStagePayload | UpdateProjectStagePayload]
}>()

const { t } = useI18n()
const formRef = ref<FormInstance>()
const submitting = ref(false)

interface FormModel {
  name: string
  sort: number
  status: string | undefined
  plannedStartAt: Dayjs | null
  plannedEndAt: Dayjs | null
  actualStartAt: Dayjs | null
  actualEndAt: Dayjs | null
  description: string
}

const form = reactive<FormModel>({
  name: '',
  sort: 0,
  status: undefined,
  plannedStartAt: null,
  plannedEndAt: null,
  actualStartAt: null,
  actualEndAt: null,
  description: '',
})

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

const title = computed(() =>
  props.mode === 'create' ? t('project.stageCreateTitle') : t('project.stageEditTitle'),
)

const statusOptions = computed(() => [
  { label: t('project.stageStatusNOT_STARTED'), value: 'NOT_STARTED' },
  { label: t('project.stageStatusIN_PROGRESS'), value: 'IN_PROGRESS' },
  { label: t('project.stageStatusCOMPLETED'), value: 'COMPLETED' },
  { label: t('project.stageStatusBLOCKED'), value: 'BLOCKED' },
])

const rules = computed<Partial<Record<keyof FormModel, Rule[]>>>(() => ({
  name: [{ required: true, message: t('project.stageNameRequired'), trigger: 'blur' }],
}))

function toDayjs(value: string | null): Dayjs | null {
  if (!value) return null
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed : null
}

function toIsoString(value: Dayjs | null): string | undefined {
  return value?.isValid() ? value.toISOString() : undefined
}

function reset(): void {
  form.name = ''
  form.sort = 0
  form.status = undefined
  form.plannedStartAt = null
  form.plannedEndAt = null
  form.actualStartAt = null
  form.actualEndAt = null
  form.description = ''
}

function fill(s: ProjectStage): void {
  form.name = s.name
  form.sort = s.sort
  form.status = s.status
  form.plannedStartAt = toDayjs(s.plannedStartAt)
  form.plannedEndAt = toDayjs(s.plannedEndAt)
  form.actualStartAt = toDayjs(s.actualStartAt)
  form.actualEndAt = toDayjs(s.actualEndAt)
  form.description = s.description ?? ''
}

watch(
  () => [props.modelValue, props.mode, props.editing] as const,
  ([open]) => {
    if (!open) return
    if (props.mode === 'edit' && props.editing) fill(props.editing)
    else reset()
  },
  { immediate: true },
)

function buildPayload(): ProjectStagePayload | UpdateProjectStagePayload {
  const payload: ProjectStagePayload = {
    name: form.name.trim(),
    sort: form.sort,
  }
  if (form.status) payload.status = form.status as ProjectStagePayload['status']
  const a = toIsoString(form.plannedStartAt)
  const b = toIsoString(form.plannedEndAt)
  const actualStartAt = toIsoString(form.actualStartAt)
  const actualEndAt = toIsoString(form.actualEndAt)
  if (a) payload.plannedStartAt = a
  if (b) payload.plannedEndAt = b
  if (actualStartAt) payload.actualStartAt = actualStartAt
  if (actualEndAt) payload.actualEndAt = actualEndAt
  if (props.mode === 'edit') {
    const updatePayload = payload as UpdateProjectStagePayload
    if (!actualStartAt) updatePayload.actualStartAt = null
    if (!actualEndAt) updatePayload.actualEndAt = null
  }
  const desc = form.description.trim()
  if (desc) payload.description = desc
  return payload
}

async function handleSubmit(): Promise<void> {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  emit('submit', buildPayload())
}

defineExpose({ setSubmitting: (v: boolean) => (submitting.value = v) })
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
    <Form ref="formRef" :model="form" :rules="rules" layout="vertical">
      <FormItem :label="t('project.stageName')" name="name">
        <Input
          v-model:value="form.name"
          :maxlength="64"
          :placeholder="t('project.stageNamePlaceholder')"
        />
      </FormItem>
      <div class="grid grid-cols-2 gap-4">
        <FormItem :label="t('project.stageSort')" name="sort">
          <InputNumber v-model:value="form.sort" :min="0" :max="9999" class="w-full" />
        </FormItem>
        <FormItem :label="t('project.stageStatus')" name="status">
          <Select
            v-model:value="form.status"
            :options="statusOptions"
            allow-clear
            :placeholder="t('project.stageStatusPlaceholder')"
          />
        </FormItem>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <FormItem :label="t('project.stagePlannedStartAt')" name="plannedStartAt">
          <DatePicker v-model:value="form.plannedStartAt" class="w-full" show-time />
        </FormItem>
        <FormItem :label="t('project.stagePlannedEndAt')" name="plannedEndAt">
          <DatePicker v-model:value="form.plannedEndAt" class="w-full" show-time />
        </FormItem>
      </div>
      <div v-if="props.mode === 'edit'" class="grid grid-cols-2 gap-4">
        <FormItem :label="t('project.stageActualStartAt')" name="actualStartAt">
          <DatePicker v-model:value="form.actualStartAt" class="w-full" show-time />
        </FormItem>
        <FormItem :label="t('project.stageActualEndAt')" name="actualEndAt">
          <DatePicker v-model:value="form.actualEndAt" class="w-full" show-time />
        </FormItem>
      </div>
      <FormItem :label="t('project.stageDescription')" name="description">
        <TextArea v-model:value="form.description" :rows="2" :maxlength="255" />
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
