<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FormInstance, Rule } from 'antdv-next'
import { Button, Form, FormItem, Input, Modal, Select, TextArea, message } from 'antdv-next'

import ProjectFilePicker, {
  type ProjectFilePickerExpose,
} from '@/components/ProjectFilePicker/index.vue'
import type { ProjectFileAsset } from '@/types/project-file'
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
  canManageFiles: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: ProjectDeliverablePayload | UpdateProjectDeliverablePayload]
}>()

const { t } = useI18n()
const formRef = ref<FormInstance>()
const filePickerRef = ref<ProjectFilePickerExpose>()
const submitting = ref(false)
const preparingFiles = ref(false)
const files = ref<ProjectFileAsset[]>([])

interface FormModel {
  name: string
  stageId: string | null | undefined
  version: string
  status: string | undefined
  description: string
}

const form = reactive<FormModel>({
  name: '',
  stageId: null,
  version: '',
  status: undefined,
  description: '',
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
}))

function reset(): void {
  form.name = ''
  form.stageId = null
  form.version = ''
  form.status = undefined
  form.description = ''
  files.value = []
}

function fill(d: ProjectDeliverable): void {
  form.name = d.name
  form.stageId = d.stageId ?? null
  form.version = d.version ?? ''
  form.status = d.status
  form.description = d.description ?? ''
  files.value = [...d.assets]
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

function buildPayload(
  assetIds?: string[],
): ProjectDeliverablePayload | UpdateProjectDeliverablePayload {
  const payload: ProjectDeliverablePayload = {
    name: form.name.trim(),
    ...(assetIds !== undefined ? { assetIds } : {}),
  }
  if (form.stageId) payload.stageId = form.stageId
  else if (props.mode === 'edit') payload.stageId = null
  const version = form.version.trim()
  if (version) payload.version = version
  if (form.status) payload.status = form.status as ProjectDeliverablePayload['status']
  const desc = form.description.trim()
  if (desc) payload.description = desc
  return payload
}

async function handleSubmit(): Promise<void> {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  preparingFiles.value = true
  try {
    const assetIds = props.canManageFiles
      ? ((await filePickerRef.value?.prepareFiles()) ?? [])
      : undefined
    if (props.canManageFiles && props.mode === 'create' && assetIds?.length === 0) {
      message.warning(t('project.deliverableFileRequired'))
      return
    }
    emit('submit', buildPayload(assetIds))
  } catch {
    message.error(t('projectFile.uploadFailed'))
  } finally {
    preparingFiles.value = false
  }
}

function commitFiles(): void {
  filePickerRef.value?.commitFiles()
}

async function rollbackFiles(): Promise<void> {
  await filePickerRef.value?.rollbackFiles()
}

defineExpose({
  setSubmitting: (value: boolean) => (submitting.value = value),
  commitFiles,
  rollbackFiles,
})
</script>

<template>
  <Modal
    v-model:open="visible"
    :title="title"
    width="560px"
    destroy-on-hidden
    :get-container="false"
    :confirm-loading="submitting || preparingFiles"
    :closable="!submitting && !preparingFiles"
    :mask-closable="!submitting && !preparingFiles"
  >
    <Form ref="formRef" :model="form" :rules="rules" layout="vertical">
      <FormItem :label="t('project.deliverableName')" name="name">
        <Input
          v-model:value="form.name"
          :maxlength="128"
          :placeholder="t('project.deliverableNamePlaceholder')"
        />
      </FormItem>
      <FormItem
        v-if="props.canManageFiles"
        :label="t('project.deliverableFile')"
        :required="props.mode === 'create'"
      >
        <ProjectFilePicker
          ref="filePickerRef"
          v-model="files"
          :project-id="props.projectId"
          kind="DELIVERABLE"
          :disabled="submitting || preparingFiles"
        />
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
      <Button :disabled="submitting || preparingFiles" @click="visible = false">
        {{ t('common.cancel') }}
      </Button>
      <Button type="primary" :loading="submitting || preparingFiles" @click="handleSubmit">{{
        t('common.confirm')
      }}</Button>
    </template>
  </Modal>
</template>
