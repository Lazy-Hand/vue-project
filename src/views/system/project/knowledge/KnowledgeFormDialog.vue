<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Form, FormItem, Input, Modal, Select, Space, message } from 'antdv-next'

import ProjectFilePicker, {
  type ProjectFilePickerExpose,
} from '@/components/ProjectFilePicker/index.vue'
import { usePermission } from '@/composables/usePermission'
import type { ProjectFileAsset, ProjectFileAssetKind } from '@/types/project-file'

export interface KnowledgeFormOption {
  label: string
  value: string
}

export interface KnowledgeFormField {
  key: string
  label: string
  placeholder: string
  type?: 'input' | 'textarea' | 'select'
  options?: KnowledgeFormOption[]
  required?: boolean
  rows?: number
}

interface Props {
  open: boolean
  title: string
  fields: KnowledgeFormField[]
  modelValue: Record<string, string>
  submitting?: boolean
  projectId?: string
  fileKind?: ProjectFileAssetKind
  fileAssets?: ProjectFileAsset[]
}

const props = withDefaults(defineProps<Props>(), {
  submitting: false,
  projectId: undefined,
  fileKind: undefined,
  fileAssets: () => [],
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  submit: [value: Record<string, string>, assetIds?: string[]]
}>()

const { t } = useI18n()
const { hasPermission } = usePermission()
const form = reactive<Record<string, string>>({})
const filePickerRef = ref<ProjectFilePickerExpose>()
const selectedFiles = ref<ProjectFileAsset[]>([])
const preparingFiles = ref(false)
const hasFileSection = computed(
  () => Boolean(props.projectId && props.fileKind) && hasPermission('system:project:manageFiles'),
)

const visible = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
})

watch(
  () => [props.open, props.modelValue] as const,
  ([open]) => {
    if (!open) return
    for (const field of props.fields) form[field.key] = props.modelValue[field.key] ?? ''
    selectedFiles.value = [...props.fileAssets]
  },
  { immediate: true },
)

async function handleSubmit(): Promise<void> {
  if (!hasFileSection.value) {
    emit('submit', { ...form })
    return
  }

  preparingFiles.value = true
  try {
    const assetIds = (await filePickerRef.value?.prepareFiles()) ?? []
    emit('submit', { ...form }, assetIds)
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

defineExpose({ commitFiles, rollbackFiles })
</script>

<template>
  <Modal
    v-model:open="visible"
    :title="title"
    width="640px"
    destroy-on-hidden
    :get-container="false"
    :confirm-loading="submitting || preparingFiles"
    :closable="!submitting && !preparingFiles"
    :mask-closable="!submitting && !preparingFiles"
    class="knowledge-form-dialog"
  >
    <Form layout="vertical" class="pt-1">
      <FormItem
        v-for="field in fields"
        :key="field.key"
        :label="field.label"
        :required="field.required"
      >
        <Select
          v-if="field.type === 'select'"
          v-model:value="form[field.key]"
          :options="field.options"
          :placeholder="field.placeholder"
          allow-clear
          class="w-full"
        />
        <Input.TextArea
          v-else-if="field.type === 'textarea'"
          v-model:value="form[field.key]"
          :rows="field.rows ?? 4"
          :placeholder="field.placeholder"
          allow-clear
        />
        <Input
          v-else
          v-model:value="form[field.key]"
          :placeholder="field.placeholder"
          :maxlength="field.key === 'content' ? undefined : 512"
          allow-clear
        />
      </FormItem>
      <FormItem v-if="hasFileSection" :label="t('projectFile.relatedFiles')">
        <ProjectFilePicker
          v-if="props.projectId && props.fileKind"
          ref="filePickerRef"
          v-model="selectedFiles"
          :project-id="props.projectId"
          :kind="props.fileKind"
          :disabled="submitting || preparingFiles"
        />
      </FormItem>
    </Form>
    <template #footer>
      <Space>
        <Button :disabled="submitting || preparingFiles" @click="visible = false">
          {{ t('common.cancel') }}
        </Button>
        <Button type="primary" :loading="submitting || preparingFiles" @click="handleSubmit">
          {{ t('common.confirm') }}
        </Button>
      </Space>
    </template>
  </Modal>
</template>

<style scoped lang="scss">
.knowledge-form-dialog {
  :deep(.ant-form-item) {
    margin-bottom: 16px;
  }
}
</style>
