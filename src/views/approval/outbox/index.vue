<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Button,
  Input,
  Modal,
  Select,
  Table,
  Tabs,
  TabPane,
  Tag,
  TextArea,
  message,
} from 'antdv-next'

import { fetchOutboxEvents, retryOutboxEvent } from '@/api/approval'
import type { ApprovalOutboxEvent } from '@/types/approval'
import { ApiRequestError, request } from '@/utils/request'

const { t } = useI18n()

// ================= Outbox 事件 =================

const loading = ref(false)
const events = ref<ApprovalOutboxEvent[]>([])
const total = ref(0)
const query = reactive({ page: 1, pageSize: 10, status: undefined as string | undefined })

const statusColor: Record<string, string> = {
  PENDING: 'processing',
  PROCESSING: 'blue',
  PUBLISHED: 'success',
  FAILED: 'error',
}

async function loadEvents(): Promise<void> {
  loading.value = true
  try {
    const res = await fetchOutboxEvents({
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
    })
    events.value = res.items
    total.value = res.total
  } catch (error) {
    message.error(errorMessage(error))
  } finally {
    loading.value = false
  }
}

async function handleRetry(eventId: string): Promise<void> {
  try {
    await retryOutboxEvent(eventId)
    message.success(t('approval.outbox.retrySuccess'))
    await loadEvents()
  } catch (error) {
    message.error(errorMessage(error))
  }
}

// ================= 异常诊断 =================

interface AnomalyResult {
  pendingWithoutTasks: { id: string }[]
  duplicatePendingTasks: {
    instanceId: string
    nodeKey: string | null
    assigneeId: string | null
    count: number
  }[]
  deadLetters: number
  longWaitingNodes: { id: string; nodeKey: string; hours: number }[]
  disabledAssigneeTasks: number
}
const anomalies = ref<AnomalyResult | null>(null)
const anomaliesLoading = ref(false)

async function loadAnomalies(): Promise<void> {
  anomaliesLoading.value = true
  try {
    anomalies.value = await request.Get<AnomalyResult>('/approval/repair/anomalies', {
      cacheFor: 0,
    })
  } catch (error) {
    message.error(errorMessage(error))
  } finally {
    anomaliesLoading.value = false
  }
}

// ================= 受审计干预 =================

const interventionVisible = ref(false)
const submitting = ref(false)

interface InterventionForm {
  action: 'RETRY_EVENT' | 'REASSIGN_TASK' | 'RECONCILE'
  targetId: string
  targetUserId: string
  reason: string
}

const interventionForm = reactive<InterventionForm>({
  action: 'RECONCILE',
  targetId: '',
  targetUserId: '',
  reason: '',
})

const actionOptions = computed(() => [
  { label: t('approval.repair.actionReconcile'), value: 'RECONCILE' },
  { label: t('approval.repair.actionRetryEvent'), value: 'RETRY_EVENT' },
  { label: t('approval.repair.actionReassign'), value: 'REASSIGN_TASK' },
])

async function submitIntervention(): Promise<void> {
  if (!interventionForm.reason.trim()) {
    message.warning(t('approval.repair.reasonRequired'))
    return
  }
  if (
    (interventionForm.action === 'RETRY_EVENT' || interventionForm.action === 'REASSIGN_TASK') &&
    !interventionForm.targetId.trim()
  ) {
    message.warning(t('approval.repair.targetRequired'))
    return
  }

  submitting.value = true
  try {
    const result = await request.Post<Record<string, unknown>>(
      '/approval/repair/interventions',
      {
        action: interventionForm.action,
        targetId: interventionForm.targetId.trim() || undefined,
        targetUserId: interventionForm.targetUserId.trim() || undefined,
        reason: interventionForm.reason.trim(),
      },
      { cacheFor: 0 },
    )
    void result
    message.success(t('approval.repair.interventionSuccess'))
    interventionVisible.value = false
    await Promise.all([loadEvents(), loadAnomalies()])
  } catch (error) {
    message.error(errorMessage(error))
  } finally {
    submitting.value = false
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message
  if (error instanceof Error) return error.message
  return t('approval.requestFailed')
}

onMounted(() => {
  void loadEvents()
  void loadAnomalies()
})
</script>

<template>
  <div class="p-4">
    <Tabs default-active-key="events">
      <TabPane key="events" :tab="t('approval.outbox.events')">
        <div class="mb-3 flex items-center gap-2">
          <Select
            v-model:value="query.status"
            allow-clear
            class="w-40"
            :placeholder="t('approval.outbox.statusFilter')"
            :options="[
              { label: 'PENDING', value: 'PENDING' },
              { label: 'PROCESSING', value: 'PROCESSING' },
              { label: 'PUBLISHED', value: 'PUBLISHED' },
              { label: 'FAILED', value: 'FAILED' },
            ]"
            @change="loadEvents"
          />
          <Button @click="loadEvents">{{ t('common.refresh') }}</Button>
          <Button type="primary" @click="interventionVisible = true">
            {{ t('approval.repair.openIntervention') }}
          </Button>
        </div>

        <Table
          :data-source="events"
          :loading="loading"
          row-key="id"
          size="small"
          :pagination="{
            current: query.page,
            pageSize: query.pageSize,
            total,
            showSizeChanger: false,
            onChange: (page: number) => {
              query.page = page
              loadEvents()
            },
          }"
          :columns="[
            { title: 'eventId', dataIndex: 'eventId', key: 'eventId', width: 300 },
            {
              title: t('approval.outbox.colAggregate'),
              dataIndex: 'aggregateId',
              key: 'aggregateId',
              width: 90,
            },
            { title: t('approval.outbox.colStatus'), key: 'status', width: 110 },
            {
              title: t('approval.outbox.colRetries'),
              dataIndex: 'retryCount',
              key: 'retryCount',
              width: 80,
            },
            {
              title: t('approval.outbox.colLastError'),
              dataIndex: 'lastError',
              key: 'lastError',
              ellipsis: true,
            },
            { title: t('common.actions'), key: 'actions', width: 90 },
          ]"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'">
              <Tag :color="statusColor[(record as ApprovalOutboxEvent).status] ?? 'default'">
                {{ (record as ApprovalOutboxEvent).status }}
              </Tag>
            </template>
            <template v-else-if="column.key === 'actions'">
              <Button
                v-if="
                  (record as ApprovalOutboxEvent).status === 'FAILED' ||
                  (record as ApprovalOutboxEvent).status === 'PENDING'
                "
                type="link"
                size="small"
                @click="handleRetry((record as ApprovalOutboxEvent).eventId)"
              >
                {{ t('approval.outbox.retry') }}
              </Button>
            </template>
          </template>
        </Table>
      </TabPane>

      <TabPane key="anomalies" :tab="t('approval.repair.anomaliesTab')">
        <div class="mb-3">
          <Button :loading="anomaliesLoading" @click="loadAnomalies">
            {{ t('common.refresh') }}
          </Button>
        </div>
        <div v-if="anomalies" class="grid gap-3 md:grid-cols-2">
          <div class="rounded border border-slate-100 p-3">
            <div class="mb-1 text-sm font-semibold text-slate-700">
              {{ t('approval.repair.pendingWithoutTasks') }}:
              {{ anomalies.pendingWithoutTasks.length }}
            </div>
            <span class="text-xs text-slate-500 break-all">
              {{ anomalies.pendingWithoutTasks.map((x) => x.id).join(', ') || '-' }}
            </span>
          </div>
          <div class="rounded border border-slate-100 p-3">
            <div class="mb-1 text-sm font-semibold text-slate-700">
              {{ t('approval.repair.duplicateTasks') }}:
              {{ anomalies.duplicatePendingTasks.length }}
            </div>
            <span class="text-xs text-slate-500 break-all">
              {{
                anomalies.duplicatePendingTasks
                  .map((x) => `${x.instanceId}/${x.nodeKey}/${x.assigneeId}×${x.count}`)
                  .join(', ') || '-'
              }}
            </span>
          </div>
          <div class="rounded border border-slate-100 p-3">
            <div class="text-sm font-semibold text-slate-700">
              {{ t('approval.repair.deadLetters') }}: {{ anomalies.deadLetters }}
            </div>
          </div>
          <div class="rounded border border-slate-100 p-3">
            <div class="text-sm font-semibold text-slate-700">
              {{ t('approval.repair.disabledAssignees') }}:
              {{ anomalies.disabledAssigneeTasks }}
            </div>
          </div>
          <div class="rounded border border-slate-100 p-3 md:col-span-2">
            <div class="mb-1 text-sm font-semibold text-slate-700">
              {{ t('approval.repair.longWaiting') }}
            </div>
            <span class="text-xs text-slate-500 break-all">
              {{
                anomalies.longWaitingNodes.map((x) => `${x.nodeKey}(${x.hours}h)`).join(', ') || '-'
              }}
            </span>
          </div>
        </div>
      </TabPane>
    </Tabs>

    <!-- 受审计干预弹窗 -->
    <Modal
      v-model:open="interventionVisible"
      :title="t('approval.repair.openIntervention')"
      :confirm-loading="submitting"
      destroy-on-hidden
      @ok="submitIntervention"
    >
      <div class="flex flex-col gap-3">
        <Select
          v-model:value="interventionForm.action"
          :options="actionOptions"
          :placeholder="t('approval.repair.action')"
        />
        <Input
          v-if="interventionForm.action !== 'RECONCILE'"
          v-model:value="interventionForm.targetId"
          :placeholder="
            interventionForm.action === 'RETRY_EVENT'
              ? t('approval.repair.eventIdPlaceholder')
              : t('approval.repair.taskIdPlaceholder')
          "
        />
        <Input
          v-if="interventionForm.action === 'REASSIGN_TASK'"
          v-model:value="interventionForm.targetUserId"
          :placeholder="t('approval.repair.targetUserPlaceholder')"
        />
        <TextArea
          v-model:value="interventionForm.reason"
          :rows="3"
          :maxlength="500"
          show-count
          :placeholder="t('approval.repair.reasonPlaceholder')"
        />
      </div>
    </Modal>
  </div>
</template>
