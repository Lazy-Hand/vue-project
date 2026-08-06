export type AppLocale = 'zh-CN' | 'en-US'

export interface AppConfigState {
  locale: AppLocale
  primaryColor: string
}

export const APP_LOCALES: ReadonlyArray<{ value: AppLocale; label: string }> = [
  { value: 'zh-CN', label: '中文' },
  { value: 'en-US', label: 'English' },
]

export const DEFAULT_PRIMARY_COLOR = '#409EFF'
