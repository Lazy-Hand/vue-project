<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { CircleClose, Search } from '@element-plus/icons-vue'
import {
  ElButton,
  ElEmpty,
  ElIcon,
  ElInput,
  ElPopover,
  ElTabPane,
  ElTabs,
} from 'element-plus'

import MenuIcon from '@/components/MenuIcon/index.vue'
import {
  CUSTOM_ICON_PREFIX,
  isCustomMenuIcon,
  listCustomMenuIconNames,
  listElementPlusIconNames,
  toCustomIconValue,
} from '@/utils/icons'

type IconTab = 'element' | 'custom'

interface Props {
  modelValue?: string | null
  clearable?: boolean
  disabled?: boolean
  placeholder?: string
  /** Popover width in px */
  width?: number
  teleported?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  clearable: true,
  disabled: false,
  placeholder: undefined,
  width: 420,
  teleported: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const { t } = useI18n()

const visible = ref(false)
const keyword = ref('')
const activeTab = ref<IconTab>('element')

const elementIcons = listElementPlusIconNames()
const customIcons = listCustomMenuIconNames()

const selected = computed(() => props.modelValue ?? null)

const triggerLabel = computed(() => {
  if (!selected.value) {
    return props.placeholder ?? t('iconPicker.placeholder')
  }
  if (selected.value.startsWith(CUSTOM_ICON_PREFIX)) {
    return selected.value.slice(CUSTOM_ICON_PREFIX.length)
  }
  return selected.value
})

const filteredElementIcons = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  if (!q) return elementIcons
  return elementIcons.filter((name) => name.toLowerCase().includes(q))
})

const filteredCustomIcons = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  if (!q) return customIcons
  return customIcons.filter((name) => name.toLowerCase().includes(q))
})

watch(
  () => props.modelValue,
  (value) => {
    activeTab.value = isCustomMenuIcon(value) ? 'custom' : 'element'
  },
  { immediate: true },
)

watch(visible, (open) => {
  if (open) {
    keyword.value = ''
    activeTab.value = isCustomMenuIcon(props.modelValue) ? 'custom' : 'element'
  }
})

function selectElementIcon(name: string): void {
  emit('update:modelValue', name)
  visible.value = false
}

function selectCustomIcon(name: string): void {
  emit('update:modelValue', toCustomIconValue(name))
  visible.value = false
}

function clearSelection(event: MouseEvent): void {
  event.stopPropagation()
  emit('update:modelValue', null)
}

function isActive(iconValue: string): boolean {
  return selected.value === iconValue
}
</script>

<template>
  <el-popover
    v-model:visible="visible"
    :width="width"
    :disabled="disabled"
    :teleported="teleported"
    trigger="click"
    placement="bottom-start"
  >
    <template #reference>
      <el-button class="icon-picker__trigger" :disabled="disabled">
        <span class="icon-picker__trigger-main">
          <MenuIcon v-if="selected" :icon="selected" class="icon-picker__preview" />
          <span class="icon-picker__label" :class="{ 'is-placeholder': !selected }">
            {{ triggerLabel }}
          </span>
        </span>
        <el-icon
          v-if="clearable && selected && !disabled"
          class="icon-picker__clear"
          @click="clearSelection"
        >
          <CircleClose />
        </el-icon>
      </el-button>
    </template>

    <div class="icon-picker__panel">
      <el-input
        v-model="keyword"
        clearable
        :prefix-icon="Search"
        :placeholder="t('iconPicker.search')"
        class="icon-picker__search"
      />

      <el-tabs v-model="activeTab" class="icon-picker__tabs">
        <el-tab-pane :label="t('iconPicker.tabElement')" name="element">
          <div v-if="filteredElementIcons.length" class="icon-picker__grid">
            <button
              v-for="name in filteredElementIcons"
              :key="name"
              type="button"
              class="icon-picker__item"
              :class="{ 'is-active': isActive(name) }"
              :title="name"
              @click="selectElementIcon(name)"
            >
              <MenuIcon :icon="name" />
              <span class="icon-picker__name">{{ name }}</span>
            </button>
          </div>
          <el-empty v-else :description="t('iconPicker.empty')" :image-size="64" />
        </el-tab-pane>

        <el-tab-pane :label="t('iconPicker.tabCustom')" name="custom">
          <div v-if="filteredCustomIcons.length" class="icon-picker__grid">
            <button
              v-for="name in filteredCustomIcons"
              :key="name"
              type="button"
              class="icon-picker__item"
              :class="{ 'is-active': isActive(toCustomIconValue(name)) }"
              :title="toCustomIconValue(name)"
              @click="selectCustomIcon(name)"
            >
              <MenuIcon :icon="toCustomIconValue(name)" />
              <span class="icon-picker__name">{{ name }}</span>
            </button>
          </div>
          <el-empty v-else :description="t('iconPicker.emptyCustom')" :image-size="64" />
        </el-tab-pane>
      </el-tabs>
    </div>
  </el-popover>
</template>

<style scoped lang="scss">
.icon-picker__trigger {
  width: 100%;
  justify-content: space-between;
  padding: 8px 12px;
}

.icon-picker__trigger-main {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.icon-picker__preview {
  font-size: 18px;
  color: var(--el-color-primary);
}

.icon-picker__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--el-text-color-primary);

  &.is-placeholder {
    color: var(--el-text-color-placeholder);
  }
}

.icon-picker__clear {
  margin-left: 8px;
  color: var(--el-text-color-placeholder);

  &:hover {
    color: var(--el-text-color-regular);
  }
}

.icon-picker__panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.icon-picker__search {
  width: 100%;
}

.icon-picker__tabs {
  :deep(.el-tabs__header) {
    margin-bottom: 8px;
  }

  :deep(.el-tabs__content) {
    max-height: 280px;
    overflow: auto;
  }
}

.icon-picker__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.icon-picker__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 10px 6px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
  color: var(--el-text-color-regular);
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease,
    color 0.15s ease;

  &:hover {
    border-color: var(--el-color-primary-light-5);
    color: var(--el-color-primary);
  }

  &.is-active {
    border-color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
    color: var(--el-color-primary);
  }

  :deep(.el-icon) {
    font-size: 20px;
  }
}

.icon-picker__name {
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  line-height: 1.2;
  text-align: center;
}
</style>
