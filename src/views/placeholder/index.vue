<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

const { t } = useI18n()
const route = useRoute()
const title = computed(() =>
  typeof route.meta.title === 'string' ? route.meta.title : t('common.console'),
)
</script>

<template>
  <div class="page">
    <h2>{{ title }}</h2>
    <p>{{ t('placeholder.developing') }}</p>
  </div>
</template>

<style scoped>
.page h2 {
  margin: 0 0 8px;
  font-size: 20px;
}

.page p {
  margin: 0;
  color: #6b7280;
}
</style>
