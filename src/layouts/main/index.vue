<script setup lang="ts">
import { computed, h } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { Avatar, Dropdown, Layout, LayoutContent, LayoutHeader, LayoutSider } from 'antdv-next'
import { LogoutOutlined, UserOutlined } from '@antdv-next/icons'

import { buildFileUrl } from '@/api/file'
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

const avatarSrc = computed(() =>
  authStore.user?.avatar ? buildFileUrl(authStore.user.avatar) : undefined,
)

const userMenuItems = computed(() => [
  {
    key: 'profile',
    label: t('common.personalInfo'),
    icon: () => h(UserOutlined),
  },
  {
    type: 'divider' as const,
  },
  {
    key: 'logout',
    label: t('common.logout'),
    icon: () => h(LogoutOutlined),
  },
])

async function handleLogout() {
  await logoutAuth()
  await router.replace('/login')
}

function handleUserMenuClick({ key }: { key: string }) {
  if (key === 'logout') {
    handleLogout()
  } else if (key === 'profile') {
    router.push('/profile')
  }
}
</script>

<template>
  <Layout class="main-layout">
    <LayoutSider :width="220" theme="light" class="main-aside">
      <div class="brand">{{ t('common.appName') }}</div>
      <div class="main-aside__menu">
        <LayoutMenu />
      </div>
    </LayoutSider>

    <Layout class="main-body">
      <LayoutHeader class="main-header">
        <div class="header-title">{{ route.meta.title || t('common.console') }}</div>
        <div class="header-actions">
          <AccountSetSwitcher />
          <NoticeBell />
          <AppConfigControls />
          <Dropdown
            :menu="{ items: userMenuItems }"
            :trigger="['click']"
            placement="bottomRight"
            @menu-click="handleUserMenuClick"
          >
            <div class="user-avatar-trigger">
              <Avatar :size="32" :src="avatarSrc">
                <template v-if="!avatarSrc" #icon>
                  <UserOutlined />
                </template>
              </Avatar>
              <span class="user-name">{{ displayName }}</span>
            </div>
          </Dropdown>
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
  background: #ffffff;
  color: #1f2937;
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
  border-bottom: 1px solid #e5e7eb;
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

.user-avatar-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background-color 0.2s;

  &:hover {
    background-color: #f3f4f6;
  }
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
