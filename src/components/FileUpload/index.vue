<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Progress, Tag, UploadDragger, type UploadProps } from 'antdv-next'
import {
  CheckCircleOutlined,
  CloseOutlined,
  CloudUploadOutlined,
  InboxOutlined,
  ReloadOutlined,
} from '@antdv-next/icons'

import {
  abortMultipartUpload,
  completeMultipartUpload,
  createAudioUploadRequest,
  createFileUploadRequest,
  createImageUploadRequest,
  createVideoUploadRequest,
  createMultipartPartUploadRequest,
  initiateMultipartUpload,
} from '@/api/file'
import type { FileCategory, UploadBusinessContext, UploadResponse } from '@/types/file'
import {
  clampProgress,
  DEFAULT_PART_SIZE,
  FILE_SIZE_LIMITS,
  formatBytes,
  getFileRule,
  isMultipartUpload,
  sha256Blob,
  splitFile,
  validateFile,
} from './utils'

interface Props {
  category?: FileCategory
  multiple?: boolean
  maxCount?: number
  businessType?: string
  businessId?: string
  disabled?: boolean
  accept?: string
  autoUpload?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  category: 'FILE',
  multiple: false,
  maxCount: 1,
  businessType: undefined,
  businessId: undefined,
  disabled: false,
  accept: undefined,
  autoUpload: true,
})

const emit = defineEmits<{
  success: [response: UploadResponse, file: File]
  error: [error: unknown, file: File]
  change: [responses: UploadResponse[]]
}>()

export interface FileUploadExpose {
  upload: () => Promise<void>
  clear: () => void
  getUploadedFiles: () => UploadResponse[]
}

type UploadStatus = 'queued' | 'uploading' | 'success' | 'error' | 'cancelled'
type MultipartUploadKind = 'files' | 'videos'
type UploadBeforeFile = Parameters<NonNullable<UploadProps['beforeUpload']>>[0]

interface RequestHandle<T> {
  response: PromiseLike<T> | T
  abort: () => void | Promise<void>
}

interface QueueItem {
  uid: string
  file: File
  status: UploadStatus
  percent: number
  response?: UploadResponse
  error?: unknown
  abort?: () => void | Promise<void>
  uploadId?: string
  multipartKind?: MultipartUploadKind
  cancelRequested: boolean
  multipartAbortCalled: boolean
}

const { t } = useI18n()
const queue = ref<QueueItem[]>([])
const feedback = ref<string>()
const uidSeed = ref(0)
let queueUpload: Promise<void> | undefined

const effectiveMaxCount = computed(() =>
  Math.max(1, Math.floor(Number.isFinite(props.maxCount) ? props.maxCount : 1)),
)
const categoryLabel = computed(() => t(`fileUpload.category${capitalize(props.category)}`))
const categoryColor = computed(() => {
  if (props.category === 'IMAGE') return 'blue'
  if (props.category === 'AUDIO') return 'purple'
  if (props.category === 'VIDEO') return 'orange'
  return 'cyan'
})
const resolvedAccept = computed(() => {
  if (props.accept?.trim()) return props.accept
  return getFileRule(props.category)
    .extensions.map((extension) => `.${extension}`)
    .join(',')
})
const acceptDescription = computed(() =>
  getFileRule(props.category)
    .extensions.map((extension) => extension.toUpperCase())
    .join(' / '),
)
const sizeDescription = computed(() => formatBytes(FILE_SIZE_LIMITS[props.category]))
const uploadedResponses = computed(() =>
  queue.value.flatMap((item) => (item.response ? [item.response] : [])),
)

function capitalize(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase()
}

function patchItem(item: QueueItem, patch: Partial<QueueItem>): void {
  Object.assign(item, patch)
  queue.value = [...queue.value]
}

function nextUid(): string {
  uidSeed.value += 1
  return `file-upload-${uidSeed.value}`
}

function emitChange(): void {
  emit('change', [...uploadedResponses.value])
}

function readProgress(value: unknown): number {
  if (typeof value === 'number') return clampProgress(value)
  if (!isRecord(value)) return 0

  const percentage = value.percentage ?? value.percent
  if (typeof percentage === 'number') return clampProgress(percentage)

  const loaded = value.loaded
  const total = value.total
  if (typeof loaded === 'number' && typeof total === 'number' && total > 0) {
    return clampProgress((loaded / total) * 100)
  }
  return 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

async function resolveApiValue<T>(value: unknown): Promise<T> {
  const resolved = await value
  if (isRecord(resolved) && 'response' in resolved) {
    return resolveApiValue<T>(resolved.response)
  }
  if (isRecord(resolved) && 'data' in resolved && !('uploadId' in resolved)) {
    return resolveApiValue<T>(resolved.data)
  }
  return resolved as T
}

function resolveBusinessContext(): UploadBusinessContext | undefined {
  const businessType = props.businessType?.trim()
  const businessId = props.businessId?.trim()
  if (Boolean(businessType) !== Boolean(businessId)) {
    throw new Error('business_context_incomplete')
  }
  return businessType && businessId ? { businessType, businessId } : undefined
}

function createRegularRequest(
  file: File,
  context: UploadBusinessContext | undefined,
  onProgress: (value: unknown) => void,
): RequestHandle<UploadResponse> {
  switch (props.category) {
    case 'IMAGE':
      return createImageUploadRequest(file, context, onProgress)
    case 'AUDIO':
      return createAudioUploadRequest(file, context, onProgress)
    case 'VIDEO':
      return createVideoUploadRequest(file, context, onProgress)
    default:
      return createFileUploadRequest(file, context, onProgress)
  }
}

function multipartKind(): MultipartUploadKind {
  return props.category === 'VIDEO' ? 'videos' : 'files'
}

function getSessionValue(session: unknown): { uploadId: string; partSize: number } {
  const candidate = isRecord(session) && 'data' in session ? session.data : session
  if (!isRecord(candidate)) throw new Error('multipart_session_invalid')

  const uploadId = candidate.uploadId ?? candidate.upload_id ?? candidate.id
  if (typeof uploadId !== 'string' || !uploadId) throw new Error('multipart_session_invalid')

  const partSizeValue = candidate.partSize ?? candidate.part_size ?? candidate.chunkSize
  const partSize =
    typeof partSizeValue === 'number' && partSizeValue > 0 ? partSizeValue : DEFAULT_PART_SIZE
  return { uploadId, partSize }
}

async function uploadRegular(
  item: QueueItem,
  context: UploadBusinessContext | undefined,
): Promise<UploadResponse> {
  const request = createRegularRequest(item.file, context, (value) => {
    patchItem(item, { percent: readProgress(value) })
  })
  item.abort = request.abort
  const response = await resolveApiValue<UploadResponse>(request.response)
  if (item.cancelRequested) throw new Error('upload_cancelled')
  return response
}

async function abortMultipartSession(item: QueueItem): Promise<void> {
  if (!item.uploadId || !item.multipartKind || item.multipartAbortCalled) return
  item.multipartAbortCalled = true
  await Promise.resolve(abortMultipartUpload(item.multipartKind, item.uploadId)).catch(
    () => undefined,
  )
}

async function uploadMultipart(
  item: QueueItem,
  context: UploadBusinessContext | undefined,
): Promise<UploadResponse> {
  const kind = multipartKind()
  item.multipartKind = kind
  type InitPayload = Parameters<typeof initiateMultipartUpload>[1]
  const payload = {
    originalName: item.file.name,
    mimeType: item.file.type,
    totalSize: item.file.size,
    ...(context
      ? {
          businessType: context.businessType,
          businessId: context.businessId,
        }
      : {}),
  } as InitPayload
  const session = getSessionValue(
    await resolveApiValue<unknown>(initiateMultipartUpload(kind, payload)),
  )
  item.uploadId = session.uploadId
  if (item.cancelRequested) {
    await abortMultipartSession(item)
    throw new Error('upload_cancelled')
  }
  const parts = splitFile(item.file, session.partSize)
  for (let index = 0; index < parts.length; index += 1) {
    if (item.cancelRequested) throw new Error('upload_cancelled')
    const part = parts[index]
    if (!part) continue
    const checksum = await sha256Blob(part)
    if (item.cancelRequested) throw new Error('upload_cancelled')
    const partRequest = createMultipartPartUploadRequest(
      kind,
      session.uploadId,
      index + 1,
      part,
      checksum,
      (value: unknown) => {
        const partProgress = readProgress(value)
        patchItem(item, { percent: ((index + partProgress / 100) / parts.length) * 100 })
      },
    )
    item.abort = partRequest.abort
    await resolveApiValue<unknown>(partRequest.response)
    item.abort = undefined
    patchItem(item, { percent: ((index + 1) / parts.length) * 100 })
  }

  const response = await resolveApiValue<UploadResponse>(
    completeMultipartUpload(kind, session.uploadId),
  )
  if (item.cancelRequested) throw new Error('upload_cancelled')
  return response
}

async function uploadItem(item: QueueItem): Promise<void> {
  if (item.status === 'uploading' || item.status === 'success') return
  item.cancelRequested = false
  item.multipartAbortCalled = false
  patchItem(item, { status: 'uploading', percent: 0, error: undefined })

  try {
    const context = resolveBusinessContext()
    const response = isMultipartUpload(props.category, item.file.size)
      ? await uploadMultipart(item, context)
      : await uploadRegular(item, context)
    patchItem(item, {
      status: 'success',
      percent: 100,
      response,
      abort: undefined,
    })
    emit('success', response, item.file)
    emitChange()
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : ''
    const publicMessage =
      errorCode === 'business_context_incomplete'
        ? t('fileUpload.contextError')
        : errorCode === 'multipart_session_invalid'
          ? t('fileUpload.multipartError')
          : t('fileUpload.uploadError')
    if (errorCode !== 'upload_cancelled') feedback.value = publicMessage
    if (item.cancelRequested || (error instanceof Error && error.message === 'upload_cancelled')) {
      return
    }
    await abortMultipartSession(item)
    patchItem(item, { status: 'error', error, abort: undefined })
    emit('error', new Error(publicMessage), item.file)
  }
}

async function processQueue(): Promise<void> {
  for (const item of queue.value) {
    if (queue.value.includes(item) && item.status === 'queued') await uploadItem(item)
  }
}

function scheduleUpload(): void {
  if (queueUpload) return
  const task = processQueue()
  queueUpload = task
  void task.finally(() => {
    if (queueUpload === task) {
      queueUpload = undefined
      if (props.autoUpload && queue.value.some((item) => item.status === 'queued')) {
        scheduleUpload()
      }
    }
  })
}

async function upload(): Promise<void> {
  if (queueUpload) {
    await queueUpload
    return
  }
  const task = processQueue()
  queueUpload = task
  try {
    await task
  } finally {
    if (queueUpload === task) {
      queueUpload = undefined
      if (props.autoUpload && queue.value.some((item) => item.status === 'queued')) {
        scheduleUpload()
      }
    }
  }
}

function validationMessage(code: 'type' | 'size', maxBytes: number): string {
  if (code === 'type') return t('fileUpload.typeError', { category: categoryLabel.value })
  return t('fileUpload.sizeError', { size: formatBytes(maxBytes) })
}

function enqueue(file: File): void {
  const validation = validateFile(file, props.category)
  if (!validation.valid) {
    const message = validation.error
      ? validationMessage(validation.error.code, validation.error.maxBytes)
      : t('fileUpload.uploadError')
    feedback.value = message
    emit('error', new Error(message), file)
    return
  }

  if (queue.value.length >= effectiveMaxCount.value) {
    const message = t('fileUpload.countError', { count: effectiveMaxCount.value })
    feedback.value = message
    emit('error', new Error(message), file)
    return
  }

  const item: QueueItem = {
    uid: nextUid(),
    file,
    status: 'queued',
    percent: 0,
    cancelRequested: false,
    multipartAbortCalled: false,
  }
  feedback.value = undefined
  queue.value = [...queue.value, item]
  if (props.autoUpload) scheduleUpload()
}

function handleBeforeUpload(file: UploadBeforeFile): false {
  enqueue(file as unknown as File)
  return false
}

async function cancelItem(item: QueueItem): Promise<void> {
  if (item.status === 'success' || item.status === 'cancelled' || item.cancelRequested) return
  item.cancelRequested = true
  const abort = item.abort
  item.abort = undefined
  if (abort) await Promise.resolve(abort()).catch(() => undefined)
  await abortMultipartSession(item)
  patchItem(item, { status: 'cancelled' })
}

function retryItem(item: QueueItem): void {
  if (item.status !== 'error' && item.status !== 'cancelled') return
  patchItem(item, {
    status: 'queued',
    percent: 0,
    error: undefined,
    response: undefined,
    uploadId: undefined,
    multipartKind: undefined,
    cancelRequested: false,
    multipartAbortCalled: false,
  })
  if (props.autoUpload) scheduleUpload()
}

function removeItem(item: QueueItem): void {
  if (item.status === 'uploading') {
    void cancelItem(item).then(() => {
      queue.value = queue.value.filter((candidate) => candidate !== item)
      emitChange()
    })
    return
  }
  queue.value = queue.value.filter((candidate) => candidate !== item)
  emitChange()
}

function clear(): void {
  for (const item of queue.value) {
    if (item.status === 'uploading') void cancelItem(item)
  }
  queue.value = []
  feedback.value = undefined
  emitChange()
}

function getUploadedFiles(): UploadResponse[] {
  return [...uploadedResponses.value]
}

function statusLabel(status: UploadStatus, percent: number): string {
  if (status === 'uploading') return t('fileUpload.uploading', { percent: Math.round(percent) })
  if (status === 'success') return t('fileUpload.success')
  if (status === 'error') return t('fileUpload.error')
  if (status === 'cancelled') return t('fileUpload.cancelled')
  return t('fileUpload.pending')
}

defineExpose<FileUploadExpose>({ upload, clear, getUploadedFiles })
</script>

<template>
  <section class="file-upload" :aria-label="t('fileUpload.shelfLabel')">
    <div class="file-upload__header">
      <div class="file-upload__eyebrow">
        <span class="file-upload__eyebrow-mark" aria-hidden="true" />
        {{ t('fileUpload.shelfLabel') }}
      </div>
      <Tag :color="categoryColor" class="file-upload__category">
        {{ categoryLabel }}
      </Tag>
    </div>

    <UploadDragger
      class="file-upload__dragger"
      :multiple="props.multiple"
      :max-count="effectiveMaxCount"
      :accept="resolvedAccept"
      :disabled="props.disabled"
      :before-upload="handleBeforeUpload"
      :show-upload-list="false"
      :open-file-dialog-on-click="!props.disabled"
    >
      <div class="file-upload__drop-content">
        <div class="file-upload__drop-icon" aria-hidden="true">
          <InboxOutlined />
        </div>
        <p class="file-upload__drop-title">{{ t('fileUpload.dropHint') }}</p>
        <p class="file-upload__drop-meta">
          {{ t('fileUpload.acceptHint', { extensions: acceptDescription, size: sizeDescription }) }}
        </p>
      </div>
    </UploadDragger>

    <p v-if="feedback" class="file-upload__feedback" role="alert">{{ feedback }}</p>

    <ul v-if="queue.length" class="file-upload__queue" :aria-label="t('fileUpload.shelfLabel')">
      <li
        v-for="item in queue"
        :key="item.uid"
        class="file-upload__item"
        :class="`is-${item.status}`"
      >
        <div class="file-upload__item-icon" aria-hidden="true">
          <CheckCircleOutlined v-if="item.status === 'success'" />
          <CloudUploadOutlined v-else />
        </div>
        <div class="file-upload__item-main">
          <div class="file-upload__item-heading">
            <span class="file-upload__item-name" :title="item.file.name">{{ item.file.name }}</span>
            <span class="file-upload__item-size">{{ formatBytes(item.file.size) }}</span>
          </div>
          <Progress
            v-if="item.status === 'uploading' || item.status === 'success'"
            :percent="item.percent"
            :show-info="false"
            :status="item.status === 'success' ? 'success' : 'active'"
            size="small"
          />
          <div class="file-upload__item-status">{{ statusLabel(item.status, item.percent) }}</div>
        </div>
        <Button
          v-if="item.status === 'error' || item.status === 'cancelled'"
          type="text"
          size="small"
          class="file-upload__item-action"
          :disabled="props.disabled"
          :aria-label="t('fileUpload.retry')"
          @click.stop="retryItem(item)"
        >
          <ReloadOutlined />
        </Button>
        <Button
          v-else-if="item.status === 'uploading' || item.status === 'queued'"
          type="text"
          size="small"
          class="file-upload__item-action"
          :disabled="props.disabled"
          :aria-label="t('fileUpload.cancel')"
          @click.stop="void cancelItem(item)"
        >
          <CloseOutlined />
        </Button>
        <Button
          v-else
          type="text"
          size="small"
          class="file-upload__item-action"
          :disabled="props.disabled"
          :aria-label="t('fileUpload.remove')"
          @click.stop="removeItem(item)"
        >
          <CloseOutlined />
        </Button>
      </li>
    </ul>

    <div v-if="queue.length" class="file-upload__footer">
      <Button
        v-if="!props.autoUpload"
        type="primary"
        size="small"
        :disabled="props.disabled"
        @click="void upload()"
      >
        <CloudUploadOutlined />
        {{ t('fileUpload.uploadAction') }}
      </Button>
      <Button type="link" size="small" :disabled="props.disabled" @click="clear">
        {{ t('fileUpload.clearAction') }}
      </Button>
    </div>
  </section>
</template>

<style scoped lang="scss">
.file-upload {
  --file-upload-ink: #102331;
  --file-upload-muted: #6c7f8c;
  --file-upload-line: #d8e3e8;
  --file-upload-accent: #0e7490;
  --file-upload-surface: #f7fbfc;
  color: var(--file-upload-ink);
  min-width: 0;
}

.file-upload__header,
.file-upload__item-heading,
.file-upload__footer {
  display: flex;
  align-items: center;
}

.file-upload__header {
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.file-upload__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--file-upload-muted);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.file-upload__eyebrow-mark {
  width: 0.85rem;
  height: 0.2rem;
  border-radius: 99px;
  background: var(--file-upload-accent);
}

.file-upload__category {
  margin-inline-end: 0;
  font-size: 0.72rem;
}

.file-upload__dragger {
  overflow: hidden;
  border: 1px dashed color-mix(in srgb, var(--file-upload-accent) 42%, var(--file-upload-line));
  background:
    linear-gradient(90deg, transparent 0 49%, rgb(14 116 144 / 5%) 49% 51%, transparent 51%) 0
      100% / 1.8rem 100%,
    var(--file-upload-surface);
  transition:
    border-color 160ms ease,
    background-color 160ms ease;
}

.file-upload__dragger:hover,
.file-upload__dragger:focus-within {
  border-color: var(--file-upload-accent);
  background-color: #f0f9fa;
}

.file-upload__drop-content {
  padding: 1.2rem 1rem 1.25rem;
}

.file-upload__drop-icon {
  display: grid;
  place-items: center;
  width: 2.3rem;
  height: 2.3rem;
  margin: 0 auto 0.55rem;
  border: 1px solid rgb(14 116 144 / 24%);
  border-radius: 0.65rem;
  color: var(--file-upload-accent);
  background: #fff;
  font-size: 1.15rem;
}

.file-upload__drop-title {
  margin: 0;
  color: var(--file-upload-ink);
  font-size: 0.84rem;
  font-weight: 600;
}

.file-upload__drop-meta {
  margin: 0.4rem 0 0;
  color: var(--file-upload-muted);
  font-size: 0.72rem;
}

.file-upload__feedback {
  margin: 0.5rem 0 0;
  color: #b42318;
  font-size: 0.75rem;
}

.file-upload__queue {
  display: grid;
  gap: 0.4rem;
  margin: 0.65rem 0 0;
  padding: 0;
  list-style: none;
}

.file-upload__item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--file-upload-line);
  border-radius: 0.55rem;
  background: #fff;
}

.file-upload__item.is-error {
  border-color: #f2b8b5;
  background: #fffafa;
}

.file-upload__item.is-cancelled {
  background: #fbfcfc;
}

.file-upload__item-icon {
  flex: 0 0 auto;
  color: var(--file-upload-accent);
  font-size: 1rem;
}

.is-success .file-upload__item-icon {
  color: #16845b;
}

.is-error .file-upload__item-icon,
.is-cancelled .file-upload__item-icon {
  color: #b42318;
}

.file-upload__item-main {
  min-width: 0;
  flex: 1;
}

.file-upload__item-heading {
  min-width: 0;
  justify-content: space-between;
  gap: 0.5rem;
}

.file-upload__item-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.78rem;
  font-weight: 600;
}

.file-upload__item-size {
  flex: 0 0 auto;
  color: var(--file-upload-muted);
  font-size: 0.68rem;
}

.file-upload__item-status {
  margin-top: 0.2rem;
  color: var(--file-upload-muted);
  font-size: 0.68rem;
}

.is-error .file-upload__item-status {
  color: #b42318;
}

.file-upload__item-action {
  flex: 0 0 auto;
  min-width: 1.6rem;
  color: var(--file-upload-muted);
}

.file-upload__item-action:focus-visible {
  outline: 2px solid var(--file-upload-accent);
  outline-offset: 2px;
}

.file-upload__footer {
  justify-content: flex-end;
  gap: 0.4rem;
  margin-top: 0.55rem;
}

@media (max-width: 480px) {
  .file-upload__drop-content {
    padding-inline: 0.65rem;
  }

  .file-upload__item-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.1rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .file-upload__dragger {
    transition: none;
  }
}
</style>
