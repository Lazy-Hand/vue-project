<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { ElAside, ElButton, ElContainer, ElHeader, ElMain } from 'element-plus'

import { logoutAuth } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import AccountSetSwitcher from './AccountSetSwitcher.vue'
import AppConfigControls from './AppConfigControls.vue'
import LayoutMenu from './Menu.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const displayName = computed(
  () => authStore.user?.nickname || authStore.user?.username || t('common.user'),
)

async function handleLogout() {
  await logoutAuth()
  await router.replace('/login')
}
</script>

<template>
  <el-container class="main-layout">
    <el-aside width="220px" class="main-aside">
      <div class="brand">{{ t('common.appName') }}</div>
      <LayoutMenu />
    </el-aside>

    <el-container>
      <el-header class="main-header">
        <div class="header-title">{{ route.meta.title || t('common.console') }}</div>
        <div class="header-actions">
          <AppConfigControls />
          <AccountSetSwitcher />
          <span class="user-name">{{ displayName }}</span>
          <el-button text type="primary" @click="handleLogout">{{ t('common.logout') }}</el-button>
        </div>
      </el-header>
      <el-main class="main-content">
        <RouterView />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.main-layout {
  min-height: 100vh;
  background: #f5f7fa;
}

.main-aside {
  background: #0f172a;
  color: #fff;
}

.brand {
  height: 56px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.02em;
  border-bottom: 1px solid rgb(255 255 255 / 0.08);
}

.main-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
}

.header-title {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-name {
  color: #4b5563;
  font-size: 14px;
}

.main-content {
  padding: 20px;
}
</style>
