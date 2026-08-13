<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Card, Collapse, CollapsePanel, Statistic, message } from 'antdv-next'
import { ReloadOutlined } from '@antdv-next/icons'

import { fetchMetricsText } from '@/api/metrics'
import ProTable from '@/components/ProTable/index.vue'
import { usePermission } from '@/composables/usePermission'
import type { ProTableColumn, ProTableRequestParams } from '@/types/pro-table'
import { ApiRequestError } from '@/utils/request'
import {
  findSample,
  formatBytes,
  formatSeconds,
  formatUptime,
  httpRequestStats,
  parsePrometheus,
  sumSamples,
  type HttpRequestStat,
  type PromSample,
} from './utils'

const { t } = useI18n()
const { hasPermission } = usePermission()

const canQuery = computed(() => hasPermission('system:metrics:query'))

const rawText = ref('')
const loading = ref(false)
const samples = computed<PromSample[]>(() => parsePrometheus(rawText.value))

const uptime = computed(() => {
  const startedAt = findSample(samples.value, 'process_start_time_seconds')
  if (startedAt === undefined) return '-'
  return formatUptime(Date.now() / 1000 - startedAt)
})
const cpuTime = computed(() =>
  formatSeconds(findSample(samples.value, 'process_cpu_seconds_total')),
)
const residentMemory = computed(() =>
  formatBytes(findSample(samples.value, 'process_resident_memory_bytes')),
)
const externalMemory = computed(() =>
  formatBytes(findSample(samples.value, 'nodejs_external_memory_bytes')),
)
const heapMemory = computed(() => {
  const used = findSample(samples.value, 'nodejs_heap_size_used_bytes')
  const total = findSample(samples.value, 'nodejs_heap_size_total_bytes')
  if (used === undefined || total === undefined) return '-'
  return `${formatBytes(used)} / ${formatBytes(total)}`
})
const eventLoopLag = computed(() => {
  const seconds = findSample(samples.value, 'nodejs_eventloop_lag_seconds', { quantile: '0.5' })
  if (seconds === undefined) return '-'
  return `${(seconds * 1000).toFixed(1)}ms`
})
const activeHandles = computed(() => sumSamples(samples.value, 'nodejs_active_handles'))
const activeRequests = computed(() => sumSamples(samples.value, 'nodejs_active_requests'))

const httpRows = computed<HttpRequestStat[]>(() => httpRequestStats(samples.value))

const httpColumns = computed<ProTableColumn<HttpRequestStat>[]>(() => [
  { prop: 'method', label: t('metrics.httpMethod'), width: 100 },
  { prop: 'route', label: t('metrics.httpRoute'), minWidth: 220, showOverflowTooltip: true },
  { prop: 'statusCode', label: t('metrics.httpStatusCode'), width: 100, align: 'center' },
  { prop: 'count', label: t('metrics.httpCount'), width: 120, align: 'right' },
])

async function requestHttpStats(params: ProTableRequestParams) {
  const start = (params.page - 1) * params.pageSize
  return {
    items: httpRows.value.slice(start, start + params.pageSize),
    total: httpRows.value.length,
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message
  if (error instanceof Error) return error.message
  return t('metrics.requestFailed')
}

async function loadMetrics(): Promise<void> {
  if (!canQuery.value) return
  loading.value = true
  try {
    rawText.value = await fetchMetricsText()
  } catch (error) {
    message.error(errorMessage(error))
  } finally {
    loading.value = false
  }
}

onMounted(loadMetrics)
</script>

<template>
  <div class="metrics-page">
    <div class="metrics-page__header">
      <Button :loading="loading" :disabled="!canQuery" @click="loadMetrics">
        <ReloadOutlined />
        {{ t('metrics.refresh') }}
      </Button>
    </div>

    <div class="metrics-page__cards">
      <Card class="metrics-page__card">
        <Statistic :title="t('metrics.uptime')" :value="uptime" />
      </Card>
      <Card class="metrics-page__card">
        <Statistic :title="t('metrics.cpuTime')" :value="cpuTime" />
      </Card>
      <Card class="metrics-page__card">
        <Statistic :title="t('metrics.residentMemory')" :value="residentMemory" />
      </Card>
      <Card class="metrics-page__card">
        <Statistic :title="t('metrics.heapMemory')" :value="heapMemory" />
      </Card>
      <Card class="metrics-page__card">
        <Statistic :title="t('metrics.eventLoopLag')" :value="eventLoopLag" />
      </Card>
      <Card class="metrics-page__card">
        <Statistic :title="t('metrics.externalMemory')" :value="externalMemory" />
      </Card>
      <Card class="metrics-page__card">
        <Statistic :title="t('metrics.activeHandles')" :value="activeHandles ?? '-'" />
      </Card>
      <Card class="metrics-page__card">
        <Statistic :title="t('metrics.activeRequests')" :value="activeRequests ?? '-'" />
      </Card>
    </div>

    <ProTable
      :columns="httpColumns"
      :request="requestHttpStats"
      :immediate="canQuery"
      :show-request-error="false"
      :search-fields="[]"
      :pagination="{ pageSize: 10 }"
    />

    <Collapse class="metrics-page__raw" :bordered="false">
      <CollapsePanel :header="t('metrics.rawMetrics')" key="raw">
        <pre class="metrics-page__raw-content">{{ rawText || t('metrics.empty') }}</pre>
      </CollapsePanel>
    </Collapse>
  </div>
</template>

<style scoped lang="scss">
.metrics-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.metrics-page__header {
  display: flex;
  justify-content: flex-end;
}

.metrics-page__cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.metrics-page__raw-content {
  margin: 0;
  max-height: 480px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 12px;
  line-height: 1.6;
  background: #fafafa;
  border-radius: 6px;
  padding: 8px 12px;
}
</style>
