<script setup lang="ts">
import { computed, h, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { Button, Dropdown, type MenuProps } from 'antdv-next'
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CloseCircleOutlined,
  CloseOutlined,
  CompressOutlined,
  DownOutlined,
  ExpandOutlined,
  HomeFilled,
  ReloadOutlined,
} from '@antdv-next/icons'

import MenuIcon from '@/components/MenuIcon/index.vue'
import { useTabsStore } from '@/stores/tabs'
import type { TabItem } from '@/types/tabs'

const emit = defineEmits<{
  refresh: []
}>()

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const tabsStore = useTabsStore()

const tabsContainerRef = ref<HTMLDivElement | null>(null)
const activeTabRef = ref<HTMLDivElement | null>(null)

// Synchronize current route into tabs store
watch(
  () => route.fullPath,
  () => {
    tabsStore.addTab(route)
    void nextTick(() => {
      scrollActiveTabIntoView()
    })
  },
  { immediate: true },
)

function scrollActiveTabIntoView() {
  if (!tabsContainerRef.value) return
  const activeEl = tabsContainerRef.value.querySelector(
    '.layout-tab-item.is-active',
  ) as HTMLElement | null
  if (activeEl && typeof activeEl.scrollIntoView === 'function') {
    activeEl.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    })
  }
}

function handleWheel(e: WheelEvent) {
  if (!tabsContainerRef.value) return
  tabsContainerRef.value.scrollLeft += e.deltaY || e.deltaX
}

function handleTabClick(tab: TabItem) {
  if (tab.key === tabsStore.activeTabKey) return
  void router.push(tab.fullPath)
}

function handleCloseTab(tab: TabItem) {
  tabsStore.closeTab(tab.key, router)
}

function handleTabMenuClick(key: string, targetTab: TabItem) {
  switch (key) {
    case 'refresh':
      emit('refresh')
      break
    case 'close':
      tabsStore.closeTab(targetTab.key, router)
      break
    case 'closeOther':
      tabsStore.closeOtherTabs(targetTab.key, router)
      break
    case 'closeLeft':
      tabsStore.closeLeftTabs(targetTab.key, router)
      break
    case 'closeRight':
      tabsStore.closeRightTabs(targetTab.key, router)
      break
    case 'closeAll':
      tabsStore.closeAllTabs(router)
      break
    case 'maximize':
      tabsStore.toggleContentMaximize()
      break
  }
}

function getTabContextMenuItems(tab?: TabItem | null): MenuProps['items'] {
  if (!tab || !tab.key) return []
  const list = tabsStore.tabs || []
  const index = list.findIndex((t) => t?.key === tab.key)
  const isFirst = index === 0
  const isLast = index >= 0 && index === list.length - 1
  const hasMultiple = list.length > 1

  return [
    {
      key: 'refresh',
      label: t('tabs.refresh'),
      icon: () => h(ReloadOutlined),
      disabled: tab.key !== tabsStore.activeTabKey,
    },
    {
      type: 'divider',
    },
    {
      key: 'close',
      label: t('tabs.close'),
      icon: () => h(CloseOutlined),
      disabled: !tab.closable,
    },
    {
      key: 'closeOther',
      label: t('tabs.closeOther'),
      icon: () => h(CloseCircleOutlined),
      disabled: !hasMultiple,
    },
    {
      key: 'closeLeft',
      label: t('tabs.closeLeft'),
      icon: () => h(ArrowLeftOutlined),
      disabled: isFirst,
    },
    {
      key: 'closeRight',
      label: t('tabs.closeRight'),
      icon: () => h(ArrowRightOutlined),
      disabled: isLast,
    },
    {
      type: 'divider',
    },
    {
      key: 'closeAll',
      label: t('tabs.closeAll'),
      icon: () => h(CloseCircleOutlined),
      disabled: !hasMultiple,
    },
    {
      key: 'maximize',
      label: tabsStore.isContentMaximized ? t('tabs.exitMaximize') : t('tabs.maximize'),
      icon: () => h(tabsStore.isContentMaximized ? CompressOutlined : ExpandOutlined),
    },
  ]
}

const moreActionsMenu = computed<MenuProps['items']>(() => {
  const list = tabsStore.tabs || []
  const activeKey = tabsStore.activeTabKey
  const activeTab = list.find((t) => t?.key === activeKey) ?? list[0]
  if (!activeTab) return []
  return getTabContextMenuItems(activeTab)
})

function getTabLabel(tab?: TabItem | null): string {
  if (!tab) return ''
  if (tab.path === '/') {
    return t('common.home')
  }
  return tab.title || ''
}
</script>

<template>
  <div class="layout-tabs-bar">
    <div ref="tabsContainerRef" class="layout-tabs-scroll" @wheel.passive="handleWheel">
      <div class="layout-tabs-list">
        <Dropdown
          v-for="tab in tabsStore.tabs"
          :key="tab.key"
          :menu="{
            items: getTabContextMenuItems(tab),
            onClick: ({ key }) => handleTabMenuClick(String(key), tab),
          }"
          :trigger="['contextmenu']"
        >
          <div
            ref="activeTabRef"
            class="layout-tab-item"
            :class="{ 'is-active': tab.key === tabsStore.activeTabKey }"
            @click="handleTabClick(tab)"
          >
            <div class="tab-icon">
              <HomeFilled v-if="tab.path === '/'" />
              <MenuIcon v-else-if="tab.icon" :icon="tab.icon" />
            </div>

            <span class="tab-title">{{ getTabLabel(tab) }}</span>

            <span
              v-if="tab.closable"
              class="tab-close-btn"
              :title="t('tabs.close')"
              @click.stop="handleCloseTab(tab)"
            >
              <CloseOutlined />
            </span>
          </div>
        </Dropdown>
      </div>
    </div>

    <div class="layout-tabs-tools">
      <Button
        type="text"
        class="tab-tool-btn"
        :title="t('tabs.refresh')"
        :aria-label="t('tabs.refresh')"
        @click="emit('refresh')"
      >
        <ReloadOutlined />
      </Button>

      <Button
        type="text"
        class="tab-tool-btn"
        :title="tabsStore.isContentMaximized ? t('tabs.exitMaximize') : t('tabs.maximize')"
        :aria-label="tabsStore.isContentMaximized ? t('tabs.exitMaximize') : t('tabs.maximize')"
        @click="tabsStore.toggleContentMaximize()"
      >
        <CompressOutlined v-if="tabsStore.isContentMaximized" />
        <ExpandOutlined v-else />
      </Button>

      <Dropdown
        :menu="{
          items: moreActionsMenu,
          onClick: ({ key }) => {
            const activeTab =
              tabsStore.tabs.find((t) => t.key === tabsStore.activeTabKey) ?? tabsStore.tabs[0]
            if (activeTab) handleTabMenuClick(String(key), activeTab)
          },
        }"
        :trigger="['click']"
        placement="bottomRight"
      >
        <Button
          type="text"
          class="tab-tool-btn"
          :title="t('tabs.more')"
          :aria-label="t('tabs.more')"
        >
          <DownOutlined />
        </Button>
      </Dropdown>
    </div>
  </div>
</template>

<style scoped lang="scss">
.layout-tabs-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 38px;
  padding: 0 16px;
  background-color: #ffffff;
  border-bottom: 1px solid #e5e7eb;
  user-select: none;
  z-index: 8;
}

.layout-tabs-scroll {
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none; // Firefox

  &::-webkit-scrollbar {
    display: none; // Chrome/Safari
  }
}

.layout-tabs-list {
  display: inline-flex;
  align-items: center;
  height: 100%;
  gap: 6px;
}

.layout-tab-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
  color: #4b5563;
  background-color: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    color: var(--app-color-primary, #409eff);
    background-color: #f3f4f6;
    border-color: #d1d5db;
  }

  &.is-active {
    color: var(--app-color-primary, #409eff);
    background-color: color-mix(in srgb, var(--app-color-primary, #409eff) 10%, #ffffff);
    border-color: color-mix(in srgb, var(--app-color-primary, #409eff) 30%, #e5e7eb);
    font-weight: 500;

    .tab-icon {
      color: var(--app-color-primary, #409eff);
    }
  }
}

.tab-icon {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  color: #6b7280;
}

.tab-title {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-close-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  margin-left: 2px;
  font-size: 10px;
  color: #9ca3af;
  border-radius: 50%;
  transition: all 0.15s ease;

  &:hover {
    color: #ffffff;
    background-color: #ef4444;
  }
}

.layout-tabs-tools {
  display: flex;
  align-items: center;
  gap: 2px;
  padding-left: 8px;
  margin-left: 8px;
  border-left: 1px solid #f3f4f6;
  flex-shrink: 0;
}

.tab-tool-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  color: #6b7280;
  font-size: 12px;
  border-radius: 4px;

  &:hover {
    color: var(--app-color-primary, #409eff);
    background-color: #f3f4f6;
  }
}

html.dark {
  .layout-tabs-bar {
    background-color: #1c1d22;
    border-bottom: 1px solid #2a2c33;
  }

  .layout-tab-item {
    color: #94a3b8;
    background-color: #22242a;
    border-color: #2e3038;

    &:hover {
      color: #ffffff;
      background-color: #262832;
      border-color: #3b3e48;
    }

    &.is-active {
      color: var(--app-color-primary, #ea580c);
      background-color: #2a2520;
      border-color: #43240e;

      .tab-icon {
        color: var(--app-color-primary, #ea580c);
      }
    }

    .tab-close-btn {
      color: #64748b;

      &:hover {
        color: #ffffff;
        background-color: #ef4444;
      }
    }
  }

  .layout-tabs-tools {
    border-left: 1px solid #2a2c33;
  }

  .tab-tool-btn {
    color: #94a3b8;

    &:hover {
      color: #ffffff;
      background-color: #262830;
    }
  }
}
</style>
