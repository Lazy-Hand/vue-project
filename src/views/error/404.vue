<script setup lang="ts">
import { Button } from 'antdv-next'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const { t } = useI18n()
const router = useRouter()
</script>

<template>
  <div class="not-found">
    <h1>404</h1>
    <p>{{ t('notFound.message') }}</p>
    <Button type="primary" @click="router.replace('/')">{{ t('notFound.backHome') }}</Button>
  </div>
</template>

<style scoped>
.not-found {
  min-height: 60vh;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 12px;
  text-align: center;
}

.not-found h1 {
  margin: 0;
  font-size: 64px;
  color: #111827;
}

.not-found p {
  margin: 0;
  color: #6b7280;
}
</style>
