<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Drawer, Table, Tag, message } from 'antdv-next'

import { fetchApprovalInstanceDetail, fetchApprovalInstances } from '@/api/approval'
import type { ApprovalInstance } from '@/types/approval'
import { ApiRequestError } from '@/utils/request'
import InstanceDetailDrawer from '../instance/InstanceDetailDrawer.vue'

interface ApprovalRecord extends ApprovalInstance {
  /** 最近一条审批意见（取日志中按时间最近的一条非空 comment） */
  latestComment: string | null
}

interface Props {
  open: boolean
  /** 业务类型，对应 ApprovalInstance.businessType（如 'project'） */
  businessType?: string | null
  /** 业务单据 ID，对应 ApprovalInstance.businessId */
  businessId?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  businessType: null,
  businessId: null,
})

const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const { t, locale } = useI18n()

const visible = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

const approvals = ref<ApprovalRecord[]>([])
const loading = ref(false)

const detailOpen = ref(false)
const detailId = ref<string | null>(null)

function formatDateTime(value: string | null | undefined): string {
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

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message
  if (error instanceof Error) return error.message
  return t('approval.requestFailed')
}

/** 实例最近一条非空审批意见：从日志中按时间倒序取 comment。 */
async function resolveLatestComment(instanceId: string): Promise<string | null> {
  try {
    const detail = await fetchApprovalInstanceDetail(instanceId)
    const logs = detail.logs ?? []
    const comments = logs
      .map((log) => ({ comment: log.comment, createdAt: log.createdAt }))
      .filter((item) => item.comment && item.comment.trim())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return comments[0]?.comment ?? null
  } catch {
    return null
  }
}

async function load(): Promise<void> {
  if (!props.businessType || !props.businessId) {
    approvals.value = []
    return
  }
  loading.value = true
  try {
    const result = await fetchApprovalInstances({
      page: 1,
      pageSize: 100,
      businessType: props.businessType,
      businessId: props.businessId,
    })
    const instances = result.items ?? []
    const withComments = await Promise.all(
      instances.map(async (item) => ({
        ...item,
        latestComment: await resolveLatestComment(item.id),
      })),
    )
    approvals.value = withComments
  } catch (error) {
    message.error(errorMessage(error))
  } finally {
    loading.value = false
  }
}

function openDetail(row: ApprovalInstance): void {
  detailId.value = row.id
  detailOpen.value = true
}

watch(
  () => props.open,
  (open) => {
    if (open) void load()
  },
)
</script>

<template>
  <Drawer
    :open="visible"
    :title="t('approval.records.title')"
    :size="820"
    destroy-on-hidden
    @close="visible = false"
  >
    <Table
      :data-source="approvals"
      :columns="[
        { title: t('approval.instance.titleLabel'), dataIndex: 'title', key: 'title' },
        { title: t('approval.instance.status'), dataIndex: 'status', key: 'status', width: 110 },
        {
          title: t('approval.records.comment'),
          dataIndex: 'latestComment',
          key: 'latestComment',
          minWidth: 180,
          ellipsis: true,
        },
        {
          title: t('approval.instance.createdAt'),
          dataIndex: 'createdAt',
          key: 'createdAt',
          width: 170,
        },
        { title: t('common.actions'), key: 'actions', width: 90 },
      ]"
      :loading="loading"
      row-key="id"
      :pagination="false"
      size="small"
    >
      <template #bodyCell="{ column, record, text }">
        <template v-if="column.key === 'status'">
          <Tag :color="statusColor(String(text ?? ''))">
            {{ statusLabel(String(text ?? '')) }}
          </Tag>
        </template>
        <template v-else-if="column.key === 'latestComment'">
          <span :class="String(text ?? '').trim() ? '' : 'text-slate-400'">
            {{ String(text ?? '').trim() || '-' }}
          </span>
        </template>
        <template v-else-if="column.key === 'createdAt'">
          {{ formatDateTime(String(text ?? '')) }}
        </template>
        <template v-else-if="column.key === 'actions'">
          <Button type="link" size="small" @click="openDetail(record as ApprovalInstance)">
            {{ t('approval.instance.detail') }}
          </Button>
        </template>
      </template>
    </Table>

    <div v-if="!loading && approvals.length === 0" class="text-center text-sm text-slate-400 py-6">
      {{ t('approval.records.empty') }}
    </div>

    <InstanceDetailDrawer v-model:open="detailOpen" :instance-id="detailId" />
  </Drawer>
</template>
