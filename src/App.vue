<script setup lang="ts">
import { computed } from 'vue'
import { ConfigProvider, type ThemeConfig } from 'antdv-next'
import enUS from 'antdv-next/locale/en_US'
import zhCN from 'antdv-next/locale/zh_CN'

import { useAppConfigStore } from '@/stores/app-config'

const appConfig = useAppConfigStore()

const antdLocale = computed(() => (appConfig.locale === 'en-US' ? enUS : zhCN))
const theme = computed<ThemeConfig>(() => ({
  token: {
    colorPrimary: appConfig.primaryColor,
  },
}))
</script>

<template>
  <ConfigProvider :locale="antdLocale" :theme="theme" component-size="small">
    <RouterView />
  </ConfigProvider>
</template>
