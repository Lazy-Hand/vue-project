<script setup lang="ts" generic="T extends object = ProTableRow">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { DownOutlined } from '@antdv-next/icons'
import { Button, Dropdown, type DropdownEmits, type DropdownProps } from 'antdv-next'
import { useI18n } from 'vue-i18n'

import type { ProTableAction, ProTableRow } from '@/types/pro-table'

interface Props {
  row: T
  actions: ProTableAction<T>[]
  maxInline?: number
  collapseThreshold?: number
}

type DropdownMenuItems = NonNullable<NonNullable<DropdownProps['menu']>['items']>

const props = withDefaults(defineProps<Props>(), {
  maxInline: 2,
  collapseThreshold: 3,
})

const { t } = useI18n()

const containerRef = ref<HTMLElement>()
const inlineCollapsed = ref(false)
let expandedActionsWidth = 0
let resizeObserver: ResizeObserver | undefined

const normalizedMaxInline = computed(() => Math.max(0, Math.floor(props.maxInline)))
const normalizedCollapseThreshold = computed(() => Math.max(1, Math.floor(props.collapseThreshold)))
const visibleActions = computed(() =>
  props.actions.filter((action) => resolveState(action.visible, true)),
)
const preferredInlineActions = computed(() => {
  const preferred = visibleActions.value.filter((action) => action.placement === 'inline')
  const automatic = visibleActions.value.filter((action) => action.placement === undefined)
  const limit =
    visibleActions.value.length > normalizedCollapseThreshold.value
      ? normalizedMaxInline.value
      : visibleActions.value.length
  return [
    ...preferred,
    ...automatic.filter((action) => !action.danger),
    ...automatic.filter((action) => action.danger),
  ].slice(0, limit)
})
const inlineActions = computed(() => (inlineCollapsed.value ? [] : preferredInlineActions.value))
const menuActions = computed(() => {
  const inlineKeys = new Set(inlineActions.value.map((action) => action.key))
  const overflow = visibleActions.value.filter((action) => !inlineKeys.has(action.key))
  return [
    ...overflow.filter((action) => !action.danger),
    ...overflow.filter((action) => action.danger),
  ]
})
const menuItems = computed<DropdownMenuItems>(() => {
  const firstDangerIndex = menuActions.value.findIndex((action) => action.danger)
  const items: DropdownMenuItems = menuActions.value.map((action) => ({
    key: action.key,
    label: action.label,
    danger: action.danger,
    disabled: actionDisabled(action),
  }))

  if (firstDangerIndex > 0) items.splice(firstDangerIndex, 0, { type: 'divider' })
  return items
})

function resolveState(
  state: boolean | ((row: T) => boolean) | undefined,
  defaultValue: boolean,
): boolean {
  if (typeof state === 'function') return state(props.row)
  return state ?? defaultValue
}

function actionDisabled(action: ProTableAction<T>): boolean {
  return resolveState(action.disabled, false)
}

function runAction(action: ProTableAction<T>): void {
  if (actionDisabled(action)) return
  void action.onClick(props.row)
}

function updateInlineLayout(): void {
  const container = containerRef.value
  if (!container || container.clientWidth <= 0 || preferredInlineActions.value.length === 0) {
    return
  }

  if (!inlineCollapsed.value) expandedActionsWidth = container.scrollWidth
  inlineCollapsed.value = expandedActionsWidth > container.clientWidth
}

function resetInlineLayout(): void {
  inlineCollapsed.value = false
  expandedActionsWidth = 0
  void nextTick(updateInlineLayout)
}

watch([visibleActions, normalizedMaxInline, normalizedCollapseThreshold], resetInlineLayout)

onMounted(() => {
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(updateInlineLayout)
    if (containerRef.value) resizeObserver.observe(containerRef.value)
  }
  void nextTick(updateInlineLayout)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})

const handleMenuClick: DropdownEmits['menuClick'] = ({ key }) => {
  const action = menuActions.value.find((item) => item.key === String(key))
  if (action) runAction(action)
}
</script>

<template>
  <div ref="containerRef" class="pro-table-actions" @click.stop>
    <template v-if="visibleActions.length">
      <Button
        v-for="action in inlineActions"
        :key="action.key"
        type="link"
        :danger="action.danger"
        :disabled="actionDisabled(action)"
        class="pro-table-actions__inline"
        @click="runAction(action)"
      >
        {{ action.label }}
      </Button>

      <Dropdown
        v-if="menuActions.length"
        :menu="{ items: menuItems }"
        :trigger="['click']"
        placement="bottomRight"
        @menu-click="handleMenuClick"
      >
        <Button type="link" class="pro-table-actions__more" :aria-label="t('proTable.moreActions')">
          {{ t('proTable.more') }}
          <DownOutlined class="pro-table-actions__more-icon" />
        </Button>
      </Dropdown>
    </template>

    <span v-else class="pro-table-actions__empty">-</span>
  </div>
</template>

<style scoped lang="scss">
.pro-table-actions {
  display: flex;
  align-items: center;
  white-space: nowrap;
}

.pro-table-actions__more-icon {
  font-size: 10px;
}

.pro-table-actions__empty {
  color: var(--app-text-color-placeholder);
}
</style>
