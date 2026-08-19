<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Button,
  Card,
  Col,
  Input,
  Progress,
  Row,
  Segmented,
  Statistic,
  Tag,
  Tooltip,
  message,
} from 'antdv-next'
import {
  ApiOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  CopyOutlined,
  DashboardOutlined,
  FilterOutlined,
  ReloadOutlined,
  SearchOutlined,
  ThunderboltOutlined,
} from '@antdv-next/icons'

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
  getEventLoopStatus,
  getHeapUsagePercentage,
  getMethodTagColor,
  getStatusCodeTagColor,
  httpRequestStats,
  parsePrometheus,
  sumSamples,
  type HttpRequestStat,
  type PromSample,
} from './utils'

const { locale, t } = useI18n()
const { hasPermission } = usePermission()

const canQuery = computed(() => hasPermission('system:metrics:query'))

const rawText = ref('')
const loading = ref(false)
const lastUpdatedTime = ref<string>('')
const autoRefreshInterval = ref<number>(0)
let timer: ReturnType<typeof setInterval> | null = null

// Search in raw metrics
const rawSearchQuery = ref('')
// Filter by HTTP method in table
const selectedMethodFilter = ref<string>('ALL')
// Raw inspector collapsed state
const rawInspectorOpen = ref<boolean>(false)

const samples = computed<PromSample[]>(() => parsePrometheus(rawText.value))

const startedAtTimestamp = computed(() =>
  findSample(samples.value, 'process_start_time_seconds'),
)

const startedAtFormatted = computed(() => {
  if (!startedAtTimestamp.value) return '-'
  const date = new Date(startedAtTimestamp.value * 1000)
  if (Number.isNaN(date.getTime())) return '-'
  try {
    return new Intl.DateTimeFormat(locale.value, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date)
  } catch {
    return date.toLocaleString()
  }
})

const uptime = computed(() => {
  if (startedAtTimestamp.value === undefined) return '-'
  return formatUptime(Date.now() / 1000 - startedAtTimestamp.value)
})

const cpuTime = computed(() =>
  formatSeconds(findSample(samples.value, 'process_cpu_seconds_total')),
)

const residentMemoryBytes = computed(() =>
  findSample(samples.value, 'process_resident_memory_bytes'),
)
const residentMemory = computed(() => formatBytes(residentMemoryBytes.value))

const externalMemoryBytes = computed(() =>
  findSample(samples.value, 'nodejs_external_memory_bytes'),
)
const externalMemory = computed(() => formatBytes(externalMemoryBytes.value))

const heapUsedBytes = computed(() =>
  findSample(samples.value, 'nodejs_heap_size_used_bytes'),
)
const heapTotalBytes = computed(() =>
  findSample(samples.value, 'nodejs_heap_size_total_bytes'),
)

const heapUsagePercent = computed(() =>
  getHeapUsagePercentage(heapUsedBytes.value, heapTotalBytes.value),
)

const heapMemory = computed(() => {
  if (heapUsedBytes.value === undefined || heapTotalBytes.value === undefined) return '-'
  return `${formatBytes(heapUsedBytes.value)} / ${formatBytes(heapTotalBytes.value)}`
})

const eventLoopLagSeconds = computed(() =>
  findSample(samples.value, 'nodejs_eventloop_lag_seconds', { quantile: '0.5' }),
)

const eventLoopLag = computed(() => {
  if (eventLoopLagSeconds.value === undefined) return '-'
  return `${(eventLoopLagSeconds.value * 1000).toFixed(1)}ms`
})

const eventLoopHealthState = computed(() =>
  getEventLoopStatus(eventLoopLagSeconds.value),
)

const activeHandles = computed(() =>
  sumSamples(samples.value, 'nodejs_active_handles'),
)
const activeRequests = computed(() =>
  sumSamples(samples.value, 'nodejs_active_requests'),
)

const allHttpRows = computed<HttpRequestStat[]>(() =>
  httpRequestStats(samples.value),
)

const totalHttpTrafficCount = computed(() =>
  allHttpRows.value.reduce((acc, cur) => acc + cur.count, 0),
)

const filteredHttpRows = computed<HttpRequestStat[]>(() => {
  if (selectedMethodFilter.value === 'ALL') {
    return allHttpRows.value
  }
  return allHttpRows.value.filter(
    (row) => row.method.toUpperCase() === selectedMethodFilter.value,
  )
})

const httpColumns = computed<ProTableColumn<HttpRequestStat>[]>(() => [
  {
    prop: 'method',
    label: t('metrics.httpMethod'),
    width: 110,
    align: 'center',
  },
  {
    prop: 'route',
    label: t('metrics.httpRoute'),
    minWidth: 260,
    showOverflowTooltip: true,
  },
  {
    prop: 'statusCode',
    label: t('metrics.httpStatusCode'),
    width: 110,
    align: 'center',
  },
  {
    prop: 'count',
    label: t('metrics.httpCount'),
    width: 140,
    align: 'right',
  },
])

const filteredRawLines = computed(() => {
  if (!rawText.value) return []
  const lines = rawText.value.split('\n')
  if (!rawSearchQuery.value.trim()) return lines
  const q = rawSearchQuery.value.trim().toLowerCase()
  return lines.filter((line) => line.toLowerCase().includes(q))
})

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message
  if (error instanceof Error) return error.message
  return t('metrics.requestFailed')
}

async function requestHttpStats(params: ProTableRequestParams) {
  const start = (params.page - 1) * params.pageSize
  const items = filteredHttpRows.value.slice(start, start + params.pageSize)
  return {
    items,
    total: filteredHttpRows.value.length,
  }
}

async function loadMetrics(): Promise<void> {
  if (!canQuery.value) return
  loading.value = true
  try {
    rawText.value = await fetchMetricsText()
    const now = new Date()
    lastUpdatedTime.value = now.toTimeString().split(' ')[0] ?? ''
  } catch (error) {
    message.error(errorMessage(error))
  } finally {
    loading.value = false
  }
}

function handleAutoRefreshChange(val: string | number): void {
  const seconds = Number(val)
  autoRefreshInterval.value = seconds
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  if (seconds > 0) {
    timer = setInterval(() => {
      void loadMetrics()
    }, seconds * 1000)
  }
}

async function copyRawMetrics(): Promise<void> {
  if (!rawText.value) return
  try {
    await navigator.clipboard.writeText(rawText.value)
    message.success(t('metrics.copySuccess'))
  } catch {
    message.error('Copy failed')
  }
}

onMounted(() => {
  void loadMetrics()
})

onBeforeUnmount(() => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
})
</script>

<template>
  <div class="metrics-container">
    <!-- 顶部监控控制台 -->
    <div class="metrics-header">
      <div class="header-left">
        <div class="header-badge">
          <DashboardOutlined class="header-badge-icon" />
          <span>{{ t('metrics.title') }}</span>
        </div>
        <p class="header-sub">
          {{ t('metrics.subtitle') }}
        </p>
      </div>

      <div class="header-actions">
        <!-- 自动轮询控制 -->
        <div class="refresh-controls">
          <span class="refresh-label">{{ t('metrics.autoRefresh') }}:</span>
          <Segmented
            :value="autoRefreshInterval"
            :options="[
              { label: t('metrics.autoRefreshOff'), value: 0 },
              { label: t('metrics.autoRefresh10s'), value: 10 },
              { label: t('metrics.autoRefresh30s'), value: 30 },
              { label: t('metrics.autoRefresh60s'), value: 60 },
            ]"
            size="small"
            @change="handleAutoRefreshChange"
          />
        </div>

        <Tooltip v-if="lastUpdatedTime" :title="`${t('metrics.lastUpdated')} ${lastUpdatedTime}`">
          <div class="last-updated-badge">
            <ClockCircleOutlined />
            <span>{{ lastUpdatedTime }}</span>
          </div>
        </Tooltip>

        <Button
          type="primary"
          :loading="loading"
          :disabled="!canQuery"
          class="refresh-btn"
          @click="loadMetrics"
        >
          <ReloadOutlined />
          {{ t('metrics.refresh') }}
        </Button>
      </div>
    </div>

    <!-- 运行状态横幅 -->
    <div class="status-banner">
      <div class="status-meta">
        <Tag color="green" class="status-live-tag">
          <span class="status-pulse-dot" />
          {{ t('metrics.statusNormal') }}
        </Tag>
        <span class="status-divider">•</span>
        <span class="status-item">
          {{ t('metrics.uptime') }}: <strong>{{ uptime }}</strong>
        </span>
        <span class="status-divider">•</span>
        <span class="status-item">
          {{ t('metrics.startedAt') }}: <strong>{{ startedAtFormatted }}</strong>
        </span>
      </div>
    </div>

    <!-- Node.js 运行时 4 大核心体征卡片 -->
    <div class="vitals-grid">
      <!-- 1. V8 堆内存 -->
      <Card variant="borderless" class="vital-card hover-lift">
        <div class="vital-card-inner">
          <div class="vital-icon-box bg-gradient-to-br from-indigo-500 to-blue-600">
            <DashboardOutlined />
          </div>
          <div class="vital-body">
            <Statistic
              :title="t('metrics.heapMemory')"
              :value="heapMemory"
              class="vital-stat"
            />
            <div class="vital-progress-box">
              <div class="vital-progress-labels">
                <span class="vital-sub-text">{{ t('metrics.heapUsageRate') }}</span>
                <span class="vital-sub-num text-blue-600">{{ heapUsagePercent }}%</span>
              </div>
              <Progress
                :percent="heapUsagePercent"
                :show-info="false"
                stroke-color="#3b82f6"
                size="small"
              />
            </div>
            <div class="vital-bottom-tags">
              <span class="vital-mini-stat">RSS: {{ residentMemory }}</span>
              <span class="vital-mini-stat">Ext: {{ externalMemory }}</span>
            </div>
          </div>
        </div>
      </Card>

      <!-- 2. CPU 计算耗时 -->
      <Card variant="borderless" class="vital-card hover-lift">
        <div class="vital-card-inner">
          <div class="vital-icon-box bg-gradient-to-br from-amber-500 to-orange-600">
            <ThunderboltOutlined />
          </div>
          <div class="vital-body">
            <Statistic
              :title="t('metrics.cpuTime')"
              :value="cpuTime"
              class="vital-stat"
            />
            <div class="vital-bottom-info">
              <span class="vital-sub-text">{{ t('metrics.cpuSeconds') }}</span>
              <Tag color="orange" class="vital-tag">V8 Engine</Tag>
            </div>
          </div>
        </div>
      </Card>

      <!-- 3. 事件循环延迟 -->
      <Card variant="borderless" class="vital-card hover-lift">
        <div class="vital-card-inner">
          <div class="vital-icon-box bg-gradient-to-br from-emerald-500 to-teal-600">
            <ClockCircleOutlined />
          </div>
          <div class="vital-body">
            <Statistic
              :title="t('metrics.eventLoopLag')"
              :value="eventLoopLag"
              class="vital-stat"
            />
            <div class="vital-bottom-info">
              <span class="vital-sub-text">{{ t('metrics.eventLoopLagP50') }}</span>
              <Tag
                :color="
                  eventLoopHealthState === 'healthy'
                    ? 'green'
                    : eventLoopHealthState === 'warning'
                      ? 'orange'
                      : 'red'
                "
                class="vital-tag"
              >
                {{
                  eventLoopHealthState === 'healthy'
                    ? t('metrics.eventLoopStatusHealthy')
                    : eventLoopHealthState === 'warning'
                      ? t('metrics.eventLoopStatusWarning')
                      : t('metrics.eventLoopStatusCritical')
                }}
              </Tag>
            </div>
          </div>
        </div>
      </Card>

      <!-- 4. 并发与 I/O 句柄 -->
      <Card variant="borderless" class="vital-card hover-lift">
        <div class="vital-card-inner">
          <div class="vital-icon-box bg-gradient-to-br from-purple-500 to-pink-600">
            <ApiOutlined />
          </div>
          <div class="vital-body">
            <Statistic
              :title="t('metrics.activeHandles')"
              :value="activeHandles ?? '-'"
              class="vital-stat"
            />
            <div class="vital-bottom-info">
              <span class="vital-sub-text">
                {{ t('metrics.activeRequests') }}:
                <strong class="text-purple-600">{{ activeRequests ?? '-' }}</strong>
              </span>
              <Tag color="purple" class="vital-tag">Async I/O</Tag>
            </div>
          </div>
        </div>
      </Card>
    </div>

    <!-- HTTP 接口流量与路由分析表格 -->
    <Card variant="borderless" class="traffic-card">
      <template #title>
        <div class="traffic-card-header">
          <div class="traffic-title-wrap">
            <ApiOutlined class="text-blue-500" />
            <span class="traffic-title">{{ t('metrics.trafficTitle') }}</span>
            <Tag color="blue" class="traffic-count-tag">
              {{ t('metrics.totalRequests') }}: {{ totalHttpTrafficCount }}
            </Tag>
          </div>

          <!-- HTTP Method 快速筛选 -->
          <div class="traffic-filters">
            <span class="filter-label">
              <FilterOutlined /> {{ t('metrics.filterMethod') }}:
            </span>
            <Segmented
              v-model:value="selectedMethodFilter"
              :options="[
                { label: t('metrics.filterAll'), value: 'ALL' },
                { label: 'GET', value: 'GET' },
                { label: 'POST', value: 'POST' },
                { label: 'PUT', value: 'PUT' },
                { label: 'DELETE', value: 'DELETE' },
              ]"
              size="small"
            />
          </div>
        </div>
      </template>

      <ProTable
        :key="selectedMethodFilter"
        :columns="httpColumns"
        :request="requestHttpStats"
        :immediate="canQuery"
        :show-request-error="false"
        :search-fields="[]"
        :pagination="{ pageSize: 10 }"
      >
        <!-- 自定义 Method 渲染 -->
        <template #bodyCell="{ column, record }">
          <template v-if="column.prop === 'method'">
            <Tag :color="getMethodTagColor(record.method)" class="font-mono font-bold">
              {{ record.method }}
            </Tag>
          </template>

          <template v-else-if="column.prop === 'route'">
            <span class="font-mono text-slate-700">{{ record.route }}</span>
          </template>

          <template v-else-if="column.prop === 'statusCode'">
            <Tag :color="getStatusCodeTagColor(record.statusCode)" class="font-mono">
              {{ record.statusCode }}
            </Tag>
          </template>

          <template v-else-if="column.prop === 'count'">
            <span class="font-semibold text-slate-900">{{ record.count }}</span>
          </template>
        </template>
      </ProTable>
    </Card>

    <!-- Prometheus 原始指标检视器 -->
    <Card variant="borderless" class="raw-inspector-card">
      <div class="raw-inspector-header">
        <div class="raw-header-left">
          <span class="raw-title">{{ t('metrics.rawMetrics') }}</span>
          <span class="raw-count-badge">{{ filteredRawLines.length }} lines</span>
        </div>

        <div class="raw-header-actions">
          <Input
            v-model:value="rawSearchQuery"
            :placeholder="t('metrics.searchMetrics')"
            size="small"
            allow-clear
            class="raw-search-input"
          >
            <template #prefix>
              <SearchOutlined class="text-slate-400" />
            </template>
          </Input>

          <Button size="small" class="raw-btn" @click="copyRawMetrics">
            <CopyOutlined />
            {{ t('metrics.copyRaw') }}
          </Button>

          <Button
            size="small"
            class="raw-btn"
            @click="rawInspectorOpen = !rawInspectorOpen"
          >
            {{ rawInspectorOpen ? t('proTable.collapse') : t('proTable.expand') }}
          </Button>
        </div>
      </div>

      <div v-show="rawInspectorOpen" class="raw-content-box">
        <pre class="raw-code-block">{{ filteredRawLines.join('\n') || t('metrics.empty') }}</pre>
      </div>
    </Card>
  </div>
</template>

<style scoped lang="scss">
.metrics-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 100%;
  padding-bottom: 24px;
}

.metrics-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.header-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
}

.header-badge-icon {
  font-size: 22px;
  color: #3b82f6;
}

.header-sub {
  margin: 4px 0 0;
  font-size: 13px;
  color: #64748b;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.refresh-controls {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.refresh-label {
  font-size: 12px;
  color: #64748b;
}

.last-updated-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #64748b;
  background: #f1f5f9;
  padding: 4px 10px;
  border-radius: 6px;
}

.refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 6px;
  font-weight: 500;
}

.status-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  background: #ffffff;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}

.status-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: #475569;
  flex-wrap: wrap;
}

.status-live-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  border-radius: 4px;
}

.status-pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10b981;
  animation: live-pulse 1.8s infinite;
}

@keyframes live-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.8); }
}

.status-divider {
  color: #cbd5e1;
}

.vitals-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}

.vital-card {
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
  transition: all 0.25s ease;

  :deep(.ant-card-body) {
    padding: 18px 20px;
  }
}

.hover-lift:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px -3px rgba(0, 0, 0, 0.07);
  border-color: #cbd5e1;
}

.vital-card-inner {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.vital-icon-box {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 22px;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.vital-body {
  flex: 1;
  min-width: 0;
}

.vital-stat {
  :deep(.ant-statistic-title) {
    font-size: 13px;
    color: #64748b;
    margin-bottom: 4px;
    font-weight: 500;
  }

  :deep(.ant-statistic-content-value) {
    font-size: 22px;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: -0.02em;
  }
}

.vital-progress-box {
  margin-top: 8px;
}

.vital-progress-labels {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  margin-bottom: 2px;
}

.vital-sub-text {
  font-size: 12px;
  color: #64748b;
}

.vital-sub-num {
  font-size: 12px;
  font-weight: 600;
}

.vital-bottom-tags {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.vital-mini-stat {
  font-size: 11px;
  color: #64748b;
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
}

.vital-bottom-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
}

.vital-tag {
  margin: 0;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.traffic-card {
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid #e2e8f0;

  :deep(.ant-card-head) {
    padding: 14px 20px;
    border-bottom: 1px solid #f1f5f9;
  }

  :deep(.ant-card-body) {
    padding: 16px 20px 20px;
  }
}

.traffic-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.traffic-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.traffic-title {
  font-size: 15px;
  font-weight: 600;
  color: #0f172a;
}

.traffic-count-tag {
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.traffic-filters {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-label {
  font-size: 12px;
  color: #64748b;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.raw-inspector-card {
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid #e2e8f0;

  :deep(.ant-card-body) {
    padding: 16px 20px;
  }
}

.raw-inspector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.raw-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.raw-title {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
}

.raw-count-badge {
  font-size: 11px;
  color: #64748b;
  background: #f1f5f9;
  padding: 2px 8px;
  border-radius: 12px;
}

.raw-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.raw-search-input {
  width: 220px;
}

.raw-btn {
  border-radius: 6px;
  font-size: 12px;
}

.raw-content-box {
  margin-top: 14px;
}

.raw-code-block {
  margin: 0;
  max-height: 420px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.6;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  background: #0f172a;
  color: #e2e8f0;
  border-radius: 8px;
  padding: 14px 18px;
  border: 1px solid #1e293b;
}
</style>
