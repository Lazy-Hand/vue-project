<script setup lang="ts">
import { computed } from 'vue'
import { ConfigProvider } from 'antdv-next'
import enUS from 'antdv-next/locale/en_US'
import zhCN from 'antdv-next/locale/zh_CN'

import { useAppConfigStore } from '@/stores/app-config'
import { getAntdThemeConfig } from '@/utils/theme'

const appConfig = useAppConfigStore()

const antdLocale = computed(() => (appConfig.locale === 'en-US' ? enUS : zhCN))
const theme = computed(() => getAntdThemeConfig(appConfig.darkMode, appConfig.primaryColor))
</script>

<template>
  <ConfigProvider :locale="antdLocale" :theme="theme">
    <RouterView />
  </ConfigProvider>
</template>
