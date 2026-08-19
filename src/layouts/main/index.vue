<script setup lang="ts">
import { computed, h, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  Avatar,
  Button,
  Dropdown,
  Layout,
  LayoutContent,
  LayoutHeader,
  LayoutSider,
} from 'antdv-next'
import {
  FullscreenExitOutlined,
  FullscreenOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ReloadOutlined,
  SearchOutlined,
  UserOutlined,
} from '@antdv-next/icons'

import { buildFileUrl } from '@/api/file'
import { logoutAuth } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import AccountSetSwitcher from './AccountSetSwitcher.vue'
import AppConfigControls from './AppConfigControls.vue'
import LayoutBreadcrumb from './Breadcrumb.vue'
import LayoutMenu from './Menu.vue'
import MenuSearchDialog from './MenuSearchDialog.vue'
import NoticeBell from './NoticeBell.vue'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()

const collapsed = ref(false)
const isFullscreen = ref(false)
const searchOpen = ref(false)
const routerAlive = ref(true)
const isRefreshing = ref(false)

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

function toggleCollapse() {
  collapsed.value = !collapsed.value
}

async function handleRefresh() {
  if (isRefreshing.value) return
  isRefreshing.value = true
  routerAlive.value = false
  await nextTick()
  routerAlive.value = true
  setTimeout(() => {
    isRefreshing.value = false
  }, 500)
}

function handleFullscreenChange() {
  isFullscreen.value = Boolean(document.fullscreenElement)
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    void document.documentElement.requestFullscreen().catch(() => {})
  } else {
    void document.exitFullscreen().catch(() => {})
  }
}

async function handleLogout() {
  await logoutAuth()
  await router.replace('/login')
}

function handleUserMenuClick({ key }: { key: string }) {
  if (key === 'logout') {
    void handleLogout()
  } else if (key === 'profile') {
    void router.push('/profile')
  }
}

onMounted(() => {
  document.addEventListener('fullscreenchange', handleFullscreenChange)
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
})
</script>

<template>
  <Layout class="main-layout">
    <LayoutSider
      :width="220"
      :collapsed-width="64"
      :collapsed="collapsed"
      :trigger="null"
      collapsible
      theme="light"
      class="main-aside"
    >
      <div class="brand" :class="{ 'is-collapsed': collapsed }">
        <div class="brand-logo">V</div>
        <span v-show="!collapsed" class="brand-title">{{ t('common.appName') }}</span>
      </div>
      <div class="main-aside__menu">
        <LayoutMenu :collapsed="collapsed" />
      </div>
    </LayoutSider>

    <Layout class="main-body">
      <LayoutHeader class="main-header">
        <div class="header-left">
          <Button
            type="text"
            class="header-icon-btn"
            :title="collapsed ? t('layout.expand') : t('layout.collapse')"
            :aria-label="collapsed ? t('layout.expand') : t('layout.collapse')"
            @click="toggleCollapse"
          >
            <MenuUnfoldOutlined v-if="collapsed" />
            <MenuFoldOutlined v-else />
          </Button>

          <Button
            type="text"
            class="header-icon-btn"
            :class="{ 'is-spinning': isRefreshing }"
            :title="t('layout.refresh')"
            :aria-label="t('layout.refresh')"
            @click="handleRefresh"
          >
            <ReloadOutlined />
          </Button>

          <div class="header-divider" />

          <LayoutBreadcrumb />
        </div>

        <div class="header-actions">
          <Button
            type="text"
            class="header-icon-btn"
            :title="`${t('layout.searchMenu')} (⌘K)`"
            :aria-label="t('layout.searchMenu')"
            @click="searchOpen = true"
          >
            <SearchOutlined />
          </Button>

          <Button
            type="text"
            class="header-icon-btn"
            :title="isFullscreen ? t('layout.fullscreenExit') : t('layout.fullscreen')"
            :aria-label="isFullscreen ? t('layout.fullscreenExit') : t('layout.fullscreen')"
            @click="toggleFullscreen"
          >
            <FullscreenExitOutlined v-if="isFullscreen" />
            <FullscreenOutlined v-else />
          </Button>

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
        <RouterView v-if="routerAlive" />
      </LayoutContent>
    </Layout>

    <MenuSearchDialog v-model:open="searchOpen" />
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
  transition: all 0.2s ease;
  box-shadow: 2px 0 8px 0 rgb(29 35 41 / 5%);
  z-index: 10;
}

.brand {
  flex-shrink: 0;
  height: 56px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  border-bottom: 1px solid #e5e7eb;
  overflow: hidden;
  transition: padding 0.2s ease;

  &.is-collapsed {
    padding: 0;
    justify-content: center;
  }
}

.brand-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, var(--app-color-primary, #409eff), #2563eb);
  color: #ffffff;
  font-weight: 800;
  font-size: 18px;
  border-radius: 8px;
  flex-shrink: 0;
  box-shadow: 0 2px 6px rgb(37 99 235 / 25%);
}

.brand-title {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #111827;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
  padding: 0 16px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  z-index: 9;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.header-divider {
  width: 1px;
  height: 16px;
  background-color: #e5e7eb;
  margin: 0 4px;
}

.header-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  color: #4b5563;
  border-radius: 6px;
  font-size: 16px;
  transition: all 0.2s ease;

  &:hover {
    color: var(--app-color-primary, #409eff);
    background-color: #f3f4f6;
  }

  &.is-spinning {
    :deep(span) {
      animation: spin 0.6s linear infinite;
    }
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
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
