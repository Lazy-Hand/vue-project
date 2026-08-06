<script setup lang="ts">
import { computed } from 'vue'

import { useAppConfigStore } from '@/stores/app-config'
import type { AppLocale } from '@/types/app-config'

const appConfig = useAppConfigStore()

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
    <el-select v-model="locale" class="locale-select" size="default">
      <el-option
        v-for="item in appConfig.locales"
        :key="item.value"
        :label="item.label"
        :value="item.value"
      />
    </el-select>
    <el-color-picker v-model="primaryColor" size="default" />
  </div>
</template>

<style scoped>
.app-config-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.locale-select {
  width: 110px;
}
</style>
