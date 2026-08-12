<script setup lang="ts">
import { computed } from 'vue'
import { ColorPicker, Select } from 'antdv-next'

import { useAppConfigStore } from '@/stores/app-config'
import type { AppLocale } from '@/types/app-config'

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
    <Select v-model:value="locale" class="locale-select" :options="localeOptions" size="middle" />
    <ColorPicker v-model:value="primaryColor" format="hex" value-format="hex" />
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
