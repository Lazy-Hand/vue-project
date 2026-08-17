import type { ProgressHandler } from 'alova'

import { API_BASE_URL, request } from '@/utils/request'
import type { PaginatedResult } from '@/types/common'
import type {
  BindFileBusinessPayload,
  FileListQuery,
  InitiateMultipartUploadPayload,
  ManagedFile,
  MultipartUploadKind,
  MultipartUploadPart,
  MultipartUploadSession,
  UploadBusinessContext,
  UploadProgress,
  UploadRequest,
  UploadResponse,
} from '@/types/file'

export type UploadProgressHandler = (progress: UploadProgress) => void

const multipartBasePaths: Record<MultipartUploadKind, string> = {
  files: '/uploads/files/multipart',
  videos: '/uploads/videos/multipart',
}

function assertBusinessContext(context: UploadBusinessContext | undefined): void {
  const hasBusinessType = context?.businessType !== undefined
  const hasBusinessId = context?.businessId !== undefined

  if (hasBusinessType !== hasBusinessId) {
    throw new TypeError('businessType and businessId must be provided together')
  }
}

function appendBusinessContext(
  formData: FormData,
  context: UploadBusinessContext | undefined,
): void {
  assertBusinessContext(context)

  if (context?.businessType !== undefined && context.businessId !== undefined) {
    formData.append('businessType', context.businessType)
    formData.append('businessId', context.businessId)
  }
}

function appendQueryParam(
  params: Record<string, string | number>,
  key: string,
  value: string | number | undefined,
): void {
  if (value !== undefined && value !== '') params[key] = value
}

function createProgressHandler(onProgress: UploadProgressHandler): ProgressHandler {
  return ({ loaded, total }) => {
    const percent = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0
    onProgress({ loaded, total, percent })
  }
}

function createUploadRequest<T>(
  path: string,
  formData: FormData,
  onProgress?: UploadProgressHandler,
): UploadRequest<T> {
  const method = request.Post<T>(path, formData, { cacheFor: 0 })
  if (onProgress) method.onUpload(createProgressHandler(onProgress))

  return {
    response: method.send(),
    abort: async () => {
      await method.abort()
    },
  }
}

function createCategoryUploadRequest(
  path: string,
  file: File,
  context?: UploadBusinessContext,
  onProgress?: UploadProgressHandler,
): UploadRequest<UploadResponse> {
  const formData = new FormData()
  appendBusinessContext(formData, context)
  formData.append('file', file)
  return createUploadRequest<UploadResponse>(path, formData, onProgress)
}

export function fetchFileList(query: FileListQuery = {}): Promise<PaginatedResult<ManagedFile>> {
  const params: Record<string, string | number> = {
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 10,
  }
  appendQueryParam(params, 'category', query.category)
  appendQueryParam(params, 'businessType', query.businessType)
  appendQueryParam(params, 'businessId', query.businessId)
  appendQueryParam(params, 'keyword', query.keyword)
  appendQueryParam(params, 'startTime', query.startTime)
  appendQueryParam(params, 'endTime', query.endTime)

  return request.Get<PaginatedResult<ManagedFile>>('/file/list', {
    params,
    cacheFor: 0,
  })
}

export function deleteFile(id: string): Promise<void> {
  return request.Delete<void>(`/file/${encodeURIComponent(id)}`, {}, { cacheFor: 0 })
}

/** 为已上传文件补绑业务关联（如头像 USER_AVATAR + 用户 ID） */
export function bindFileBusiness(
  id: string,
  payload: BindFileBusinessPayload,
): Promise<ManagedFile> {
  return request.Patch<ManagedFile>(`/file/${encodeURIComponent(id)}/bind`, payload, {
    cacheFor: 0,
  })
}

export function buildFileUrl(path: string): string {
  if (!path) return ''
  if (path.startsWith('//')) return path
  if (/^[a-z][a-z\d+.-]*:/i.test(path)) return path

  const normalizedPath = path.replace(/^\/+/, '')
  const normalizedApiBase = API_BASE_URL.replace(/\/+$/, '')
  const apiOrigin = normalizedApiBase.match(/^https?:\/\/[^/]+/i)?.[0] ?? ''
  const apiBasePath = apiOrigin ? normalizedApiBase.slice(apiOrigin.length) : normalizedApiBase
  const normalizedBasePath = apiBasePath.replace(/^\/+/, '')

  if (
    normalizedPath === normalizedBasePath ||
    normalizedPath.startsWith(`${normalizedBasePath}/`)
  ) {
    return apiOrigin ? `${apiOrigin}/${normalizedPath}` : `/${normalizedPath}`
  }

  if (normalizedPath.startsWith('api/')) {
    return apiOrigin ? `${apiOrigin}/${normalizedPath}` : `/${normalizedPath}`
  }

  return `${normalizedApiBase}/${normalizedPath}`
}

export function createLegacyUploadRequest(
  file: File,
  context?: UploadBusinessContext,
  onProgress?: UploadProgressHandler,
): UploadRequest<UploadResponse> {
  return createCategoryUploadRequest('/uploads', file, context, onProgress)
}

export function createFileUploadRequest(
  file: File,
  context?: UploadBusinessContext,
  onProgress?: UploadProgressHandler,
): UploadRequest<UploadResponse> {
  return createCategoryUploadRequest('/uploads/files', file, context, onProgress)
}

export function createImageUploadRequest(
  file: File,
  context?: UploadBusinessContext,
  onProgress?: UploadProgressHandler,
): UploadRequest<UploadResponse> {
  return createCategoryUploadRequest('/uploads/images', file, context, onProgress)
}

export function createAudioUploadRequest(
  file: File,
  context?: UploadBusinessContext,
  onProgress?: UploadProgressHandler,
): UploadRequest<UploadResponse> {
  return createCategoryUploadRequest('/uploads/audios', file, context, onProgress)
}

export function createVideoUploadRequest(
  file: File,
  context?: UploadBusinessContext,
  onProgress?: UploadProgressHandler,
): UploadRequest<UploadResponse> {
  return createCategoryUploadRequest('/uploads/videos', file, context, onProgress)
}

export function initiateMultipartUpload(
  kind: MultipartUploadKind,
  payload: InitiateMultipartUploadPayload,
): Promise<MultipartUploadSession> {
  assertBusinessContext(payload)
  const { originalName, mimeType, totalSize, businessType, businessId } = payload
  return request.Post<MultipartUploadSession>(
    multipartBasePaths[kind],
    {
      originalName,
      mimeType,
      totalSize,
      ...(businessType !== undefined && businessId !== undefined
        ? { businessType, businessId }
        : {}),
    },
    { cacheFor: 0 },
  )
}

export function fetchMultipartUploadStatus(
  kind: MultipartUploadKind,
  uploadId: string,
): Promise<MultipartUploadSession> {
  return request.Get<MultipartUploadSession>(
    `${multipartBasePaths[kind]}/${encodeURIComponent(uploadId)}`,
    { cacheFor: 0 },
  )
}

export function createMultipartPartUploadRequest(
  kind: MultipartUploadKind,
  uploadId: string,
  partNumber: number,
  blob: Blob,
  checksum: string,
  onProgress?: UploadProgressHandler,
): UploadRequest<MultipartUploadPart> {
  const formData = new FormData()
  formData.append('file', blob)

  const method = request.Put<MultipartUploadPart>(
    `${multipartBasePaths[kind]}/${encodeURIComponent(uploadId)}/parts/${partNumber}`,
    formData,
    {
      cacheFor: 0,
      headers: { 'x-part-sha256': checksum },
    },
  )
  if (onProgress) method.onUpload(createProgressHandler(onProgress))

  return {
    response: method.send(),
    abort: async () => {
      await method.abort()
    },
  }
}

export function completeMultipartUpload(
  kind: MultipartUploadKind,
  uploadId: string,
): Promise<UploadResponse> {
  return request.Post<UploadResponse>(
    `${multipartBasePaths[kind]}/${encodeURIComponent(uploadId)}/complete`,
    {},
    { cacheFor: 0 },
  )
}

export function abortMultipartUpload(kind: MultipartUploadKind, uploadId: string): Promise<void> {
  return request.Delete<void>(
    `${multipartBasePaths[kind]}/${encodeURIComponent(uploadId)}`,
    {},
    { cacheFor: 0 },
  )
}
