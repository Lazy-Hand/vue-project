<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { Menu, MenuItem, SubMenu } from 'antdv-next'

import MenuIcon from '@/components/MenuIcon/index.vue'
import { useAuthStore } from '@/stores/auth'
import type { PermissionTreeNode } from '@/types/permission'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const activeMenu = computed(() => route.path)

function visibleMenus(nodes: PermissionTreeNode[]): PermissionTreeNode[] {
  return nodes
    .filter((node) => node.enabled && node.type !== 'BUTTON')
    .map((node) => ({
      ...node,
      children: visibleMenus(node.children ?? []),
    }))
    .filter((node) => node.type === 'MENU' || node.children.length > 0)
}

const menus = computed(() => visibleMenus(authStore.menus))

function handleMenuClick(info: { key: string | number }): void {
  const path = String(info.key)
  if (path.startsWith('/')) void router.push(path)
}
</script>

<template>
  <Menu
    :selected-keys="[activeMenu]"
    mode="inline"
    theme="dark"
    class="aside-menu"
    @click="handleMenuClick"
  >
    <MenuItem key="/">
      <MenuIcon icon="HomeFilled" />
      <span>{{ t('common.home') }}</span>
    </MenuItem>

    <template v-for="node in menus" :key="node.id">
      <SubMenu v-if="node.type === 'DIRECTORY' && node.children.length" :key="node.code">
        <template #title>
          <MenuIcon :icon="node.icon" />
          <span>{{ node.name }}</span>
        </template>
        <MenuItem
          v-for="child in node.children"
          :key="child.path || child.code"
          :disabled="!child.path"
        >
          <MenuIcon :icon="child.icon" />
          <span>{{ child.name }}</span>
        </MenuItem>
      </SubMenu>

      <MenuItem v-else-if="node.type === 'MENU' && node.path" :key="node.path">
        <MenuIcon :icon="node.icon" />
        <span>{{ node.name }}</span>
      </MenuItem>
    </template>
  </Menu>
</template>

<style scoped lang="scss">
.aside-menu {
  border-right: none;
  width: 220px;
}

.aside-menu :deep(.ant-menu-item:hover),
.aside-menu :deep(.ant-menu-submenu-title:hover) {
  background-color: rgb(255 255 255 / 0.08) !important;
}

.aside-menu :deep(.ant-menu-item-selected) {
  color: var(--app-color-primary) !important;
  background-color: color-mix(in srgb, var(--app-color-primary) 28%, transparent) !important;
}

.aside-menu :deep(.ant-menu-submenu-selected > .ant-menu-submenu-title) {
  color: var(--app-color-primary) !important;
}
</style>
