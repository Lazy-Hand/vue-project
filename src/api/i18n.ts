import { request } from '@/utils/request'

/** 获取指定语言的 i18n 消息字典 */
export function fetchI18nMessages(): Promise<Record<string, string>> {
  return request.Get<Record<string, string>>('/i18n/messages', { cacheFor: 0 })
}

/** 获取支持的语言列表 */
export function fetchSupportedLocales(): Promise<string[]> {
  return request.Get<string[]>('/i18n/locales', { cacheFor: 0 })
}
