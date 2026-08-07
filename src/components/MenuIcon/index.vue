<script setup lang="ts">
import { computed } from 'vue'
import { ElIcon } from 'element-plus'

import { isCustomMenuIcon, resolveMenuIcon } from '@/utils/icons'

interface Props {
  icon?: string | null
}

const props = defineProps<Props>()

const iconComponent = computed(() => resolveMenuIcon(props.icon))
const custom = computed(() => isCustomMenuIcon(props.icon))
</script>

<template>
  <el-icon :class="{ 'menu-icon--custom': custom }">
    <component :is="iconComponent" />
  </el-icon>
</template>

<style scoped lang="scss">
.menu-icon--custom {
  :deep(.custom-menu-icon) {
    display: inline-flex;
    width: 1em;
    height: 1em;
    line-height: 1;
  }

  :deep(.custom-menu-icon svg) {
    width: 1em;
    height: 1em;
    fill: currentColor;
  }
}
</style>
