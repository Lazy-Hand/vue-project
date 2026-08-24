<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Drawer, Empty, Spin, Switch, Tag, message } from 'antdv-next'
import {
  ApartmentOutlined,
  AppstoreOutlined,
  AuditOutlined,
  BankOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  CoffeeOutlined,
  CopyOutlined,
  DollarCircleOutlined,
  EditOutlined,
  FileProtectOutlined,
  FileTextOutlined,
  FormOutlined,
  NodeIndexOutlined,
  PlusOutlined,
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

import {
  copyApprovalDefinition,
  fetchApprovalDefinitions,
  toggleApprovalDefinitionStatus,
} from '@/api/approval'
import type { ApprovalCategory, ApprovalDefinition } from '@/types/approval'
import { ApiRequestError } from '@/utils/request'

interface Props {
  open: boolean
  category: ApprovalCategory | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'design-flow': [definition: ApprovalDefinition]
  'create-flow': [categoryName: string]
}>()

const { t } = useI18n()

const loading = ref(false)
const flowList = ref<ApprovalDefinition[]>([])

const iconMap: Record<string, unknown> = {
  UserOutlined,
  DollarCircleOutlined,
  WalletOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  ApartmentOutlined,
  FileTextOutlined,
  FormOutlined,
  SolutionOutlined,
  ProjectOutlined,
  ToolOutlined,
  BankOutlined,
  CalendarOutlined,
  AuditOutlined,
  CoffeeOutlined,
  ClockCircleOutlined,
  TrophyOutlined,
  SendOutlined,
  ReconciliationOutlined,
  FileProtectOutlined,
  SettingOutlined,
  AppstoreOutlined,
}

function getIconComponent(iconName?: string | null): unknown {
  if (!iconName) return FileTextOutlined
  return iconMap[iconName] ?? FileTextOutlined
}

async function loadCategoryFlows(): Promise<void> {
  if (!props.category) return
  loading.value = true
  try {
    const res = await fetchApprovalDefinitions({
      category: props.category.name,
      pageSize: 50,
    })
    flowList.value = res.items
  } catch (error) {
    const msg =
      error instanceof ApiRequestError
        ? error.message
        : error instanceof Error
          ? error.message
          : t('approval.requestFailed')
    void message.error(msg)
  } finally {
    loading.value = false
  }
}

watch(
  () => props.open,
  (val) => {
    if (val && props.category) {
      void loadCategoryFlows()
    }
  },
)

async function handleToggleFlowStatus(flow: ApprovalDefinition, enabled: boolean): Promise<void> {
  try {
    await toggleApprovalDefinitionStatus(flow.id, enabled)
    flow.enabled = enabled
    void message.success(
      enabled ? t('approval.definition.enabled') : t('approval.definition.disabled'),
    )
  } catch (error) {
    const msg =
      error instanceof ApiRequestError
        ? error.message
        : error instanceof Error
          ? error.message
          : t('approval.requestFailed')
    void message.error(msg)
  }
}

async function handleCopyFlow(flow: ApprovalDefinition): Promise<void> {
  try {
    await copyApprovalDefinition(flow.id)
    void message.success('流程复制成功')
    void loadCategoryFlows()
  } catch (error) {
    const msg =
      error instanceof ApiRequestError
        ? error.message
        : error instanceof Error
          ? error.message
          : t('approval.requestFailed')
    void message.error(msg)
  }
}

function handleDesignFlow(flow: ApprovalDefinition): void {
  emit('update:open', false)
  emit('design-flow', flow)
}

function handleCreateNewFlow(): void {
  if (!props.category) return
  emit('update:open', false)
  emit('create-flow', props.category.name)
}

function getFieldCount(schema: unknown): number {
  if (!schema || typeof schema !== 'object' || !('fields' in schema)) return 0
  const fields = (schema as { fields?: unknown[] }).fields
  return Array.isArray(fields) ? fields.length : 0
}
</script>

<template>
  <Drawer :open="open" :size="640" destroy-on-hidden @close="emit('update:open', false)">
    <template #title>
      <div v-if="category" class="flex items-center gap-2.5">
        <div
          class="w-7 h-7 rounded-lg flex items-center justify-center text-white text-sm shadow-2xs bg-blue-600"
        >
          <component :is="getIconComponent(category.icon)" />
        </div>
        <div class="flex items-center gap-2">
          <span class="font-bold text-slate-800">{{ category.name }}</span>
          <Tag class="font-mono text-blue-700 bg-blue-50 border-blue-200">
            {{ category.code }}
          </Tag>
          <span class="text-xs text-slate-400"> 共 {{ flowList.length }} 个流程 </span>
        </div>
      </div>
      <div v-else>关联流程列表</div>
    </template>

    <template #extra>
      <Button v-if="category" type="primary" size="small" @click="handleCreateNewFlow">
        <PlusOutlined />
        为此分类新建流程
      </Button>
    </template>

    <Spin :spinning="loading">
      <div v-if="flowList.length > 0" class="space-y-3 py-1">
        <div
          v-for="flow in flowList"
          :key="flow.id"
          class="p-4 bg-white border border-slate-200 rounded-xl hover:shadow-xs transition-all flex flex-col justify-between gap-3 group"
        >
          <div class="flex items-start justify-between gap-2 min-w-0">
            <div class="flex items-start gap-2.5 min-w-0 flex-1">
              <div
                class="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg shadow-2xs shrink-0 mt-0.5 bg-blue-600"
              >
                <component :is="getIconComponent(flow.icon)" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5 min-w-0">
                  <span class="font-bold text-sm text-slate-800 truncate min-w-0 flex-1">{{
                    flow.name
                  }}</span>
                  <Tag
                    class="font-mono text-2xs text-slate-500 bg-slate-100 border-slate-200 shrink-0"
                  >
                    v{{ flow.version }}
                  </Tag>
                </div>
                <div class="text-xs font-mono text-slate-400 mt-0.5 truncate">{{ flow.code }}</div>
                <div v-if="flow.remark" class="text-xs text-slate-500 mt-1 line-clamp-1">
                  {{ flow.remark }}
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2 shrink-0 pt-0.5 pl-1">
              <Switch
                :checked="flow.enabled"
                size="small"
                @update:checked="(val) => handleToggleFlowStatus(flow, Boolean(val))"
              />
            </div>
          </div>

          <!-- 底部状态指标与快捷操作 -->
          <div class="pt-2.5 border-t border-slate-100 flex items-center justify-between">
            <div class="flex items-center gap-3 text-xs text-slate-500">
              <span class="flex items-center gap-1">
                <FormOutlined class="text-slate-400" />
                {{ getFieldCount(flow.formSchema) }} 字段
              </span>
              <span class="flex items-center gap-1">
                <NodeIndexOutlined class="text-slate-400" />
                {{ flow.nodes?.length ?? 0 }} 节点
              </span>
            </div>

            <div class="flex items-center gap-2">
              <Button size="small" type="link" class="text-xs px-1" @click="handleCopyFlow(flow)">
                <CopyOutlined />
                复制
              </Button>
              <Button
                size="small"
                type="primary"
                ghost
                class="text-xs"
                @click="handleDesignFlow(flow)"
              >
                <EditOutlined />
                设计流程
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="!loading" class="py-12 text-center">
        <Empty description="该分类下暂无已配置的审批流程">
          <Button type="primary" size="small" @click="handleCreateNewFlow">
            <PlusOutlined />
            立即创建流程
          </Button>
        </Empty>
      </div>
    </Spin>
  </Drawer>
</template>
