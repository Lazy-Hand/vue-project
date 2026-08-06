<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const authStore = useAuthStore()
const displayName = computed(
  () => authStore.user?.nickname || authStore.user?.username || t('common.user'),
)
</script>

<template>
  <div class="home-page">
    <h2>{{ t('home.welcome', { name: displayName }) }}</h2>
    <p>{{ t('home.tip') }}</p>
  </div>
</template>

<style scoped>
.home-page {
  padding: 8px 4px;
}

.home-page h2 {
  margin: 0 0 8px;
  font-size: 22px;
  color: #111827;
}

.home-page p {
  margin: 0;
  color: #6b7280;
  line-height: 1.6;
}
</style>
