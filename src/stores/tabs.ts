import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { RouteLocationNormalized, Router } from 'vue-router'

import type { TabItem } from '@/types/tabs'

export const DEFAULT_HOME_TAB: TabItem = {
  key: '/',
  title: '首页',
  path: '/',
  fullPath: '/',
  icon: 'HomeFilled',
  closable: false,
}

const IGNORED_PATHS = ['/login', '/404', '/403']

export const useTabsStore = defineStore(
  'tabs',
  () => {
    const tabs = ref<TabItem[]>([{ ...DEFAULT_HOME_TAB }])
    const activeTabKey = ref<string>('/')
    const cachedViews = ref<string[]>([])
    const isContentMaximized = ref<boolean>(false)

    function ensureHomeTab(): void {
      if (!Array.isArray(tabs.value)) {
        tabs.value = [{ ...DEFAULT_HOME_TAB }]
      } else if (!tabs.value.some((t) => t && t.path === '/')) {
        tabs.value.unshift({ ...DEFAULT_HOME_TAB })
      }
    }

    ensureHomeTab()

    function addTab(route: RouteLocationNormalized): void {
      const path = route.path
      if (IGNORED_PATHS.includes(path) || route.name === 'not-found') {
        return
      }

      ensureHomeTab()

      const key = route.fullPath || path
      activeTabKey.value = key

      const existingIndex = tabs.value.findIndex((t) => t.key === key)
      const title = route.meta?.title
        ? String(route.meta.title)
        : route.name
          ? String(route.name)
          : 'Page'
      const icon = (route.meta?.icon as string | null) ?? null
      const routeName = route.name ? String(route.name) : undefined
      const closable = path !== '/'

      if (existingIndex >= 0) {
        // Update existing tab title/icon in case it changed (e.g. dynamic title)
        const current = tabs.value[existingIndex]
        if (current) {
          current.title = title
          current.icon = icon
        }
      } else {
        tabs.value.push({
          key,
          title,
          path,
          fullPath: key,
          name: routeName,
          icon,
          closable,
        })
      }

      if (routeName && route.meta?.keepAlive !== false) {
        if (!cachedViews.value.includes(routeName)) {
          cachedViews.value.push(routeName)
        }
      }
    }

    function closeTab(key: string, router: Router): void {
      const targetIndex = tabs.value.findIndex((t) => t.key === key)
      if (targetIndex < 0) return

      const targetTab = tabs.value[targetIndex]
      if (!targetTab || !targetTab.closable) return

      const isActive = activeTabKey.value === key

      if (isActive) {
        const nextTab = tabs.value[targetIndex + 1] ?? tabs.value[targetIndex - 1] ?? tabs.value[0]
        if (nextTab) {
          activeTabKey.value = nextTab.key
          void router.push(nextTab.fullPath)
        }
      }

      if (targetTab.name) {
        cachedViews.value = cachedViews.value.filter((n) => n !== targetTab.name)
      }

      tabs.value.splice(targetIndex, 1)
      ensureHomeTab()
    }

    function closeOtherTabs(key: string, router: Router): void {
      const targetTab = tabs.value.find((t) => t.key === key)
      tabs.value = tabs.value.filter((t) => !t.closable || t.key === key)
      ensureHomeTab()

      if (targetTab && activeTabKey.value !== key) {
        activeTabKey.value = key
        void router.push(targetTab.fullPath)
      }
    }

    function closeLeftTabs(key: string, router: Router): void {
      const targetIndex = tabs.value.findIndex((t) => t.key === key)
      if (targetIndex <= 0) return

      const leftTabs = tabs.value.slice(0, targetIndex)
      const shouldNavigate = leftTabs.some((t) => t.key === activeTabKey.value)

      tabs.value = tabs.value.filter((t, index) => !t.closable || index >= targetIndex)
      ensureHomeTab()

      if (shouldNavigate) {
        activeTabKey.value = key
        void router.push(key)
      }
    }

    function closeRightTabs(key: string, router: Router): void {
      const targetIndex = tabs.value.findIndex((t) => t.key === key)
      if (targetIndex < 0 || targetIndex >= tabs.value.length - 1) return

      const rightTabs = tabs.value.slice(targetIndex + 1)
      const shouldNavigate = rightTabs.some((t) => t.key === activeTabKey.value)

      tabs.value = tabs.value.filter((t, index) => !t.closable || index <= targetIndex)
      ensureHomeTab()

      if (shouldNavigate) {
        activeTabKey.value = key
        void router.push(key)
      }
    }

    function closeAllTabs(router: Router): void {
      tabs.value = tabs.value.filter((t) => !t.closable)
      ensureHomeTab()
      activeTabKey.value = '/'
      void router.push('/')
    }

    function toggleContentMaximize(val?: boolean): void {
      isContentMaximized.value = typeof val === 'boolean' ? val : !isContentMaximized.value
    }

    function resetTabs(): void {
      tabs.value = [{ ...DEFAULT_HOME_TAB }]
      activeTabKey.value = '/'
      cachedViews.value = []
      isContentMaximized.value = false
    }

    return {
      tabs,
      activeTabKey,
      cachedViews,
      isContentMaximized,
      addTab,
      closeTab,
      closeOtherTabs,
      closeLeftTabs,
      closeRightTabs,
      closeAllTabs,
      toggleContentMaximize,
      resetTabs,
    }
  },
  {
    persist: {
      pick: ['tabs'],
      afterHydrate: (ctx) => {
        const store = ctx.store as unknown as { tabs: TabItem[] }
        if (!store.tabs || !Array.isArray(store.tabs) || store.tabs.length === 0) {
          store.tabs = [{ ...DEFAULT_HOME_TAB }]
        } else if (!store.tabs.some((t) => t && t.path === '/')) {
          store.tabs.unshift({ ...DEFAULT_HOME_TAB })
        }
      },
    },
  },
)
