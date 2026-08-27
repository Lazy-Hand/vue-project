import { blobRequest, request } from '@/utils/request'
import type { PaginatedResult, PaginationQuery } from '@/types/common'
import type {
  ImportTemplate,
  ImportTemplatePayload,
  UpdateImportTemplatePayload,
} from '@/types/import-template'

export function fetchImportTemplateList(
  query: PaginationQuery & { keyword?: string; businessKey?: string } = {},
): Promise<PaginatedResult<ImportTemplate>> {
  return request.Get<PaginatedResult<ImportTemplate>>('/import-template/list', {
    params: {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
      ...(query.keyword ? { keyword: query.keyword } : {}),
      ...(query.businessKey ? { businessKey: query.businessKey } : {}),
    },
    cacheFor: 0,
  })
}

/** 上传模板文件（multipart：businessKey/name/description + file）。 */
export function uploadImportTemplate(
  payload: ImportTemplatePayload,
  file: File,
): Promise<ImportTemplate> {
  const form = new FormData()
  form.append('businessKey', payload.businessKey)
  form.append('name', payload.name)
  if (payload.description) form.append('description', payload.description)
  form.append('file', file)
  return request.Post<ImportTemplate>('/import-template', form, { cacheFor: 0 })
}

export function updateImportTemplate(
  id: string,
  payload: UpdateImportTemplatePayload,
): Promise<ImportTemplate> {
  return request.Patch<ImportTemplate>(`/import-template/${id}`, payload, {
    cacheFor: 0,
  })
}

/** 替换模板文件（不改变版本号，替换时后端同样校验表头）。 */
export function replaceImportTemplateFile(
  id: string,
  file: File,
): Promise<ImportTemplate> {
  const form = new FormData()
  form.append('file', file)
  return request.Put<ImportTemplate>(`/import-template/${id}/file`, form, {
    cacheFor: 0,
  })
}

export function deleteImportTemplate(id: string): Promise<void> {
  return request.Delete<void>(`/import-template/${id}`, {}, { cacheFor: 0 })
}

export function fetchActiveImportTemplate(
  businessKey: string,
): Promise<ImportTemplate> {
  return request.Get<ImportTemplate>(
    `/import-template/${encodeURIComponent(businessKey)}/active`,
    { cacheFor: 0 },
  )
}

/** 下载业务当前启用模板（xlsx）。 */
export function downloadImportTemplateBlob(
  businessKey: string,
): Promise<Blob> {
  return blobRequest.Get<Blob>(
    `/import-template/${encodeURIComponent(businessKey)}/download`,
    { cacheFor: 0 },
  )
}
