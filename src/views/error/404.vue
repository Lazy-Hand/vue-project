<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="not-found">
    <h1>404</h1>
    <p>页面不存在或无权访问</p>
    <el-button type="primary" @click="router.replace('/')">返回首页</el-button>
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
