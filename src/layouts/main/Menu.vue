<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { ElIcon, ElMenu, ElMenuItem, ElSubMenu } from 'element-plus'

import { useAuthStore } from '@/stores/auth'
import type { PermissionTreeNode } from '@/types/permission'
import { resolveMenuIcon } from '@/utils/icons'

const { t } = useI18n()
const route = useRoute()
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
</script>

<template>
  <el-menu
    :default-active="activeMenu"
    router
    class="aside-menu"
    background-color="#0f172a"
    text-color="rgba(255, 255, 255, 0.78)"
    active-text-color="#ffffff"
  >
    <el-menu-item index="/">
      <el-icon><component :is="resolveMenuIcon('HomeFilled')" /></el-icon>
      <span>{{ t('common.home') }}</span>
    </el-menu-item>

    <template v-for="node in menus" :key="node.id">
      <el-sub-menu v-if="node.type === 'DIRECTORY' && node.children.length" :index="node.code">
        <template #title>
          <el-icon><component :is="resolveMenuIcon(node.icon)" /></el-icon>
          <span>{{ node.name }}</span>
        </template>
        <el-menu-item
          v-for="child in node.children"
          :key="child.id"
          :index="child.path || child.code"
        >
          <el-icon><component :is="resolveMenuIcon(child.icon)" /></el-icon>
          <span>{{ child.name }}</span>
        </el-menu-item>
      </el-sub-menu>

      <el-menu-item v-else-if="node.type === 'MENU' && node.path" :index="node.path">
        <el-icon><component :is="resolveMenuIcon(node.icon)" /></el-icon>
        <span>{{ node.name }}</span>
      </el-menu-item>
    </template>
  </el-menu>
</template>

<style scoped>
.aside-menu {
  border-right: none;
}

.aside-menu:not(.el-menu--collapse) {
  width: 220px;
}

.aside-menu :deep(.el-menu-item:hover),
.aside-menu :deep(.el-sub-menu__title:hover) {
  background-color: rgb(255 255 255 / 0.08) !important;
}

.aside-menu :deep(.el-menu-item.is-active) {
  background-color: rgb(59 130 246 / 0.28) !important;
}
</style>
