<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const title = computed(() => (typeof route.meta.title === 'string' ? route.meta.title : '页面'))
</script>

<template>
  <div class="page">
    <h2>{{ title }}</h2>
    <p>功能开发中，当前为占位页面。</p>
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
