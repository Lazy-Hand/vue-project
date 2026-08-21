<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FormInstance, Rule } from 'antdv-next'
import { Button, Form, FormItem, Input, Modal, Select, TextArea } from 'antdv-next'

import FileUpload from '@/components/FileUpload/index.vue'
import { buildFileUrl } from '@/api/file'
import type { UploadResponse } from '@/types/file'
import type {
  ProjectDeliverable,
  ProjectDeliverablePayload,
  UpdateProjectDeliverablePayload,
} from '@/types/project'
import type { ProjectStage } from '@/types/project'

interface Props {
  modelValue: boolean
  mode: 'create' | 'edit'
  projectId: string
  editing?: ProjectDeliverable | null
  stages: ProjectStage[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: ProjectDeliverablePayload | UpdateProjectDeliverablePayload]
}>()

const { t } = useI18n()
const formRef = ref<FormInstance>()
const submitting = ref(false)

interface FormModel {
  name: string
  stageId: string | null | undefined
  version: string
  status: string | undefined
  description: string
  fileId: string | undefined
  fileName: string
  filePath: string
}

const form = reactive<FormModel>({
  name: '',
  stageId: null,
  version: '',
  status: undefined,
  description: '',
  fileId: undefined,
  fileName: '',
  filePath: '',
})

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

const title = computed(() =>
  props.mode === 'create' ? t('project.deliverableCreateTitle') : t('project.deliverableEditTitle'),
)

const stageOptions = computed(() => props.stages.map((s) => ({ label: s.name, value: s.id })))

const statusOptions = computed(() => [
  { label: t('project.deliverableStatusDRAFT'), value: 'DRAFT' },
  { label: t('project.deliverableStatusSUBMITTED'), value: 'SUBMITTED' },
  { label: t('project.deliverableStatusACCEPTED'), value: 'ACCEPTED' },
  { label: t('project.deliverableStatusREJECTED'), value: 'REJECTED' },
])

const rules = computed<Partial<Record<keyof FormModel, Rule[]>>>(() => ({
  name: [{ required: true, message: t('project.deliverableNameRequired'), trigger: 'blur' }],
  fileId: [
    {
      validator: async (_rule, value) => {
        if (props.mode === 'create' && !value) throw new Error(t('project.deliverableFileRequired'))
      },
      trigger: 'change',
    },
  ],
}))

function reset(): void {
  form.name = ''
  form.stageId = null
  form.version = ''
  form.status = undefined
  form.description = ''
  form.fileId = undefined
  form.fileName = ''
  form.filePath = ''
}

function fill(d: ProjectDeliverable): void {
  form.name = d.name
  form.stageId = d.stageId ?? null
  form.version = d.version ?? ''
  form.status = d.status
  form.description = d.description ?? ''
  form.fileId = d.fileId ?? d.file?.id ?? undefined
  form.fileName = d.file?.originalName ?? ''
  form.filePath = d.file?.path ?? ''
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

function buildPayload(): ProjectDeliverablePayload | UpdateProjectDeliverablePayload {
  const payload: ProjectDeliverablePayload = {
    name: form.name.trim(),
  }
  if (form.stageId) payload.stageId = form.stageId
  else if (props.mode === 'edit') payload.stageId = null
  if (form.fileId) payload.fileId = form.fileId
  const version = form.version.trim()
  if (version) payload.version = version
  if (form.status) payload.status = form.status as ProjectDeliverablePayload['status']
  const desc = form.description.trim()
  if (desc) payload.description = desc
  return payload
}

function handleFileSuccess(response: UploadResponse): void {
  form.fileId = response.id
  form.fileName = response.originalName
  form.filePath = response.path
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
      <FormItem :label="t('project.deliverableName')" name="name">
        <Input
          v-model:value="form.name"
          :maxlength="128"
          :placeholder="t('project.deliverableNamePlaceholder')"
        />
      </FormItem>
      <FormItem :label="t('project.deliverableFile')" name="fileId">
        <FileUpload
          category="FILE"
          :max-count="1"
          :business-type="'PROJECT_DELIVERABLE'"
          :business-id="props.projectId"
          @success="handleFileSuccess"
        />
        <a
          v-if="form.fileId && form.fileName && form.filePath"
          :href="buildFileUrl(form.filePath)"
          target="_blank"
          rel="noreferrer"
          class="mt-2 block text-sm text-blue-600 hover:text-blue-700"
        >
          {{ form.fileName }}
        </a>
      </FormItem>
      <div class="grid grid-cols-2 gap-4">
        <FormItem :label="t('project.deliverableStage')" name="stageId">
          <Select
            v-model:value="form.stageId"
            :options="stageOptions"
            allow-clear
            :placeholder="t('project.deliverableStagePlaceholder')"
          />
        </FormItem>
        <FormItem :label="t('project.deliverableVersion')" name="version">
          <Input
            v-model:value="form.version"
            :maxlength="32"
            :placeholder="t('project.deliverableVersionPlaceholder')"
          />
        </FormItem>
      </div>
      <FormItem :label="t('project.deliverableStatus')" name="status">
        <Select
          v-model:value="form.status"
          :options="statusOptions"
          allow-clear
          :placeholder="t('project.deliverableStatusPlaceholder')"
        />
      </FormItem>
      <FormItem :label="t('project.deliverableDescription')" name="description">
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
