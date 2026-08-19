<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { Breadcrumb, BreadcrumbItem, Dropdown, type MenuProps } from 'antdv-next'
import { DownOutlined, HomeOutlined } from '@antdv-next/icons'

import MenuIcon from '@/components/MenuIcon/index.vue'
import { useAuthStore } from '@/stores/auth'
import type { PermissionTreeNode } from '@/types/permission'

interface SiblingMenuItem {
  key: string
  name: string
  path: string
  icon?: string | null
}

interface BreadcrumbNode {
  key: string
  name: string
  path?: string | null
  icon?: string | null
  isLeaf: boolean
  siblings?: SiblingMenuItem[]
}

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

function findMenuPath(
  nodes: PermissionTreeNode[],
  targetPath: string,
  currentChain: PermissionTreeNode[] = [],
): PermissionTreeNode[] | null {
  for (const node of nodes) {
    if (!node.enabled || node.type === 'BUTTON') continue
    const nextChain = [...currentChain, node]
    if (node.type === 'MENU' && node.path === targetPath) {
      return nextChain
    }
    if (node.children?.length) {
      const found = findMenuPath(node.children, targetPath, nextChain)
      if (found) return found
    }
  }
  return null
}

const breadcrumbItems = computed<BreadcrumbNode[]>(() => {
  const currentPath = route.path
  if (currentPath === '/' || currentPath === '') {
    return []
  }

  const chain = findMenuPath(authStore.menus, currentPath)
  if (chain && chain.length > 0) {
    return chain.map((node, index) => {
      const isLeaf = index === chain.length - 1
      let siblings: SiblingMenuItem[] | undefined
      if (node.type === 'DIRECTORY' && node.children?.length) {
        siblings = node.children
          .filter((c) => c.enabled && c.type === 'MENU' && c.path)
          .map((c) => ({
            key: c.path as string,
            name: c.name,
            path: c.path as string,
            icon: c.icon,
          }))
      }

      return {
        key: node.code || node.path || String(node.id),
        name: node.name,
        path: node.path,
        icon: node.icon,
        isLeaf,
        siblings,
      }
    })
  }

  // Fallback if route is not in dynamic menus (e.g. meta title)
  if (route.meta?.title) {
    return [
      {
        key: currentPath,
        name: String(route.meta.title),
        isLeaf: true,
      },
    ]
  }

  return []
})

function handleNavigate(path?: string | null) {
  if (path && path !== route.path) {
    void router.push(path)
  }
}

function handleMenuClick(sibling: SiblingMenuItem) {
  handleNavigate(sibling.path)
}

function getSiblingMenuItems(siblings: SiblingMenuItem[]): MenuProps['items'] {
  return siblings.map((item) => ({
    key: item.key,
    label: item.name,
  }))
}
</script>

<template>
  <nav class="layout-breadcrumb" :aria-label="t('layout.breadcrumb')">
    <Breadcrumb class="breadcrumb-container">
      <BreadcrumbItem>
        <span
          class="breadcrumb-link breadcrumb-link--home"
          :class="{ 'is-active': route.path === '/' }"
          @click="handleNavigate('/')"
        >
          <HomeOutlined class="breadcrumb-icon" />
          <span class="breadcrumb-text">{{ t('common.home') }}</span>
        </span>
      </BreadcrumbItem>

      <BreadcrumbItem v-for="item in breadcrumbItems" :key="item.key">
        <Dropdown
          v-if="item.siblings && item.siblings.length > 1 && !item.isLeaf"
          :menu="{
            items: getSiblingMenuItems(item.siblings),
            onClick: ({ key }) => {
              const target = item.siblings?.find((s) => s.key === key)
              if (target) handleMenuClick(target)
            },
          }"
          :trigger="['hover', 'click']"
          placement="bottomLeft"
        >
          <span class="breadcrumb-link breadcrumb-link--dropdown">
            <MenuIcon v-if="item.icon" :icon="item.icon" class="breadcrumb-icon" />
            <span class="breadcrumb-text">{{ item.name }}</span>
            <DownOutlined class="breadcrumb-arrow" />
          </span>
        </Dropdown>

        <span v-else-if="item.isLeaf" class="breadcrumb-current" aria-current="page">
          <MenuIcon v-if="item.icon" :icon="item.icon" class="breadcrumb-icon" />
          <span class="breadcrumb-text">{{ item.name }}</span>
        </span>

        <span
          v-else
          class="breadcrumb-link"
          @click="item.path ? handleNavigate(item.path) : undefined"
        >
          <MenuIcon v-if="item.icon" :icon="item.icon" class="breadcrumb-icon" />
          <span class="breadcrumb-text">{{ item.name }}</span>
        </span>
      </BreadcrumbItem>
    </Breadcrumb>
  </nav>
</template>

<style scoped lang="scss">
.layout-breadcrumb {
  display: flex;
  align-items: center;
  user-select: none;
}

.breadcrumb-container {
  display: flex;
  align-items: center;
  font-size: 13px;
  line-height: 1.5;
}

.breadcrumb-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #6b7280;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    color: var(--app-color-primary, #409eff);
    background-color: #f3f4f6;
  }

  &.is-active {
    color: #111827;
    font-weight: 500;
    cursor: default;

    &:hover {
      background-color: transparent;
      color: #111827;
    }
  }
}

.breadcrumb-link--dropdown {
  cursor: pointer;
}

.breadcrumb-current {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #111827;
  font-weight: 500;
}

.breadcrumb-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.breadcrumb-text {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.breadcrumb-arrow {
  font-size: 10px;
  color: #9ca3af;
  margin-left: 2px;
}
</style>
