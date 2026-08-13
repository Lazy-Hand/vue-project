import type { FileCategory } from '@/types/file'

export const MIB = 1024 * 1024
export const GIB = 1024 * MIB

export const FILE_SIZE_LIMITS: Readonly<Record<FileCategory, number>> = {
  FILE: 5 * GIB,
  IMAGE: 10 * MIB,
  AUDIO: 50 * MIB,
  VIDEO: 5 * GIB,
}

export const MULTIPART_THRESHOLDS: Readonly<Partial<Record<FileCategory, number>>> = {
  FILE: 20 * MIB,
  VIDEO: 200 * MIB,
}

export const DEFAULT_PART_SIZE = 10 * MIB

const FILE_RULES: Readonly<
  Record<FileCategory, { extensions: readonly string[]; mimeTypes: readonly string[] }>
> = {
  FILE: {
    extensions: ['pdf'],
    mimeTypes: ['application/pdf'],
  },
  IMAGE: {
    extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'],
    mimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
  },
  AUDIO: {
    extensions: ['mp3', 'wav', 'ogg'],
    mimeTypes: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/ogg'],
  },
  VIDEO: {
    extensions: ['mp4', 'mov', 'webm'],
    mimeTypes: ['video/mp4', 'video/quicktime', 'video/webm'],
  },
}

export interface UploadFileLike {
  name: string
  size: number
  type?: string
}

export type FileValidationErrorCode = 'type' | 'size'

export interface FileValidationError {
  code: FileValidationErrorCode
  category: FileCategory
  maxBytes: number
  extensions: readonly string[]
}

export interface FileValidationResult {
  valid: boolean
  error?: FileValidationError
}

export function getFileExtension(name: string): string {
  const normalizedName = name.trim().toLowerCase()
  const separatorIndex = normalizedName.lastIndexOf('.')
  return separatorIndex >= 0 ? normalizedName.slice(separatorIndex + 1) : ''
}

export function getFileRule(category: FileCategory): (typeof FILE_RULES)[FileCategory] {
  return FILE_RULES[category]
}

export function validateFile(file: UploadFileLike, category: FileCategory): FileValidationResult {
  const rule = FILE_RULES[category]
  const extension = getFileExtension(file.name)
  const normalizedType = file.type?.trim().toLowerCase() ?? ''
  const extensionAllowed = rule.extensions.includes(extension)
  const mimeAllowed = normalizedType === '' || rule.mimeTypes.includes(normalizedType)

  if (!extensionAllowed || !mimeAllowed) {
    return {
      valid: false,
      error: {
        code: 'type',
        category,
        maxBytes: FILE_SIZE_LIMITS[category],
        extensions: rule.extensions,
      },
    }
  }

  if (file.size > FILE_SIZE_LIMITS[category]) {
    return {
      valid: false,
      error: {
        code: 'size',
        category,
        maxBytes: FILE_SIZE_LIMITS[category],
        extensions: rule.extensions,
      },
    }
  }

  return { valid: true }
}

export function isMultipartUpload(category: FileCategory, size: number): boolean {
  const threshold = MULTIPART_THRESHOLDS[category]
  return threshold !== undefined && size > threshold
}

export function splitFile(file: Blob, partSize: number): Blob[] {
  if (!Number.isFinite(partSize) || partSize <= 0) return [file]

  const parts: Blob[] = []
  for (let offset = 0; offset < file.size; offset += partSize) {
    parts.push(file.slice(offset, Math.min(offset + partSize, file.size)))
  }
  return parts
}

export function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.max(0, bytes)} B`
  if (bytes < MIB) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < GIB) return `${(bytes / MIB).toFixed(1)} MB`
  return `${(bytes / GIB).toFixed(2)} GB`
}

export interface Sha256Provider {
  digest(algorithm: 'SHA-256', data: ArrayBuffer): Promise<ArrayBuffer>
}

function getDefaultSha256Provider(): Sha256Provider {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) throw new Error('crypto_unavailable')
  return {
    digest: (algorithm, data) => subtle.digest(algorithm, data),
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function sha256Blob(
  blob: Blob,
  provider: Sha256Provider = getDefaultSha256Provider(),
): Promise<string> {
  const digest = await provider.digest('SHA-256', await blob.arrayBuffer())
  return bytesToHex(new Uint8Array(digest))
}
