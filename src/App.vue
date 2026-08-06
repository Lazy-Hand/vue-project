<script setup lang="ts">
import { computed } from 'vue'
import { ElConfigProvider } from 'element-plus'
import en from 'element-plus/es/locale/lang/en'
import zhCn from 'element-plus/es/locale/lang/zh-cn'

import { useAppConfigStore } from '@/stores/app-config'

const appConfig = useAppConfigStore()

const elementLocale = computed(() => (appConfig.locale === 'en-US' ? en : zhCn))
</script>

<template>
  <ElConfigProvider :locale="elementLocale">
    <RouterView />
  </ElConfigProvider>
</template>
