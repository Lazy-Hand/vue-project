<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Modal, Result, Tag, Upload, message } from 'antdv-next'
import type { UploadProps } from 'antdv-next'
import { DownloadOutlined, InboxOutlined } from '@antdv-next/icons'
import { ApiRequestError } from '@/utils/request'

export interface ImportErrorItem {
  row: number
  message: string
}

export interface ImportResultData {
  total: number
  success: number
  failed: number
  errors: ImportErrorItem[]
}

interface Props {
  modelValue: boolean
  /** 弹窗标题 */
  title: string
  /** 弹窗内说明文案 */
  tip?: string
  /** 模板下载文件名（缺省用 title） */
  templateFileName?: string
  /** 接受的文件类型，默认 .xlsx,.xls */
  accept?: string
  /** 下载模板（需返回 xlsx blob） */
  downloadTemplate: () => Promise<Blob>
  /** 执行导入，返回逐行处理结果 */
  onImport: (file: File) => Promise<ImportResultData>
}

const props = withDefaults(defineProps<Props>(), {
  tip: '',
  templateFileName: '',
  accept: '.xlsx,.xls',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  success: [result: ImportResultData]
}>()

const { t } = useI18n()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const importing = ref(false)
const templateLoading = ref(false)
const result = ref<ImportResultData | null>(null)

const allSuccess = computed(() => result.value !== null && result.value.failed === 0)

function reset(): void {
  result.value = null
  importing.value = false
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) reset()
  },
)

async function handleDownloadTemplate(): Promise<void> {
  templateLoading.value = true
  try {
    const blob = await props.downloadTemplate()
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = props.templateFileName || `${props.title}.xlsx`
    anchor.click()
    URL.revokeObjectURL(objectUrl)
  } catch (error) {
    const errorMessage =
      error instanceof ApiRequestError ? error.message : t('import.templateDownloadFailed')
    message.error(errorMessage)
  } finally {
    templateLoading.value = false
  }
}

const handleSelectFile: UploadProps['beforeUpload'] = async (file) => {
  importing.value = true
  try {
    const importResult = await props.onImport(file as File)
    result.value = importResult
    if (importResult.failed === 0) {
      message.success(t('import.allSuccess', { total: importResult.total }))
    } else {
      message.warning(
        t('import.partialSuccess', {
          success: importResult.success,
          failed: importResult.failed,
        }),
      )
    }
    emit('success', importResult)
  } catch (error) {
    const errorMessage = error instanceof ApiRequestError ? error.message : t('import.importFailed')
    message.error(errorMessage)
  } finally {
    importing.value = false
  }

  return false // 阻止组件默认自动上传
}

function handleClose(): void {
  visible.value = false
}
</script>

<template>
  <Modal
    v-model:open="visible"
    :title="title"
    :width="520"
    :footer="null"
    :confirm-loading="importing"
    destroy-on-hidden
    @cancel="handleClose"
  >
    <!-- 导入结果 -->
    <div v-if="result" class="import-result">
      <Result
        :status="allSuccess ? 'success' : 'warning'"
        :title="
          allSuccess
            ? t('import.allSuccess', { total: result.total })
            : t('import.partialSuccess', { success: result.success, failed: result.failed })
        "
      />
      <div v-if="result.errors.length > 0" class="import-errors">
        <div
          v-for="item in result.errors"
          :key="`${item.row}-${item.message}`"
          class="import-error-row"
        >
          <Tag color="red">#{{ item.row }}</Tag>
          <span>{{ item.message }}</span>
        </div>
      </div>
      <div class="import-result-actions">
        <Button @click="handleClose">{{ t('common.close') }}</Button>
        <Button type="primary" @click="reset">{{ t('import.importAgain') }}</Button>
      </div>
    </div>

    <!-- 模板下载 + 文件选择 -->
    <div v-else class="import-body">
      <p v-if="tip" class="import-tip">{{ tip }}</p>

      <div class="import-template-row">
        <span class="import-template-hint">{{ t('import.templateHint') }}</span>
        <Button size="small" :loading="templateLoading" @click="handleDownloadTemplate">
          <DownloadOutlined />
          {{ t('import.downloadTemplate') }}
        </Button>
      </div>

      <Upload.Dragger
        :before-upload="handleSelectFile"
        :show-upload-list="false"
        :accept="accept"
        :disabled="importing"
      >
        <p class="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p class="ant-upload-text">{{ t('import.dragHint') }}</p>
        <p class="ant-upload-hint">{{ t('import.fileHint') }}</p>
      </Upload.Dragger>
    </div>
  </Modal>
</template>

<style scoped>
.import-tip {
  margin: 0 0 16px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
}

.import-template-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.import-template-hint {
  color: #475569;
  font-size: 13px;
}

.import-errors {
  max-height: 240px;
  overflow: auto;
  padding: 8px 4px;
}

.import-error-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 4px 0;
  font-size: 13px;
  color: #334155;
}

.import-result-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
</style>
