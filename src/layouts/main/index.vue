<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { Button, Layout, LayoutContent, LayoutHeader, LayoutSider } from 'antdv-next'

import { logoutAuth } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import AccountSetSwitcher from './AccountSetSwitcher.vue'
import AppConfigControls from './AppConfigControls.vue'
import LayoutMenu from './Menu.vue'
import NoticeBell from './NoticeBell.vue'

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
  <Layout class="main-layout">
    <LayoutSider :width="220" class="main-aside">
      <div class="brand">{{ t('common.appName') }}</div>
      <div class="main-aside__menu">
        <LayoutMenu />
      </div>
    </LayoutSider>

    <Layout class="main-body">
      <LayoutHeader class="main-header">
        <div class="header-title">{{ route.meta.title || t('common.console') }}</div>
        <div class="header-actions">
          <NoticeBell />
          <AppConfigControls />
          <AccountSetSwitcher />
          <span class="user-name">{{ displayName }}</span>
          <Button type="link" @click="handleLogout">{{ t('common.logout') }}</Button>
        </div>
      </LayoutHeader>
      <LayoutContent class="main-content">
        <RouterView />
      </LayoutContent>
    </Layout>
  </Layout>
</template>

<style scoped lang="scss">
.main-layout {
  height: 100vh;
  overflow: hidden;
  background: #f5f7fa;
}

.main-aside {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: #0f172a;
  color: #fff;
}

.brand {
  flex-shrink: 0;
  height: 56px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.02em;
  border-bottom: 1px solid rgb(255 255 255 / 0.08);
}

.main-aside__menu {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
}

.main-body {
  min-width: 0;
  height: 100%;
  overflow: hidden;
}

.main-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
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
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 20px;
}
</style>
