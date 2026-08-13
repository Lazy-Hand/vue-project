export type FileCategory = 'FILE' | 'IMAGE' | 'AUDIO' | 'VIDEO'

export interface ManagedFile {
  id: string
  originalName: string
  filename: string
  path: string
  mimeType: string
  category: FileCategory
  size: number
  businessType: string | null
  businessId: string | null
  createdAt: string
  updatedAt: string
}

export interface FileListQuery {
  page?: number
  pageSize?: number
  category?: FileCategory
  businessType?: string
  businessId?: string
  keyword?: string
  startTime?: string
  endTime?: string
}

export interface UploadResponse {
  id: string
  originalName: string
  filename: string
  mimetype: string
  category: FileCategory
  size: number
  path: string
  url: string
  businessType: string | null
  businessId: string | null
}

export interface UploadBusinessContext {
  businessType?: string
  businessId?: string
}

export interface InitiateMultipartUploadPayload extends UploadBusinessContext {
  originalName: string
  mimeType: string
  totalSize: number
}

export interface MultipartUploadPart {
  partNumber: number
  size: number
  checksum: string
}

export type MultipartUploadKind = 'files' | 'videos'

export interface MultipartUploadSession {
  uploadId: string
  category: FileCategory
  status: 'UPLOADING' | 'COMPLETING' | 'COMPLETED'
  originalName: string
  mimeType: string
  totalSize: number
  partSize: number
  totalParts: number
  uploadedParts: MultipartUploadPart[]
  missingPartNumbers: number[]
  expiresAt: string
  completedFileId?: string | null
}

export interface UploadProgress {
  loaded: number
  total: number
  percent: number
}

export interface UploadRequest<T> {
  response: Promise<T>
  abort: () => Promise<void>
}
