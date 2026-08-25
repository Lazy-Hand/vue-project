import type { FileCategory } from '@/types/file'

export type ProjectFileAssetKind =
  | 'ATTACHMENT'
  | 'MATERIAL'
  | 'RESEARCH_RECORD'
  | 'DELIVERABLE'
  | 'PRD_VERSION'

export type ProjectFileAssetStatus =
  | 'STAGED'
  | 'ACTIVE'
  | 'DISCARDED'
  | 'DELETE_PENDING'
  | 'DELETE_FAILED'

export type ProjectFileParseStatus =
  | 'NOT_STARTED'
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'

export type ProjectFileLinkTargetType =
  | 'PROJECT'
  | 'MATERIAL'
  | 'RESEARCH_RECORD'
  | 'DELIVERABLE'
  | 'PRD_VERSION'

export interface ProjectFileMetadata {
  id: string
  originalName: string
  filename: string
  path: string
  mimeType: string
  category: FileCategory
  size: number
  createdAt: string
  updatedAt: string
}

export interface ProjectFileLink {
  id: string
  projectId: string
  assetId: string
  targetType: ProjectFileLinkTargetType
  targetId: string
  sort: number
  createdAt: string
}

export interface ProjectFileAsset {
  id: string
  projectId: string
  fileId: string
  kind: ProjectFileAssetKind
  status: ProjectFileAssetStatus
  parseStatus: ProjectFileParseStatus
  extractedText: string | null
  parseMetadata: Record<string, unknown> | null
  parseError: string | null
  parsedAt: string | null
  downloadUrl: string
  file: ProjectFileMetadata
  links?: ProjectFileLink[]
  createdAt: string
  updatedAt: string
}

export interface ProjectFileAssetQuery {
  page?: number
  pageSize?: number
  kind?: ProjectFileAssetKind
  status?: ProjectFileAssetStatus
}

export interface LinkProjectFileAssetsPayload {
  assetIds: string[]
  targetType: ProjectFileLinkTargetType
  targetId?: string
  sort?: number
}
