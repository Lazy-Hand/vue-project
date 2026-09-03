export type AppLocale = 'zh-CN' | 'en-US'
export type AppThemeMode = 'light' | 'dark'

export interface AppConfigState {
  locale: AppLocale
  primaryColor: string
  themeMode: AppThemeMode
}

export const APP_LOCALES: ReadonlyArray<{ value: AppLocale; label: string }> = [
  { value: 'zh-CN', label: '中文' },
  { value: 'en-US', label: 'English' },
]

export const DEFAULT_PRIMARY_COLOR = '#409EFF'
