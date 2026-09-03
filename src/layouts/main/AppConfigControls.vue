<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, ColorPicker, Select, Tooltip } from 'antdv-next'
import { MoonOutlined, SunOutlined } from '@antdv-next/icons'

import { useAppConfigStore } from '@/stores/app-config'
import type { AppLocale } from '@/types/app-config'

const { t } = useI18n()
const appConfig = useAppConfigStore()

const localeOptions = computed(() =>
  appConfig.locales.map((item) => ({
    label: item.label,
    value: item.value,
  })),
)

const locale = computed({
  get: () => appConfig.locale,
  set: (value: AppLocale) => appConfig.setLocale(value),
})

const primaryColor = computed({
  get: () => appConfig.primaryColor,
  set: (value: string | null) => {
    if (!value) return
    appConfig.setPrimaryColor(value)
  },
})
</script>

<template>
  <div class="app-config-controls">
    <Tooltip :title="appConfig.darkMode ? t('layout.themeLight') : t('layout.themeDark')">
      <Button
        type="text"
        class="theme-toggle-btn"
        :title="appConfig.darkMode ? t('layout.themeLight') : t('layout.themeDark')"
        :aria-label="appConfig.darkMode ? t('layout.themeLight') : t('layout.themeDark')"
        @click="appConfig.toggleThemeMode()"
      >
        <SunOutlined v-if="appConfig.darkMode" />
        <MoonOutlined v-else />
      </Button>
    </Tooltip>

    <Select v-model:value="locale" class="locale-select" :options="localeOptions" size="small" />
    <ColorPicker v-model:value="primaryColor" format="hex" value-format="hex" />
  </div>
</template>

<style scoped lang="scss">
.app-config-controls {
  display: inline-flex;
  align-items: center;
  height: 34px;
  gap: 8px;
}

.theme-toggle-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border-radius: 6px;
  color: #4b5563;
  font-size: 16px;
  line-height: 1;
  transition: all 0.2s ease;

  :deep(.anticon) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    line-height: 1;
  }

  &:hover {
    color: var(--app-color-primary, #409eff);
    background-color: #f3f4f6;
  }
}

html.dark .theme-toggle-btn {
  color: #94a3b8;

  &:hover {
    color: #ffffff;
    background-color: #262830;
  }
}

.locale-select {
  width: 120px;

  :deep(.ant-select-selector) {
    height: 32px !important;
    display: flex !important;
    align-items: center !important;
  }
}

:deep(.ant-color-picker-trigger) {
  height: 32px !important;
  display: inline-flex !important;
  align-items: center !important;
}
</style>
