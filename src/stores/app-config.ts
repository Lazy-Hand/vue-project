import { ref } from 'vue'
import { defineStore } from 'pinia'

import { refreshLocalizedMenus } from '@/api/auth'
import { setI18nLocale } from '@/i18n'
import { APP_LOCALES, DEFAULT_PRIMARY_COLOR, type AppLocale } from '@/types/app-config'
import { applyDocumentLocale, applyPrimaryColor } from '@/utils/theme'

export const useAppConfigStore = defineStore(
  'app-config',
  () => {
    const locale = ref<AppLocale>('zh-CN')
    const primaryColor = ref(DEFAULT_PRIMARY_COLOR)

    function setLocale(next: AppLocale): void {
      if (!APP_LOCALES.some((item) => item.value === next)) return
      if (locale.value === next) return

      locale.value = next
      applyDocumentLocale(next)
      setI18nLocale(next)

      void refreshLocalizedMenus().catch(() => {
        // Locale UI already switched; menu names stay until next bootstrap.
      })
    }

    function setPrimaryColor(color: string): void {
      if (!applyPrimaryColor(color)) return
      primaryColor.value = color.toUpperCase()
    }

    /** Apply persisted values to DOM / i18n (call once after Pinia hydrate). */
    function apply(): void {
      applyDocumentLocale(locale.value)
      setI18nLocale(locale.value)
      applyPrimaryColor(primaryColor.value)
    }

    function reset(): void {
      setLocale('zh-CN')
      setPrimaryColor(DEFAULT_PRIMARY_COLOR)
    }

    return {
      locale,
      primaryColor,
      locales: APP_LOCALES,
      setLocale,
      setPrimaryColor,
      apply,
      reset,
    }
  },
  {
    persist: {
      pick: ['locale', 'primaryColor'],
    },
  },
)
