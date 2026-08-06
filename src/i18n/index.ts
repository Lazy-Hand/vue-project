import type { App } from 'vue'
import { createI18n } from 'vue-i18n'

import enUS from '@/locales/en-US'
import zhCN from '@/locales/zh-CN'
import type { AppLocale } from '@/types/app-config'

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: 'zh-CN' satisfies AppLocale,
  fallbackLocale: 'zh-CN' satisfies AppLocale,
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS,
  },
})

export function setI18nLocale(locale: AppLocale): void {
  i18n.global.locale.value = locale
}

export function setupI18n(app: App): void {
  app.use(i18n)
}
