<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Button,
  Descriptions,
  DescriptionsItem,
  Drawer,
  Input,
  Tag,
  Timeline,
  TimelineItem,
  message,
} from 'antdv-next'
import { ClockCircleOutlined, CommentOutlined, NodeIndexOutlined } from '@antdv-next/icons'

import { commentApprovalInstance, fetchApprovalInstanceDetail } from '@/api/approval'
import type { ApprovalInstanceDetail } from '@/types/approval'
import { ApiRequestError } from '@/utils/request'
import ApprovalFlowProgress from '../components/ApprovalFlowProgress.vue'
import BusinessDetailHost from '../components/BusinessDetailHost.vue'

const props = defineProps<{ open: boolean; instanceId: string | null }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const { t, locale } = useI18n()
const detail = ref<ApprovalInstanceDetail | null>(null)
const loading = ref(false)
const comment = ref('')
const commenting = ref(false)

const visible = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

/** 从 flowSnapshot 快照中取流程节点（含发起/抄送/条件/审批各类型）。 */
const flowSnapshotNodes = computed(() => {
  const snapshot = detail.value?.instance.flowSnapshot
  if (!snapshot || typeof snapshot !== 'object') return []
  const nodes = (snapshot as Record<string, unknown>)['nodes']
  return Array.isArray(nodes) ? nodes : []
})

function formatDateTime(value?: string | null): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  try {
    return new Intl.DateTimeFormat(locale.value, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d)
  } catch {
    return value
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'processing'
    case 'APPROVED':
      return 'success'
    case 'REJECTED':
      return 'error'
    case 'CANCELLED':
      return 'default'
    default:
      return 'default'
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'PENDING':
      return t('approval.instance.statusPending')
    case 'APPROVED':
      return t('approval.instance.statusApproved')
    case 'REJECTED':
      return t('approval.instance.statusRejected')
    case 'CANCELLED':
      return t('approval.instance.statusCancelled')
    default:
      return status
  }
}

function taskTypeTag(taskType?: string | null): { label: string; color: string } {
  switch (taskType) {
    case 'AND_SIGN':
      return { label: '会签', color: 'purple' }
    case 'OR_SIGN':
      return { label: '或签', color: 'orange' }
    case 'CC':
      return { label: '抄送', color: 'cyan' }
    case 'SEQ':
    default:
      return { label: '审批', color: 'blue' }
  }
}

function actionLabel(action: string): string {
  switch (action) {
    case 'SUBMIT':
      return t('approval.instance.actionSubmit')
    case 'APPROVE':
      return t('approval.instance.actionApprove')
    case 'REJECT':
      return t('approval.instance.actionReject')
    case 'TRANSFER':
      return t('approval.instance.actionTransfer')
    case 'ADD_SIGN':
      return t('approval.instance.actionAddSign')
    case 'CANCEL':
      return t('approval.instance.actionCancel')
    case 'COMMENT':
      return t('approval.instance.comment')
    default:
      return action
  }
}

async function load(): Promise<void> {
  if (!props.instanceId) return
  loading.value = true
  try {
    detail.value = await fetchApprovalInstanceDetail(props.instanceId)
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

async function handleComment(): Promise<void> {
  if (!props.instanceId || !comment.value.trim()) {
    void message.warning(t('approval.instance.commentRequired'))
    return
  }
  commenting.value = true
  try {
    await commentApprovalInstance(props.instanceId, { comment: comment.value.trim() })
    void message.success(t('approval.instance.commentSuccess'))
    comment.value = ''
    await load()
  } catch (error) {
    const msg =
      error instanceof ApiRequestError
        ? error.message
        : error instanceof Error
          ? error.message
          : t('approval.requestFailed')
    void message.error(msg)
  } finally {
    commenting.value = false
  }
}

watch(
  () => props.open,
  (val) => {
    if (val) void load()
    else detail.value = null
  },
)
</script>

<template>
  <Drawer
    :open="visible"
    :title="t('approval.instance.detailTitle')"
    :size="680"
    destroy-on-hidden
    @close="visible = false"
  >
    <div v-if="loading" class="py-8 text-center text-slate-500">Loading...</div>
    <template v-else-if="detail">
      <!-- 实例基础信息 -->
      <Descriptions :column="2" bordered size="small" class="mb-4">
        <DescriptionsItem :label="t('approval.instance.titleLabel')" :span="2">
          <span class="font-semibold text-slate-800">{{ detail.instance.title }}</span>
        </DescriptionsItem>
        <DescriptionsItem :label="t('approval.instance.status')">
          <Tag :color="statusColor(detail.instance.status)">
            {{ statusLabel(detail.instance.status) }}
          </Tag>
        </DescriptionsItem>
        <DescriptionsItem :label="t('approval.instance.businessType')">
          <Tag class="font-mono">{{ detail.instance.businessType ?? '-' }}</Tag>
        </DescriptionsItem>
        <DescriptionsItem :label="t('approval.instance.businessId')">
          <span class="font-mono text-slate-600">{{ detail.instance.businessId ?? '-' }}</span>
        </DescriptionsItem>
        <DescriptionsItem :label="t('approval.instance.createdAt')">
          {{ formatDateTime(detail.instance.createdAt) }}
        </DescriptionsItem>
      </Descriptions>

      <!-- 流程实例进度图：按 flowSnapshot 节点结构渲染，当前节点绿色高亮、已通过置灰 -->
      <ApprovalFlowProgress
        :nodes="flowSnapshotNodes"
        :tasks="detail.tasks"
        :current-node-key="detail.instance.currentNodeKey ?? null"
        :status="detail.instance.status"
      />

      <!-- 单据/表单：按 businessType 走注册表，未注册类型由占位组件兜底 -->
      <BusinessDetailHost
        :business-type="detail.instance.businessType"
        :business-id="detail.instance.businessId"
        :form-data="(detail.instance.formData as Record<string, unknown> | null) ?? null"
      />

      <!-- 审批流转节点进度 -->
      <h4 class="mb-3 mt-4 text-sm font-bold text-slate-800 flex items-center gap-1.5">
        <NodeIndexOutlined class="text-blue-600" />
        {{ t('approval.instance.tasks') }}
      </h4>
      <div v-if="detail.tasks.length === 0" class="py-2 text-sm text-slate-400">
        {{ t('approval.instance.noTasks') }}
      </div>
      <Timeline v-else class="mt-2">
        <TimelineItem
          v-for="task in detail.tasks"
          :key="task.id"
          :color="task.status === 'PENDING' ? 'blue' : task.status === 'APPROVED' ? 'green' : 'red'"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="text-sm font-bold text-slate-800">
                {{ task.nodeName || task.nodeKey || task.nodeId }}
              </span>
              <Tag :color="taskTypeTag(task.taskType).color" class="text-2xs font-semibold">
                {{ taskTypeTag(task.taskType).label }}
              </Tag>
            </div>
            <Tag
              :color="
                task.status === 'PENDING'
                  ? 'processing'
                  : task.status === 'APPROVED'
                    ? 'success'
                    : 'default'
              "
              class="font-medium text-xs"
            >
              {{ statusLabel(task.status) }}
            </Tag>
          </div>

          <div
            v-if="task.comment"
            class="mt-1.5 text-xs text-slate-600 bg-blue-50/60 border-l-2 border-blue-400 p-2 rounded-r-lg"
          >
            {{ task.comment }}
          </div>

          <div class="text-2xs text-slate-400 mt-1 flex items-center gap-1">
            <ClockCircleOutlined />
            <span>到达: {{ formatDateTime(task.arrivedAt) }}</span>
            <span v-if="task.handledAt">| 处理: {{ formatDateTime(task.handledAt) }}</span>
          </div>
        </TimelineItem>
      </Timeline>

      <!-- 审批操作与流转日志 -->
      <h4 class="mb-3 mt-5 text-sm font-bold text-slate-800 flex items-center gap-1.5">
        <CommentOutlined class="text-emerald-600" />
        {{ t('approval.instance.logs') }}
      </h4>
      <div v-if="detail.logs.length === 0" class="py-2 text-sm text-slate-400">
        {{ t('approval.instance.noLogs') }}
      </div>
      <Timeline v-else class="mt-2">
        <TimelineItem v-for="log in detail.logs" :key="log.id" color="gray">
          <div class="flex items-center gap-2">
            <Tag class="text-2xs font-semibold">{{ actionLabel(log.action) }}</Tag>
            <span class="text-2xs text-slate-400">{{ formatDateTime(log.createdAt) }}</span>
          </div>
          <div v-if="log.comment" class="mt-1 text-xs text-slate-600">
            {{ log.comment }}
          </div>
        </TimelineItem>
      </Timeline>

      <!-- 发表评论 -->
      <div class="mt-5 p-3 bg-slate-50 rounded-xl border border-slate-200 flex gap-2">
        <Input
          v-model:value="comment"
          :placeholder="t('approval.instance.commentPlaceholder')"
          @press-enter="handleComment"
        />
        <Button type="primary" :loading="commenting" @click="handleComment">
          {{ t('approval.instance.comment') }}
        </Button>
      </div>
    </template>
  </Drawer>
</template>
