import type { ProgressHandler } from 'alova'

import { blobRequest, request } from '@/utils/request'
import type { PaginatedResult } from '@/types/common'
import type { UploadProgress } from '@/types/file'
import type {
  LinkProjectFileAssetsPayload,
  ProjectFileAsset,
  ProjectFileAssetKind,
  ProjectFileAssetQuery,
} from '@/types/project-file'

export type ProjectFileUploadProgressHandler = (progress: UploadProgress) => void

function createProgressHandler(onProgress: ProjectFileUploadProgressHandler): ProgressHandler {
  return ({ loaded, total }) => {
    const percent = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0
    onProgress({ loaded, total, percent })
  }
}

export function fetchProjectFileAssets(
  projectId: string,
  query: ProjectFileAssetQuery = {},
): Promise<PaginatedResult<ProjectFileAsset>> {
  return request.Get<PaginatedResult<ProjectFileAsset>>(
    `/project/${encodeURIComponent(projectId)}/file-assets`,
    {
      params: {
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 100,
        ...(query.kind ? { kind: query.kind } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      cacheFor: 0,
    },
  )
}

export function uploadProjectFileAsset(
  projectId: string,
  file: File,
  kind: ProjectFileAssetKind,
  onProgress?: ProjectFileUploadProgressHandler,
): Promise<ProjectFileAsset> {
  const formData = new FormData()
  formData.append('file', file)
  const method = request.Post<ProjectFileAsset>(
    `/project/${encodeURIComponent(projectId)}/file-assets/upload`,
    formData,
    { params: { kind }, cacheFor: 0 },
  )
  if (onProgress) method.onUpload(createProgressHandler(onProgress))
  return method.send()
}

export function linkProjectFileAssets(
  projectId: string,
  payload: LinkProjectFileAssetsPayload,
): Promise<ProjectFileAsset[]> {
  return request.Post<ProjectFileAsset[]>(
    `/project/${encodeURIComponent(projectId)}/file-assets/links`,
    payload,
    { cacheFor: 0 },
  )
}

export function unlinkProjectFileLink(projectId: string, linkId: string): Promise<void> {
  return request.Delete<void>(
    `/project/${encodeURIComponent(projectId)}/file-assets/links/${encodeURIComponent(linkId)}`,
    {},
    { cacheFor: 0 },
  )
}

export function discardProjectFileAsset(
  projectId: string,
  assetId: string,
): Promise<ProjectFileAsset> {
  return request.Post<ProjectFileAsset>(
    `/project/${encodeURIComponent(projectId)}/file-assets/${encodeURIComponent(assetId)}/discard`,
    {},
    { cacheFor: 0 },
  )
}

export function deleteProjectFileAsset(projectId: string, assetId: string): Promise<void> {
  return request.Delete<void>(
    `/project/${encodeURIComponent(projectId)}/file-assets/${encodeURIComponent(assetId)}`,
    {},
    { cacheFor: 0 },
  )
}

export function fetchProjectFileAssetBlob(projectId: string, assetId: string): Promise<Blob> {
  return blobRequest.Get<Blob>(
    `/project/${encodeURIComponent(projectId)}/file-assets/${encodeURIComponent(assetId)}/download`,
    { cacheFor: 0 },
  )
}

export async function downloadProjectFileAsset(
  projectId: string,
  asset: ProjectFileAsset,
): Promise<void> {
  const blob = await fetchProjectFileAssetBlob(projectId, asset.id)
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = asset.file.originalName
  anchor.click()
  URL.revokeObjectURL(objectUrl)
}
