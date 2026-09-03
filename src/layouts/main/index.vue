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
  CompressOutlined,
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
import { useTabsStore } from '@/stores/tabs'
import AccountSetSwitcher from './AccountSetSwitcher.vue'
import AppConfigControls from './AppConfigControls.vue'
import LayoutBreadcrumb from './Breadcrumb.vue'
import LayoutMenu from './Menu.vue'
import MenuSearchDialog from './MenuSearchDialog.vue'
import NoticeBell from './NoticeBell.vue'
import TabsBar from './TabsBar.vue'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const tabsStore = useTabsStore()

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

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && tabsStore.isContentMaximized) {
    tabsStore.toggleContentMaximize(false)
  }
}

async function handleLogout() {
  await logoutAuth()
  tabsStore.resetTabs()
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
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Layout class="main-layout">
    <LayoutSider
      v-show="!tabsStore.isContentMaximized"
      :width="220"
      :collapsed-width="64"
      :collapsed="collapsed"
      :trigger="null"
      collapsible
      theme="light"
      class="main-aside"
    >
      <div class="brand" :class="{ 'is-collapsed': collapsed }">
        <div class="brand-logo-ridgeline">
          <svg viewBox="0 0 24 24" class="brand-logo-svg" fill="currentColor">
            <rect x="3" y="4" width="7" height="2.8" rx="1.4" />
            <rect x="3" y="8.8" width="13" height="2.8" rx="1.4" />
            <rect x="3" y="13.6" width="18" height="2.8" rx="1.4" />
            <rect x="3" y="18.4" width="9" height="2.8" rx="1.4" />
          </svg>
        </div>
        <span v-show="!collapsed" class="brand-title">{{ t('common.appName') }}</span>
      </div>
      <div class="main-aside__menu">
        <LayoutMenu :collapsed="collapsed" />
      </div>
    </LayoutSider>

    <Layout class="main-body">
      <LayoutHeader v-show="!tabsStore.isContentMaximized" class="main-header">
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

        <div class="header-center">
          <div
            class="header-search-pill"
            :title="`${t('layout.searchMenu')} (⌘K)`"
            :aria-label="t('layout.searchMenu')"
            @click="searchOpen = true"
          >
            <SearchOutlined class="search-pill-icon" />
            <span class="search-pill-placeholder">{{ t('dashboard.searchPlaceholder') }}</span>
            <kbd class="search-pill-kbd">⌘ K</kbd>
          </div>
        </div>

        <div class="header-actions">
          <AccountSetSwitcher />

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

      <TabsBar @refresh="handleRefresh" />

      <LayoutContent class="main-content" :class="{ 'is-maximized': tabsStore.isContentMaximized }">
        <Button
          v-if="tabsStore.isContentMaximized"
          type="primary"
          shape="circle"
          class="exit-maximize-float-btn"
          :title="t('tabs.exitMaximize')"
          :aria-label="t('tabs.exitMaximize')"
          @click="tabsStore.toggleContentMaximize(false)"
        >
          <CompressOutlined />
        </Button>

        <RouterView v-if="routerAlive" v-slot="{ Component, route: currentRoute }">
          <Transition name="fade-slide" mode="out-in">
            <KeepAlive :include="tabsStore.cachedViews">
              <component :is="Component" v-if="Component" :key="currentRoute.fullPath" />
            </KeepAlive>
          </Transition>
        </RouterView>
      </LayoutContent>
    </Layout>

    <MenuSearchDialog v-model:open="searchOpen" />
  </Layout>
</template>

<style scoped lang="scss">
.main-layout {
  height: 100vh;
  overflow: hidden;
  background: #f8fafc;
}

html.dark .main-layout {
  background: #16171a;
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

  // LayoutSider 在 aside 内再包一层 .ant-layout-sider-children（antd 默认块级盒），
  // flex 链不断在这里，菜单容器的 flex:1 / min-height:0 才会生效，展开超高后在内部滚动。
  :deep(.ant-layout-sider-children) {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }
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

.brand-logo-ridgeline {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background-color: #fff7ed;
  color: #f97316;
  flex-shrink: 0;
  border: 1px solid #ffedd5;
  box-shadow: 0 2px 5px rgba(249, 115, 22, 0.15);
}

.brand-logo-svg {
  width: 20px;
  height: 20px;
}

.brand-title {
  font-size: 16px;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: #0f172a;
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
  display: flex;
  flex-direction: column;
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
  line-height: 1;
  transition: all 0.2s ease;

  :deep(.anticon) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    line-height: 1;
  }

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

.header-center {
  flex: 1;
  max-width: 420px;
  min-width: 0;
  margin: 0 12px;

  @media (max-width: 768px) {
    display: none;
  }
}

.header-search-pill {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-width: 0;
  height: 34px;
  padding: 0 10px;
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 9999px;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background-color: #ffffff;
    border-color: #cbd5e1;
    box-shadow: 0 2px 6px rgba(15, 23, 42, 0.05);

    .search-pill-icon {
      color: #0f172a;
    }
    .search-pill-placeholder {
      color: #475569;
    }
  }
}

.search-pill-icon {
  flex-shrink: 0;
  font-size: 14px;
  color: #94a3b8;
  transition: color 0.2s;
}

.search-pill-placeholder {
  flex: 1;
  min-width: 0;
  margin: 0 8px;
  font-size: 13px;
  color: #94a3b8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  user-select: none;
}

.search-pill-kbd {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 20px;
  padding: 0 6px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  color: #64748b;
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.header-actions {
  display: flex;
  align-items: center;
  height: 34px;
  gap: 8px;
  flex-shrink: 0;
}

.user-avatar-trigger {
  display: inline-flex;
  align-items: center;
  height: 34px;
  gap: 8px;
  cursor: pointer;
  padding: 0 8px;
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
  position: relative;

  &.is-maximized {
    padding: 16px;
  }
}

.exit-maximize-float-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 100;
  box-shadow: 0 4px 12px rgb(0 0 0 / 15%);
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.2s ease;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateX(-10px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateX(10px);
}

html.dark {
  .main-aside {
    background: #1c1d22;
    color: #f3f4f6;
    border-right: 1px solid #2a2c33;
    box-shadow: none;
  }

  .brand {
    background: #1c1d22;
    border-bottom: 1px solid #2a2c33;
  }

  .brand-logo-ridgeline {
    background-color: #2a1b10;
    border-color: #43240e;
    color: #f97316;
  }

  .brand-title {
    color: #ffffff;
  }

  .main-header {
    background: #1c1d22;
    border-bottom: 1px solid #2a2c33;
  }

  .header-divider {
    background-color: #2a2c33;
  }

  .header-icon-btn {
    color: #94a3b8;

    &:hover {
      background-color: #262830;
      color: #ffffff;
    }
  }

  .header-search-pill {
    background-color: #22242a;
    border-color: #2e3038;

    &:hover {
      background-color: #262832;
      border-color: #3b3e48;

      .search-pill-icon {
        color: #ffffff;
      }
      .search-pill-placeholder {
        color: #cbd5e1;
      }
    }
  }

  .search-pill-icon {
    color: #64748b;
  }

  .search-pill-placeholder {
    color: #64748b;
  }

  .search-pill-kbd {
    background-color: #1c1d22;
    border-color: #333742;
    color: #94a3b8;
  }

  .user-avatar-trigger {
    &:hover {
      background-color: #262830;
    }
  }

  .user-name {
    color: #e2e8f0;
  }
}
</style>
