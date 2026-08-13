/**
 * 将上传接口返回的 path（如 `uploads/images/2026-08/xxx.png`）转为用户头像的存储值。
 *
 * 后端约定 avatar 字段存储带 `/api` 前缀的相对路径（或完整 URL），
 * 因此这里统一补全前缀；已带前缀 / 完整 URL / 空值均原样透传。
 */
export function toStoredAvatarPath(path: string | null | undefined): string | null {
  if (!path) return null

  const trimmed = path.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/')) return trimmed

  return `/api/${trimmed}`
}
