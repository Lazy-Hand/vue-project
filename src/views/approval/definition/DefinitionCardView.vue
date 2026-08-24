<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Button, Popconfirm, Switch, Tag } from 'antdv-next'
import {
  ApartmentOutlined,
  AppstoreOutlined,
  AuditOutlined,
  BankOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  CoffeeOutlined,
  CopyOutlined,
  DeleteOutlined,
  DollarCircleOutlined,
  EditOutlined,
  FileProtectOutlined,
  FileTextOutlined,
  FormOutlined,
  ProjectOutlined,
  ReconciliationOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  SettingOutlined,
  SolutionOutlined,
  TeamOutlined,
  ToolOutlined,
  TrophyOutlined,
  UserOutlined,
  WalletOutlined,
} from '@antdv-next/icons'

import type { ApprovalDefinition } from '@/types/approval'

interface Props {
  items: ApprovalDefinition[]
  loading?: boolean
}

withDefaults(defineProps<Props>(), {
  loading: false,
})

const emit = defineEmits<{
  edit: [item: ApprovalDefinition]
  copy: [item: ApprovalDefinition]
  delete: [item: ApprovalDefinition]
  launch: [item: ApprovalDefinition]
  'toggle-status': [item: ApprovalDefinition, enabled: boolean]
}>()

const { t, locale } = useI18n()

const iconMap: Record<string, unknown> = {
  FileTextOutlined,
  DollarCircleOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  ApartmentOutlined,
  FormOutlined,
  WalletOutlined,
  SettingOutlined,
  SendOutlined,
  ClockCircleOutlined,
  FileProtectOutlined,
  AppstoreOutlined,
  UserOutlined,
  CalendarOutlined,
  AuditOutlined,
  SolutionOutlined,
  CoffeeOutlined,
  TrophyOutlined,
  ToolOutlined,
  BankOutlined,
  ProjectOutlined,
  ReconciliationOutlined,
}

function getIconComponent(iconName?: string | null): unknown {
  if (!iconName) return FileTextOutlined
  return iconMap[iconName] ?? FileTextOutlined
}

function formatDateTime(value: string, localeCode: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  try {
    return new Intl.DateTimeFormat(localeCode, { dateStyle: 'medium', timeStyle: 'short' }).format(
      date,
    )
  } catch {
    return value
  }
}

function getFieldCount(row: ApprovalDefinition): number {
  if (row.formSchema && 'fields' in row.formSchema && Array.isArray(row.formSchema.fields)) {
    return row.formSchema.fields.length
  }
  return 0
}
</script>

<template>
  <div class="definition-card-view flex-1 overflow-y-auto p-4">
    <div
      v-if="items.length === 0 && !loading"
      class="h-96 flex flex-col items-center justify-center text-slate-400"
    >
      <div
        class="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3 text-2xl"
      >
        <FormOutlined />
      </div>
      <div class="text-sm font-medium text-slate-600">暂无流程定义模型</div>
      <div class="text-xs text-slate-400 mt-1">请点击上方按钮新建或切换分类查看</div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <div
        v-for="item in items"
        :key="item.id"
        class="bg-white border border-slate-200/80 hover:border-blue-400 rounded-2xl p-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group min-w-0 overflow-hidden"
      >
        <div class="min-w-0">
          <!-- 卡片顶部 -->
          <div class="flex items-start justify-between gap-2 mb-3 min-w-0">
            <div class="flex items-center gap-2.5 min-w-0 flex-1">
              <!-- 图标：按流程定义主题色着色 -->
              <div
                class="w-10 h-10 rounded-xl flex items-center justify-center text-white text-base shrink-0 shadow-2xs"
                :style="{ backgroundColor: item.color || '#1677ff' }"
              >
                <component :is="getIconComponent(item.icon)" />
              </div>

              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1 min-w-0">
                  <h3
                    class="text-sm font-bold text-slate-800 truncate flex-1 min-w-0"
                    :title="item.name"
                  >
                    {{ item.name }}
                  </h3>
                  <Tag
                    color="blue"
                    class="text-3xs font-mono font-bold px-1 py-0 leading-none shrink-0"
                  >
                    v{{ item.version }}
                  </Tag>
                </div>
                <div class="text-xs text-slate-400 font-mono truncate mt-0.5" :title="item.code">
                  {{ item.code }}
                </div>
              </div>
            </div>

            <!-- 启停开关 -->
            <div class="shrink-0 flex items-center pt-0.5 pl-1">
              <Switch
                size="small"
                :checked="item.enabled"
                :title="
                  item.enabled
                    ? t('approval.definition.enabled')
                    : t('approval.definition.disabled')
                "
                @change="(checked) => emit('toggle-status', item, Boolean(checked))"
              />
            </div>
          </div>

          <!-- 分类与指标标签：分类跟随流程定义主题色 -->
          <div class="flex flex-wrap items-center gap-1.5 mb-2.5">
            <Tag
              class="text-xs border"
              :style="{
                color: item.color || '#1677ff',
                borderColor: item.color || '#1677ff',
                background: '#fff',
              }"
            >
              {{ item.category || t('approval.definition.categoryDefault') }}
            </Tag>
            <Tag color="default" class="text-xs">
              {{ t('approval.definition.nodesCount', { count: item.nodes?.length ?? 0 }) }}
            </Tag>
            <Tag color="default" class="text-xs">
              {{ t('approval.definition.fieldsCount', { count: getFieldCount(item) }) }}
            </Tag>
          </div>

          <!-- 流程说明 -->
          <div class="text-xs text-slate-500 line-clamp-2 min-h-8 mb-3" :title="item.remark || ''">
            {{ item.remark || '暂无流程详细描述' }}
          </div>
        </div>

        <!-- 底部操作与更新时间 -->
        <div class="pt-3 border-t border-slate-100 flex items-center justify-between">
          <span class="text-2xs text-slate-400">
            {{ formatDateTime(item.updatedAt, locale) }}
          </span>

          <div class="flex items-center gap-1">
            <Button
              size="small"
              type="primary"
              class="text-xs h-7 px-2.5"
              @click="emit('edit', item)"
            >
              <EditOutlined />
              {{ t('approval.definition.designFlow') }}
            </Button>

            <Button size="small" class="text-xs h-7 px-2" title="复制" @click="emit('copy', item)">
              <CopyOutlined />
            </Button>

            <Popconfirm
              :title="t('approval.definition.deleteConfirm', { name: item.name })"
              ok-text="确认"
              cancel-text="取消"
              @confirm="emit('delete', item)"
            >
              <Button size="small" danger class="text-xs h-7 px-2" title="删除">
                <DeleteOutlined />
              </Button>
            </Popconfirm>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
