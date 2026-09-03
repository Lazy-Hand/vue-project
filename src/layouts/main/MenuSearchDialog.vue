<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Empty, Input, Modal } from 'antdv-next'
import { EnterOutlined, HomeOutlined, SearchOutlined } from '@antdv-next/icons'

import MenuIcon from '@/components/MenuIcon/index.vue'
import { useAuthStore } from '@/stores/auth'
import type { PermissionTreeNode } from '@/types/permission'

interface SearchableMenuItem {
  key: string
  name: string
  path: string
  icon?: string | null
  parentNames: string[]
}

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()

const keyword = ref('')
const activeIndex = ref(0)
const inputRef = ref<{ focus: () => void } | null>(null)
const listRef = ref<HTMLDivElement | null>(null)

function flattenMenus(
  nodes: PermissionTreeNode[],
  parentNames: string[] = [],
  results: SearchableMenuItem[] = [],
): SearchableMenuItem[] {
  for (const node of nodes) {
    if (!node.enabled || node.type === 'BUTTON') continue
    if (node.type === 'MENU' && node.path) {
      results.push({
        key: node.path,
        name: node.name,
        path: node.path,
        icon: node.icon,
        parentNames,
      })
    }
    if (node.children?.length) {
      flattenMenus(node.children, [...parentNames, node.name], results)
    }
  }
  return results
}

const allMenus = computed<SearchableMenuItem[]>(() => {
  const homeItem: SearchableMenuItem = {
    key: '/',
    name: t('common.home'),
    path: '/',
    icon: 'HomeFilled',
    parentNames: [],
  }
  const dynamicItems = flattenMenus(authStore.menus)
  return [homeItem, ...dynamicItems]
})

const filteredMenus = computed<SearchableMenuItem[]>(() => {
  const q = keyword.value.trim().toLowerCase()
  if (!q) return allMenus.value
  return allMenus.value.filter((item) => {
    const matchName = item.name.toLowerCase().includes(q)
    const matchPath = item.path.toLowerCase().includes(q)
    const matchParents = item.parentNames.some((p) => p.toLowerCase().includes(q))
    return matchName || matchPath || matchParents
  })
})

watch(
  () => props.open,
  (val) => {
    if (val) {
      keyword.value = ''
      activeIndex.value = 0
      void nextTick(() => {
        inputRef.value?.focus()
      })
    }
  },
)

watch(filteredMenus, () => {
  activeIndex.value = 0
})

function close() {
  emit('update:open', false)
}

function handleSelect(item: SearchableMenuItem) {
  close()
  void router.push(item.path)
}

function handleKeydown(e: KeyboardEvent) {
  if (!props.open) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (filteredMenus.value.length > 0) {
      activeIndex.value = (activeIndex.value + 1) % filteredMenus.value.length
      scrollToActive()
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (filteredMenus.value.length > 0) {
      activeIndex.value =
        (activeIndex.value - 1 + filteredMenus.value.length) % filteredMenus.value.length
      scrollToActive()
    }
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const target = filteredMenus.value[activeIndex.value]
    if (target) {
      handleSelect(target)
    }
  }
}

function scrollToActive() {
  void nextTick(() => {
    if (!listRef.value) return
    const activeEl = listRef.value.querySelector('.is-active') as HTMLElement | null
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' })
    }
  })
}

function handleGlobalShortcut(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    emit('update:open', !props.open)
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalShortcut)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalShortcut)
})
</script>

<template>
  <Modal
    :open="open"
    :footer="null"
    :closable="false"
    :width="540"
    wrap-class-name="menu-search-modal-wrap"
    @update:open="close"
  >
    <div class="menu-search-dialog" @keydown="handleKeydown">
      <div class="menu-search-header">
        <SearchOutlined class="search-prefix-icon" />
        <Input
          ref="inputRef"
          v-model:value="keyword"
          :bordered="false"
          class="menu-search-input"
          :placeholder="t('layout.searchMenuPlaceholder')"
          allow-clear
        />
        <kbd class="shortcut-badge">ESC</kbd>
      </div>

      <div ref="listRef" class="menu-search-body">
        <ul v-if="filteredMenus.length > 0" class="menu-search-list">
          <li
            v-for="(item, index) in filteredMenus"
            :key="item.key"
            class="menu-search-item"
            :class="{ 'is-active': index === activeIndex }"
            @click="handleSelect(item)"
            @mouseenter="activeIndex = index"
          >
            <div class="menu-item-icon">
              <HomeOutlined v-if="item.path === '/'" />
              <MenuIcon v-else-if="item.icon" :icon="item.icon" />
              <SearchOutlined v-else />
            </div>

            <div class="menu-item-content">
              <span class="menu-item-name">{{ item.name }}</span>
              <span v-if="item.parentNames.length > 0" class="menu-item-path">
                {{ item.parentNames.join(' / ') }}
              </span>
            </div>

            <EnterOutlined class="menu-item-enter" />
          </li>
        </ul>

        <div v-else class="menu-search-empty">
          <Empty :description="t('layout.noSearchResult')" :image="Empty.PRESENTED_IMAGE_SIMPLE" />
        </div>
      </div>

      <div class="menu-search-footer">
        <div class="footer-tips">
          <span class="footer-tip-item">
            <kbd class="tip-kbd">↑</kbd>
            <kbd class="tip-kbd">↓</kbd>
            <span class="tip-text">切换</span>
          </span>
          <span class="footer-tip-item">
            <kbd class="tip-kbd">↵</kbd>
            <span class="tip-text">跳转</span>
          </span>
          <span class="footer-tip-item">
            <kbd class="tip-kbd">ESC</kbd>
            <span class="tip-text">关闭</span>
          </span>
        </div>
      </div>
    </div>
  </Modal>
</template>

<style scoped lang="scss">
:deep(.ant-modal) {
  top: 100px;
}

:deep(.ant-modal-content) {
  padding: 0 !important;
  border-radius: 12px;
  overflow: hidden;
  box-shadow:
    0 20px 25px -5px rgb(0 0 0 / 10%),
    0 8px 10px -6px rgb(0 0 0 / 10%);
}

.menu-search-dialog {
  display: flex;
  flex-direction: column;
  background: #ffffff;
}

.menu-search-header {
  display: flex;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid #f3f4f6;
  gap: 10px;
}

.search-prefix-icon {
  font-size: 18px;
  color: #9ca3af;
}

.menu-search-input {
  flex: 1;
  font-size: 15px;
  padding: 0;
  box-shadow: none !important;

  :deep(.ant-input) {
    font-size: 15px;
  }
}

.shortcut-badge {
  padding: 2px 6px;
  font-size: 11px;
  font-family: inherit;
  color: #9ca3af;
  background: #f3f4f6;
  border-radius: 4px;
  border: 1px solid #e5e7eb;
}

.menu-search-body {
  max-height: 380px;
  overflow-y: auto;
  padding: 10px;
}

.menu-search-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.menu-search-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  color: #374151;

  &.is-active {
    background-color: color-mix(in srgb, var(--app-color-primary, #409eff) 10%, transparent);
    color: var(--app-color-primary, #409eff);

    .menu-item-icon {
      color: var(--app-color-primary, #409eff);
      background-color: #ffffff;
    }

    .menu-item-enter {
      opacity: 1;
      transform: translateX(0);
    }
  }
}

.menu-item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background-color: #f3f4f6;
  color: #6b7280;
  font-size: 16px;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.menu-item-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.menu-item-name {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
}

.menu-item-path {
  font-size: 12px;
  color: #9ca3af;
  line-height: 1.2;
}

.menu-item-enter {
  font-size: 14px;
  color: var(--app-color-primary, #409eff);
  opacity: 0;
  transform: translateX(-4px);
  transition: all 0.15s ease;
}

.menu-search-empty {
  padding: 30px 0;
}

.menu-search-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 18px;
  background-color: #fafafa;
  border-top: 1px solid #f3f4f6;
  font-size: 12px;
  color: #9ca3af;
}

.footer-tips {
  display: flex;
  align-items: center;
  gap: 16px;
}

.footer-tip-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tip-kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  font-size: 11px;
  font-family: inherit;
  color: #6b7280;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 3px;
  box-shadow: 0 1px 1px rgb(0 0 0 / 5%);
}

.tip-text {
  font-size: 12px;
}

html.dark {
  .menu-search-dialog {
    background: #1c1d22;
    color: #f1f5f9;
  }

  .menu-search-header {
    border-bottom: 1px solid #2a2c33;
  }

  .shortcut-badge {
    background: #22242a;
    border-color: #2e3038;
    color: #94a3b8;
  }

  .menu-search-item {
    color: #e2e8f0;

    &:hover {
      background-color: #262830;
    }

    &.is-active {
      background-color: #2a2520;
      color: #f97316;

      .menu-item-icon {
        color: #f97316;
        background-color: #3b2414;
      }

      .menu-item-enter {
        color: #f97316;
      }
    }
  }

  .menu-item-icon {
    background-color: #22242a;
    color: #94a3b8;
  }

  .menu-search-footer {
    background-color: #18191e;
    border-top: 1px solid #2a2c33;
    color: #64748b;
  }

  .tip-kbd {
    background: #22242a;
    border-color: #2e3038;
    color: #94a3b8;
  }
}
</style>
