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
    <div v-if="items.length === 0 && !loading" class="empty-box">
      <div class="empty-icon-wrap">
        <FormOutlined />
      </div>
      <div class="empty-title">暂无流程定义模型</div>
      <div class="empty-desc">请点击上方按钮新建或切换分类查看</div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <div v-for="item in items" :key="item.id" class="definition-card group">
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
                  <h3 class="definition-card__title" :title="item.name">
                    {{ item.name }}
                  </h3>
                  <Tag
                    color="blue"
                    class="text-3xs font-mono font-bold px-1 py-0 leading-none shrink-0"
                  >
                    v{{ item.version }}
                  </Tag>
                </div>
                <div class="definition-card__code" :title="item.code">
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
            <Tag :color="item.color || 'blue'" class="definition-category-tag">
              {{ item.category || t('approval.definition.categoryDefault') }}
            </Tag>
            <Tag class="definition-meta-tag">
              {{ t('approval.definition.nodesCount', { count: item.nodes?.length ?? 0 }) }}
            </Tag>
            <Tag class="definition-meta-tag">
              {{ t('approval.definition.fieldsCount', { count: getFieldCount(item) }) }}
            </Tag>
          </div>

          <!-- 流程说明 -->
          <div class="definition-card__remark" :title="item.remark || ''">
            {{ item.remark || '暂无流程详细描述' }}
          </div>
        </div>

        <!-- 底部操作与更新时间 -->
        <div class="definition-card__footer">
          <span class="definition-card__time">
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

<style scoped lang="scss">
.definition-card-view {
  background-color: var(--app-fill-color-light, #f8fafc);
  transition: background-color 0.2s;
}

.definition-card {
  background-color: #ffffff;
  border: 1px solid #eaedf3;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-width: 0;
  overflow: hidden;

  &:hover {
    border-color: #cbd5e1;
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
  }
}

.definition-card__title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.definition-card__code {
  font-size: 11px;
  font-family: monospace;
  color: #94a3b8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

.definition-category-tag {
  font-size: 11px;
  font-weight: 500;
  margin: 0;
}

.definition-meta-tag {
  font-size: 11px;
  background-color: #f1f5f9;
  border-color: #e2e8f0;
  color: #64748b;
  margin: 0;
}

.definition-card__remark {
  font-size: 12px;
  color: #64748b;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 36px;
  margin-bottom: 12px;
}

.definition-card__footer {
  padding-top: 12px;
  border-top: 1px solid #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.definition-card__time {
  font-size: 11px;
  color: #94a3b8;
}

/* 空状态 */
.empty-box {
  height: 384px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
}

.empty-icon-wrap {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background-color: #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: #94a3b8;
  margin-bottom: 12px;
}

.empty-title {
  font-size: 14px;
  font-weight: 600;
  color: #475569;
}

.empty-desc {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 4px;
}

/* ==========================================================================
   暗黑模式 (Dark Mode)
   ========================================================================== */
html.dark {
  .definition-card-view {
    background-color: #16171a;
  }

  .definition-card {
    background-color: #1c1d22;
    border-color: #2a2c33;
    box-shadow: none;

    &:hover {
      background-color: #202228;
      border-color: #3e424e;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    }
  }

  .definition-card__title {
    color: #ffffff;
  }

  .definition-card__code {
    color: #8b909a;
  }

  .definition-meta-tag {
    background-color: #22242a;
    border-color: #2e3038;
    color: #94a3b8;
  }

  .definition-card__remark {
    color: #8b909a;
  }

  .definition-card__footer {
    border-top-color: #262830;
  }

  .definition-card__time {
    color: #64748b;
  }

  .empty-icon-wrap {
    background-color: #22242a;
    color: #64748b;
  }

  .empty-title {
    color: #cbd5e1;
  }

  .empty-desc {
    color: #64748b;
  }
}
</style>
