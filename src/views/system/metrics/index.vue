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
  Tag,
  Tooltip,
  message,
} from 'antdv-next'
import {
  ApiOutlined,
  ClockCircleOutlined,
  CloudServerOutlined,
  CopyOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  ReloadOutlined,
  SearchOutlined,
  ThunderboltOutlined,
} from '@antdv-next/icons'

import { fetchDetailedHealthStatus, fetchMetricsText } from '@/api/metrics'
import ProTable from '@/components/ProTable/index.vue'
import { usePermission } from '@/composables/usePermission'
import type { DetailedHealthStatus } from '@/types/health'
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
const detailedHealth = ref<DetailedHealthStatus | null>(null)
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

const startedAtTimestamp = computed(() => findSample(samples.value, 'process_start_time_seconds'))

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

const heapUsedBytes = computed(() => findSample(samples.value, 'nodejs_heap_size_used_bytes'))
const heapTotalBytes = computed(() => findSample(samples.value, 'nodejs_heap_size_total_bytes'))

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

const eventLoopHealthState = computed(() => getEventLoopStatus(eventLoopLagSeconds.value))

const activeHandles = computed(() => sumSamples(samples.value, 'nodejs_active_handles'))
const activeRequests = computed(() => sumSamples(samples.value, 'nodejs_active_requests'))

const allHttpRows = computed<HttpRequestStat[]>(() => httpRequestStats(samples.value))

const totalHttpTrafficCount = computed(() =>
  allHttpRows.value.reduce((acc, cur) => acc + cur.count, 0),
)

const filteredHttpRows = computed<HttpRequestStat[]>(() => {
  if (selectedMethodFilter.value === 'ALL') {
    return allHttpRows.value
  }
  return allHttpRows.value.filter((row) => row.method.toUpperCase() === selectedMethodFilter.value)
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
    const [metricsResult, healthResult] = await Promise.allSettled([
      fetchMetricsText(),
      fetchDetailedHealthStatus(),
    ])

    if (metricsResult.status === 'fulfilled') {
      rawText.value = metricsResult.value
    } else {
      message.error(errorMessage(metricsResult.reason))
    }

    if (healthResult.status === 'fulfilled') {
      detailedHealth.value = healthResult.value
    }

    const now = new Date()
    lastUpdatedTime.value = now.toTimeString().split(' ')[0] ?? ''
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
  <div class="metrics-workbench">
    <!-- 顶部监控指令横幅 (Command Strip) -->
    <div class="command-strip">
      <div class="command-strip__main">
        <div class="command-strip__avatar-wrap">
          <div class="command-strip__icon-badge">
            <DashboardOutlined />
          </div>
          <span class="command-strip__status-dot" />
        </div>

        <div class="command-strip__meta">
          <div class="command-strip__title-row">
            <h1 class="command-strip__greeting">{{ t('metrics.title') }}</h1>
            <div class="command-strip__live-pill">
              <span class="live-pulse-dot" />
              <span class="live-pulse-text">{{ t('metrics.statusNormal') }}</span>
              <span class="live-pulse-sep">·</span>
              <span class="live-pulse-sla">{{ t('metrics.uptime') }} {{ uptime }}</span>
            </div>
          </div>
          <div class="command-strip__sub-row">
            <span class="command-strip__tag">
              <span class="command-strip__tag-label">{{ t('metrics.startedAt') }}:</span>
              <span class="command-strip__tag-value">{{ startedAtFormatted }}</span>
            </span>
            <span class="command-strip__divider">/</span>
            <span class="command-strip__tag">
              <span class="command-strip__tag-label">{{ t('metrics.totalRequests') }}:</span>
              <span class="command-strip__tag-value">{{ totalHttpTrafficCount }}</span>
            </span>
            <span class="command-strip__divider">/</span>
            <span class="command-strip__tag">
              <span class="command-strip__tag-label">{{ t('metrics.lastUpdated') }}:</span>
              <span class="command-strip__tag-value">{{ lastUpdatedTime || '-' }}</span>
            </span>
          </div>
        </div>
      </div>

      <div class="command-strip__actions">
        <div class="refresh-controls">
          <span class="refresh-label">{{ t('metrics.autoRefresh') }}</span>
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
          class="action-btn action-btn--primary"
          :loading="loading"
          :disabled="!canQuery"
          @click="loadMetrics"
        >
          <ReloadOutlined />
          <span>{{ t('metrics.refresh') }}</span>
        </Button>
      </div>
    </div>

    <!-- Node.js 运行时四大核心体征卡 (Hero KPI Cards) -->
    <div class="kpi-grid">
      <!-- 1. V8 堆内存 -->
      <div class="kpi-card kpi-card--static">
        <div class="kpi-card__header">
          <div class="kpi-card__title-box">
            <div class="kpi-card__icon-badge kpi-card__icon-badge--blue">
              <DashboardOutlined />
            </div>
            <span class="kpi-card__label">{{ t('metrics.heapMemory') }}</span>
          </div>
          <span class="trend-badge trend-badge--up">{{ heapUsagePercent }}%</span>
        </div>

        <div class="kpi-card__metric">
          <span class="metric-number">{{ heapMemory }}</span>
          <span class="metric-caption">{{ t('metrics.heapUsageRate') }}</span>
        </div>

        <div class="kpi-card__progress-box">
          <Progress
            :percent="heapUsagePercent"
            :show-info="false"
            stroke-color="#3b82f6"
            size="small"
          />
        </div>

        <div class="kpi-card__footer">
          <span class="footer-link-text">RSS {{ residentMemory }} · Ext {{ externalMemory }}</span>
        </div>
      </div>

      <!-- 2. CPU 计算耗时 -->
      <div class="kpi-card kpi-card--static">
        <div class="kpi-card__header">
          <div class="kpi-card__title-box">
            <div class="kpi-card__icon-badge kpi-card__icon-badge--amber">
              <ThunderboltOutlined />
            </div>
            <span class="kpi-card__label">{{ t('metrics.cpuTime') }}</span>
          </div>
          <span class="launchpad-pill-tag">V8 Engine</span>
        </div>

        <div class="kpi-card__metric">
          <span class="metric-number">{{ cpuTime }}</span>
          <span class="metric-caption">{{ t('metrics.cpuSeconds') }}</span>
        </div>

        <div class="kpi-card__footer">
          <span class="footer-mono">process_cpu_seconds_total</span>
        </div>
      </div>

      <!-- 3. 事件循环延迟 -->
      <div class="kpi-card kpi-card--static">
        <div class="kpi-card__header">
          <div class="kpi-card__title-box">
            <div class="kpi-card__icon-badge kpi-card__icon-badge--emerald">
              <ClockCircleOutlined />
            </div>
            <span class="kpi-card__label">{{ t('metrics.eventLoopLag') }}</span>
          </div>
          <span
            :class="[
              'trend-badge',
              eventLoopHealthState === 'healthy'
                ? 'trend-badge--emerald'
                : eventLoopHealthState === 'warning'
                  ? 'trend-badge--amber'
                  : 'trend-badge--rose',
            ]"
          >
            {{
              eventLoopHealthState === 'healthy'
                ? t('metrics.eventLoopStatusHealthy')
                : eventLoopHealthState === 'warning'
                  ? t('metrics.eventLoopStatusWarning')
                  : t('metrics.eventLoopStatusCritical')
            }}
          </span>
        </div>

        <div class="kpi-card__metric">
          <span class="metric-number">{{ eventLoopLag }}</span>
          <span class="metric-caption">{{ t('metrics.eventLoopLagP50') }}</span>
        </div>

        <div class="kpi-card__footer">
          <span class="footer-mono">nodejs_eventloop_lag_seconds</span>
        </div>
      </div>

      <!-- 4. 并发与 I/O 句柄 -->
      <div class="kpi-card kpi-card--static">
        <div class="kpi-card__header">
          <div class="kpi-card__title-box">
            <div class="kpi-card__icon-badge kpi-card__icon-badge--purple">
              <ApiOutlined />
            </div>
            <span class="kpi-card__label">{{ t('metrics.ioTitle') }}</span>
          </div>
          <span class="launchpad-pill-tag">Async I/O</span>
        </div>

        <div class="kpi-card__metric">
          <span class="metric-number">{{ activeHandles ?? '-' }}</span>
          <span class="metric-caption">
            {{ t('metrics.activeRequests') }}: {{ activeRequests ?? '-' }}
          </span>
        </div>

        <div class="kpi-card__footer">
          <span class="footer-mono">nodejs_active_handles</span>
        </div>
      </div>
    </div>

    <!-- 下半部分：双栏观测与基座 (Two-Column Workspace Feeds) -->
    <Row :gutter="[20, 20]" class="workbench-split">
      <!-- 左侧：流量分析与原始指标 -->
      <Col :xs="24" :lg="15" class="split-col">
        <!-- HTTP 接口流量与路由分析 -->
        <Card variant="borderless" class="workbench-panel">
          <template #title>
            <div class="panel-header-title">
              <ApiOutlined class="panel-title-icon text-blue-500" />
              <span>{{ t('metrics.trafficTitle') }}</span>
              <span class="panel-badge-count">{{ totalHttpTrafficCount }}</span>
            </div>
          </template>
          <template #extra>
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
            <template #column-method="{ row }">
              <Tag :color="getMethodTagColor(row.method)" class="font-mono font-bold">
                {{ row.method }}
              </Tag>
            </template>

            <template #column-route="{ row }">
              <span class="http-route font-mono">{{ row.route }}</span>
            </template>

            <template #column-statusCode="{ row }">
              <Tag :color="getStatusCodeTagColor(row.statusCode)" class="font-mono">
                {{ row.statusCode }}
              </Tag>
            </template>

            <template #column-count="{ row }">
              <span class="http-count">{{ row.count }}</span>
            </template>
          </ProTable>
        </Card>

        <!-- Prometheus 原始指标检视器 -->
        <Card variant="borderless" class="workbench-panel">
          <template #title>
            <div class="panel-header-title">
              <SearchOutlined class="panel-title-icon text-slate-500" />
              <span>{{ t('metrics.rawMetrics') }}</span>
              <span class="raw-count-badge">{{ filteredRawLines.length }} lines</span>
            </div>
          </template>
          <template #extra>
            <Button
              type="link"
              size="small"
              class="panel-extra-link"
              @click="rawInspectorOpen = !rawInspectorOpen"
            >
              {{ rawInspectorOpen ? t('proTable.collapse') : t('proTable.expand') }} →
            </Button>
          </template>

          <div class="raw-toolbar">
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

            <Button size="small" class="action-btn action-btn--ghost" @click="copyRawMetrics">
              <CopyOutlined />
              <span>{{ t('metrics.copyRaw') }}</span>
            </Button>
          </div>

          <div v-show="rawInspectorOpen" class="raw-content-box">
            <pre class="raw-code-block">{{ filteredRawLines.join('\n') || t('metrics.empty') }}</pre>
          </div>
        </Card>
      </Col>

      <!-- 右侧：依赖基座速览 -->
      <Col :xs="24" :lg="9" class="split-col">
        <!-- PostgreSQL 数据库 -->
        <Card variant="borderless" class="workbench-panel">
          <template #title>
            <div class="panel-header-title">
              <DatabaseOutlined class="panel-title-icon text-cyan-500" />
              <span>{{ t('metrics.databaseTitle') }}</span>
            </div>
          </template>
          <template #extra>
            <Tag
              :color="
                detailedHealth?.database?.status === 'up'
                  ? 'green'
                  : detailedHealth
                    ? 'red'
                    : 'default'
              "
              class="panel-status-tag"
            >
              {{
                detailedHealth?.database?.status === 'up'
                  ? t('metrics.statusUp')
                  : detailedHealth
                    ? t('metrics.statusDown')
                    : '-'
              }}
            </Tag>
          </template>

          <div class="spec-list">
            <div class="spec-row">
              <span class="spec-label">{{ t('metrics.databaseLatency') }}</span>
              <span class="spec-pill spec-pill--cyan">
                {{ detailedHealth?.database ? `${detailedHealth.database.latencyMs}ms` : '-' }}
              </span>
            </div>
            <div v-if="detailedHealth?.database?.version" class="spec-row">
              <span class="spec-label">{{ t('metrics.databaseVersion') }}</span>
              <span class="spec-mono" :title="detailedHealth.database.version">
                {{ detailedHealth.database.version }}
              </span>
            </div>
          </div>
        </Card>

        <!-- Redis 缓存服务 -->
        <Card variant="borderless" class="workbench-panel">
          <template #title>
            <div class="panel-header-title">
              <CloudServerOutlined class="panel-title-icon text-rose-500" />
              <span>{{ t('metrics.redisTitle') }}</span>
            </div>
          </template>
          <template #extra>
            <Tag
              :color="
                detailedHealth?.redis?.status === 'up'
                  ? 'green'
                  : detailedHealth
                    ? 'red'
                    : 'default'
              "
              class="panel-status-tag"
            >
              {{
                detailedHealth?.redis?.status === 'up'
                  ? t('metrics.statusUp')
                  : detailedHealth
                    ? t('metrics.statusDown')
                    : '-'
              }}
            </Tag>
          </template>

          <div class="spec-list">
            <div class="spec-row">
              <span class="spec-label">{{ t('metrics.redisLatency') }}</span>
              <span class="spec-pill spec-pill--amber">
                {{ detailedHealth?.redis ? `${detailedHealth.redis.latencyMs}ms` : '-' }}
              </span>
            </div>
            <div v-if="detailedHealth?.redis?.usedMemoryHuman" class="spec-row">
              <span class="spec-label">{{ t('metrics.redisMemory') }}</span>
              <span class="spec-mono">{{ detailedHealth.redis.usedMemoryHuman }}</span>
            </div>
            <div v-if="detailedHealth?.redis?.connectedClients !== undefined" class="spec-row">
              <span class="spec-label">{{ t('metrics.redisClients') }}</span>
              <span class="spec-pill spec-pill--blue">
                {{ detailedHealth.redis.connectedClients }}
              </span>
            </div>
          </div>
        </Card>
      </Col>
    </Row>
  </div>
</template>

<style scoped lang="scss">
.metrics-workbench {
  padding-bottom: 24px;
}

/* 1. 顶部指令横幅 (Command Strip, 与首页工作台同源) */
.command-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: #ffffff;
  border: 1px solid #eaedf3;
  border-radius: 12px;
  margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
  transition: all 0.2s ease;

  @media (max-width: 860px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
  }
}

.command-strip__main {
  display: flex;
  align-items: center;
  gap: 16px;
}

.command-strip__avatar-wrap {
  position: relative;
  flex-shrink: 0;
}

.command-strip__icon-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  font-size: 22px;
  color: #3b82f6;
  background-color: #eff6ff;
  border: 2px solid #ffffff;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.18);
}

.command-strip__status-dot {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 12px;
  height: 12px;
  background-color: #10b981;
  border: 2px solid #ffffff;
  border-radius: 50%;
}

.command-strip__title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.command-strip__greeting {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.01em;
}

.command-strip__live-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 10px;
  background-color: #ecfdf5;
  border: 1px solid #d1fae5;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 500;
  color: #047857;
}

.live-pulse-dot {
  width: 6px;
  height: 6px;
  background-color: #10b981;
  border-radius: 50%;
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.25);
  animation: pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse-ring {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.15);
  }
}

.live-pulse-sep {
  opacity: 0.5;
}

.live-pulse-sla {
  font-weight: 600;
}

.command-strip__sub-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  font-size: 13px;
  color: #64748b;
  flex-wrap: wrap;
}

.command-strip__tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.command-strip__tag-label {
  color: #94a3b8;
}

.command-strip__tag-value {
  color: #334155;
  font-weight: 500;
}

.command-strip__divider {
  color: #cbd5e1;
}

.command-strip__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.refresh-controls {
  display: inline-flex;
  align-items: center;
  gap: 8px;
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

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.action-btn--ghost {
  border-color: #e2e8f0;
  color: #475569;
  background: #ffffff;

  &:hover {
    color: var(--app-color-primary, #3b82f6);
    border-color: var(--app-color-primary, #3b82f6);
    background: #f8fafc;
  }
}

.action-btn--primary {
  box-shadow: 0 1px 3px rgba(37, 99, 235, 0.15);
}

/* 2. 四大核心体征指标卡 (Hero KPI Cards, 与首页同源) */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;

  @media (max-width: 1100px) {
    grid-template-columns: repeat(2, 1fr);
  }
  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
}

.kpi-card {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 18px 20px 14px;
  background: #ffffff;
  border: 1px solid #eaedf3;
  border-radius: 12px;
  cursor: pointer;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    transform: translateY(-2px);
    border-color: #cbd5e1;
    box-shadow: 0 8px 20px rgba(15, 23, 42, 0.07);
  }
}

.kpi-card--static {
  cursor: default;
}

.kpi-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}

.kpi-card__title-box {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.kpi-card__icon-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  font-size: 14px;
  flex-shrink: 0;
}

.kpi-card__icon-badge--blue {
  background-color: #eff6ff;
  color: #3b82f6;
}

.kpi-card__icon-badge--emerald {
  background-color: #ecfdf5;
  color: #10b981;
}

.kpi-card__icon-badge--amber {
  background-color: #fffbeb;
  color: #f59e0b;
}

.kpi-card__icon-badge--purple {
  background-color: #faf5ff;
  color: #a855f7;
}

.kpi-card__label {
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.trend-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
}

.trend-badge--up {
  background-color: #eff6ff;
  color: #2563eb;
  border: 1px solid #dbeafe;
}

.trend-badge--emerald {
  background-color: #ecfdf5;
  color: #059669;
  border: 1px solid #d1fae5;
}

.trend-badge--amber {
  background-color: #fffbeb;
  color: #d97706;
  border: 1px solid #fef3c7;
}

.trend-badge--rose {
  background-color: #fff1f2;
  color: #e11d48;
  border: 1px solid #ffe4e6;
}

.launchpad-pill-tag {
  font-size: 11px;
  font-weight: 500;
  color: #94a3b8;
  background-color: #f8fafc;
  border: 1px solid #f1f5f9;
  padding: 1px 6px;
  border-radius: 4px;
  white-space: nowrap;
  flex-shrink: 0;
}

.kpi-card__metric {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.metric-number {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.1;
  color: #0f172a;
  letter-spacing: -0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.metric-caption {
  font-size: 12px;
  color: #94a3b8;
  white-space: nowrap;
  flex-shrink: 0;
}

.kpi-card__progress-box {
  width: 100%;
  margin: 4px 0 10px;
}

.kpi-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 10px;
  border-top: 1px solid #f1f5f9;
  font-size: 12px;
  color: #64748b;
  transition: all 0.2s;
  margin-top: auto;
}

.footer-link-text {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.footer-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  color: #94a3b8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 3. 双栏观测与基座面板 (Workbench Panels, 与首页同源) */
.workbench-panel {
  background: #ffffff;
  border: 1px solid #eaedf3;
  border-radius: 12px;
  margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.02);

  :deep(.ant-card-head) {
    padding: 14px 18px;
    border-bottom: 1px solid #f1f5f9;
    min-height: auto;
  }
  :deep(.ant-card-body) {
    padding: 16px 18px;
  }
}

.split-col {
  :last-child.workbench-panel {
    margin-bottom: 0;
  }
}

.panel-header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
}

.panel-title-icon {
  font-size: 15px;
}

.panel-badge-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  background-color: #f59e0b;
  color: #ffffff;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 600;
}

.panel-extra-link {
  padding: 0;
  font-size: 12px;
  color: #64748b;

  &:hover {
    color: var(--app-color-primary, #3b82f6);
  }
}

.panel-status-tag {
  margin: 0;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.http-route {
  color: #334155;
}

.http-count {
  font-weight: 600;
  color: #0f172a;
}

/* 原始指标检视器 */
.raw-count-badge {
  font-size: 11px;
  color: #64748b;
  background: #f1f5f9;
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 500;
}

.raw-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.raw-search-input {
  width: 220px;
  flex: 1;
  min-width: 160px;
  max-width: 280px;
}

.raw-content-box {
  margin-top: 2px;
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

/* 依赖基座规格列表 (Spec List, 与首页同源) */
.spec-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.spec-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  background-color: #f8fafc;
  font-size: 12px;
}

.spec-label {
  color: #64748b;
  font-weight: 500;
  flex-shrink: 0;
}

.spec-pill {
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
  font-size: 11px;
  white-space: nowrap;
}

.spec-pill--cyan {
  background-color: #ecfeff;
  color: #0891b2;
}

.spec-pill--blue {
  background-color: #eff6ff;
  color: #2563eb;
}

.spec-pill--amber {
  background-color: #fffbeb;
  color: #d97706;
}

.spec-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  color: #334155;
  background-color: #f1f5f9;
  padding: 2px 8px;
  border-radius: 4px;
  max-width: 60%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ==========================================================================
   暗黑模式适配 (与首页工作台同源)
   ========================================================================== */
html.dark {
  .command-strip {
    background: #1c1d22;
    border-color: #2a2c33;
    box-shadow: none;
  }

  .command-strip__icon-badge {
    background-color: rgba(59, 130, 246, 0.15);
    color: #60a5fa;
    border-color: #1c1d22;
  }

  .command-strip__status-dot {
    border-color: #1c1d22;
  }

  .command-strip__greeting {
    color: #ffffff;
  }

  .command-strip__live-pill {
    background-color: rgba(16, 185, 129, 0.12);
    border-color: rgba(16, 185, 129, 0.25);
    color: #34d399;
  }

  .command-strip__tag-label {
    color: #64748b;
  }

  .command-strip__tag-value {
    color: #e2e8f0;
  }

  .command-strip__divider {
    color: #334155;
  }

  .refresh-label {
    color: #8b909a;
  }

  .last-updated-badge {
    background-color: #22242a;
    color: #8b909a;
  }

  .action-btn--ghost {
    background: #22242a;
    border-color: #2e3038;
    color: #cbd5e1;

    &:hover {
      background: #262830;
      border-color: #3b3e48;
      color: #ffffff;
    }
  }

  /* KPI 卡片 */
  .kpi-card {
    background: #1c1d22;
    border-color: #2a2c33;
    box-shadow: none;

    &:hover {
      border-color: #3e424e;
      background: #202228;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
    }
  }

  .kpi-card__label {
    color: #94a3b8;
  }

  .metric-number {
    color: #ffffff;
  }

  .metric-caption {
    color: #64748b;
  }

  .kpi-card__footer {
    border-top-color: #262830;
    color: #94a3b8;
  }

  .footer-mono {
    color: #64748b;
  }

  .kpi-card__icon-badge--blue {
    background-color: rgba(59, 130, 246, 0.15);
    color: #60a5fa;
  }

  .kpi-card__icon-badge--emerald {
    background-color: rgba(16, 185, 129, 0.15);
    color: #34d399;
  }

  .kpi-card__icon-badge--amber {
    background-color: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
  }

  .kpi-card__icon-badge--purple {
    background-color: rgba(168, 85, 247, 0.15);
    color: #c084fc;
  }

  .trend-badge--up {
    background-color: rgba(59, 130, 246, 0.12);
    border-color: rgba(59, 130, 246, 0.25);
    color: #60a5fa;
  }

  .trend-badge--emerald {
    background-color: rgba(16, 185, 129, 0.12);
    border-color: rgba(16, 185, 129, 0.25);
    color: #34d399;
  }

  .trend-badge--amber {
    background-color: rgba(245, 158, 11, 0.12);
    border-color: rgba(245, 158, 11, 0.25);
    color: #fbbf24;
  }

  .trend-badge--rose {
    background-color: rgba(244, 63, 94, 0.12);
    border-color: rgba(244, 63, 94, 0.25);
    color: #fb7185;
  }

  .launchpad-pill-tag {
    background-color: #22242a;
    border-color: #2e3038;
    color: #94a3b8;
  }

  /* 面板与列表 */
  .workbench-panel {
    background: #1c1d22;
    border-color: #2a2c33;

    :deep(.ant-card-head) {
      border-bottom-color: #262830;
    }
  }

  .panel-header-title {
    color: #ffffff;
  }

  .panel-extra-link {
    color: #8b909a;

    &:hover {
      color: #60a5fa;
    }
  }

  .http-route {
    color: #cbd5e1;
  }

  .http-count {
    color: #ffffff;
  }

  .raw-count-badge {
    background-color: #22242a;
    color: #8b909a;
  }

  .spec-row {
    background-color: #22242a;
  }

  .spec-label {
    color: #8b909a;
  }

  .spec-pill--cyan {
    background-color: rgba(6, 182, 212, 0.15);
    color: #22d3ee;
  }

  .spec-pill--blue {
    background-color: rgba(59, 130, 246, 0.15);
    color: #60a5fa;
  }

  .spec-pill--amber {
    background-color: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
  }

  .spec-mono {
    background-color: #262830;
    color: #cbd5e1;
  }
}
</style>
