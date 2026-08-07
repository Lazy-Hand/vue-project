<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { ElMenu, ElMenuItem, ElSubMenu } from 'element-plus'

import MenuIcon from '@/components/MenuIcon/index.vue'
import { useAuthStore } from '@/stores/auth'
import type { PermissionTreeNode } from '@/types/permission'

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
      <MenuIcon icon="HomeFilled" />
      <span>{{ t('common.home') }}</span>
    </el-menu-item>

    <template v-for="node in menus" :key="node.id">
      <el-sub-menu v-if="node.type === 'DIRECTORY' && node.children.length" :index="node.code">
        <template #title>
          <MenuIcon :icon="node.icon" />
          <span>{{ node.name }}</span>
        </template>
        <el-menu-item
          v-for="child in node.children"
          :key="child.id"
          :index="child.path || child.code"
        >
          <MenuIcon :icon="child.icon" />
          <span>{{ child.name }}</span>
        </el-menu-item>
      </el-sub-menu>

      <el-menu-item v-else-if="node.type === 'MENU' && node.path" :index="node.path">
        <MenuIcon :icon="node.icon" />
        <span>{{ node.name }}</span>
      </el-menu-item>
    </template>
  </el-menu>
</template>

<style scoped lang="scss">
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
