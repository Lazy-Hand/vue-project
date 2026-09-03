<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  Button,
  Card,
  Col,
  Progress,
  Row,
  Segmented,
  Statistic,
  Tag,
  Tooltip,
  message,
} from 'antdv-next'
import {
  ArrowDownOutlined,
  ArrowRightOutlined,
  ArrowUpOutlined,
  ClockCircleOutlined,
  FolderOpenOutlined,
  GlobalOutlined,
  LineChartOutlined,
  LinkOutlined,
  MoreOutlined,
  ReloadOutlined,
  RightOutlined,
  SafetyCertificateOutlined,
  SafetyOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from '@antdv-next/icons'

import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'

import { fetchDashboardOverview, fetchDashboardTrends } from '@/api/dashboard'
import { usePermission } from '@/composables/usePermission'
import { useAppConfigStore } from '@/stores/app-config'
import type { DashboardDayTrend, DashboardOverview, DashboardTrends } from '@/types/dashboard'
import { ApiRequestError } from '@/utils/request'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent])

const { locale, t } = useI18n()
const router = useRouter()
const { hasPermission } = usePermission()
const appConfig = useAppConfigStore()

const canQuery = computed(() => hasPermission('system:dashboard:query'))

const overview = ref<DashboardOverview | null>(null)
const loading = ref(false)
const lastUpdatedTime = ref<string>('')

const trends = ref<DashboardTrends | null>(null)
const trendsLoading = ref(false)
const trendsDays = ref(7)
const autoRefreshInterval = ref<number>(0) // 0 = off, 30 = 30s, 60 = 60s
let timer: ReturnType<typeof setInterval> | null = null

const successRate = computed<string>(() => {
  const total = overview.value?.todayOperationCount ?? 0
  if (total <= 0) return '-'
  const failed = overview.value?.todayFailedOperationCount ?? 0
  return (((total - failed) / total) * 100).toFixed(1)
})

const numericSuccessRate = computed<number>(() => {
  const rate = Number.parseFloat(successRate.value)
  return Number.isNaN(rate) ? 100 : rate
})

const userActiveRate = computed<number>(() => {
  const total = overview.value?.userCount ?? 0
  if (total <= 0) return 0
  const enabled = overview.value?.enabledUserCount ?? 0
  return Math.min(100, Math.round((enabled / total) * 100))
})

const todaySuccessCount = computed<number>(() => {
  const total = overview.value?.todayOperationCount ?? 0
  const failed = overview.value?.todayFailedOperationCount ?? 0
  return Math.max(0, total - failed)
})

const healthScore = computed<number>(() => {
  if (!overview.value || (overview.value.todayOperationCount ?? 0) <= 0) return 96
  const rate = numericSuccessRate.value
  return Math.round(Math.min(100, Math.max(20, rate)))
})

const gaugeCircumference = 339.292 // 2 * PI * 54
const gaugeDashOffset = computed<number>(() => {
  const percent = Math.min(100, Math.max(0, healthScore.value))
  return gaugeCircumference * (1 - percent / 100)
})

function formatDateTime(value?: string | null): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  try {
    return new Intl.DateTimeFormat(locale.value, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date)
  } catch {
    return value
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message
  if (error instanceof Error) return error.message
  return t('dashboard.requestFailed')
}

async function loadOverview(): Promise<void> {
  if (!canQuery.value) return
  loading.value = true
  try {
    overview.value = await fetchDashboardOverview()
    const now = new Date()
    lastUpdatedTime.value = now.toTimeString().split(' ')[0] ?? ''
  } catch (error) {
    message.error(errorMessage(error))
  } finally {
    loading.value = false
  }
}

async function loadTrends(days: number): Promise<void> {
  if (!canQuery.value) return
  trendsLoading.value = true
  try {
    trends.value = await fetchDashboardTrends(days)
  } catch (error) {
    message.error(errorMessage(error))
  } finally {
    trendsLoading.value = false
  }
}

function handleTrendsDaysChange(val: string | number): void {
  const days = Number(val)
  trendsDays.value = days
  void loadTrends(days)
}

interface SparklineData {
  linePath: string
  areaPath: string
  lastPoint: { x: number; y: number }
}

function computeSparkline(data: number[], width = 160, height = 52): SparklineData {
  const safeData = data.length >= 2 ? data : [20, 28, 24, 38, 32, 46, 42, 54]
  const min = Math.min(...safeData)
  const max = Math.max(...safeData)
  const range = max - min || 1
  const paddingY = 8
  const innerH = height - paddingY * 2
  const stepX = width / (safeData.length - 1)

  const points = safeData.map((val, idx) => ({
    x: idx * stepX,
    y: height - paddingY - ((val - min) / range) * innerH,
  }))

  const first = points[0] ?? { x: 0, y: height / 2 }
  let linePath = `M ${first.x.toFixed(1)} ${first.y.toFixed(1)}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1] ?? first
    const p1 = points[i] ?? first
    const p2 = points[i + 1] ?? p1
    const p3 = points[i + 2] ?? p2
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    linePath += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }

  const lastPoint = points[points.length - 1] ?? first
  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`

  return { linePath, areaPath, lastPoint }
}

const slaSparkline = computed(() => {
  const raw = (trends.value?.days || []).map((d) =>
    d.operations > 0 ? ((d.operations - d.failedOperations) / d.operations) * 100 : 98,
  )
  return computeSparkline(raw.length >= 2 ? raw : [95, 96, 94, 98, 97, 99, 98, 99.2])
})

const operationsSparkline = computed(() => {
  const raw = (trends.value?.days || []).map((d) => d.operations)
  return computeSparkline(raw.length >= 2 ? raw : [45, 62, 58, 85, 76, 92, 88, 100])
})

const usersSparkline = computed(() => {
  const raw = (trends.value?.days || []).map((d) => d.newUsers + d.logins)
  return computeSparkline(raw.length >= 2 ? raw : [12, 18, 15, 24, 21, 28, 25, 30])
})

const assetsSparkline = computed(() => {
  const raw = (trends.value?.days || []).map((d, idx) => 80 + idx * 8 + d.newUsers)
  return computeSparkline(raw.length >= 2 ? raw : [60, 75, 82, 94, 105, 114, 122, 128])
})

const trendChartOption = computed(() => {
  const isDark = appConfig.darkMode
  const days = trends.value?.days ?? []
  const seriesColor = {
    operations: '#06b6d4', // Cyan / Teal
    logins: '#2563eb', // Royal Blue
    newUsers: '#f97316', // Orange / Amber
    failedOperations: '#a855f7', // Purple
  } as const

  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDark ? '#16171a' : '#0f172a',
      borderColor: isDark ? '#2e3038' : '#334155',
      borderWidth: 1,
      padding: [10, 14],
      textStyle: { color: '#f8fafc', fontSize: 12 },
      extraCssText: 'border-radius: 10px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);',
    },
    legend: {
      data: [
        t('dashboard.trendOperations'),
        t('dashboard.trendLogins'),
        t('dashboard.trendNewUsers'),
        t('dashboard.trendFailedOperations'),
      ],
      bottom: 0,
      icon: 'circle',
      itemGap: 20,
      textStyle: { color: isDark ? '#94a3b8' : '#64748b', fontSize: 12 },
    },
    grid: {
      left: 12,
      right: 20,
      top: 24,
      bottom: 40,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: days.map((day: DashboardDayTrend) => day.date.slice(5)),
      axisLine: { lineStyle: { color: isDark ? '#2e3038' : '#e2e8f0' } },
      axisTick: { show: false },
      axisLabel: { color: isDark ? '#64748b' : '#94a3b8', fontSize: 12 },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { type: 'dashed', color: isDark ? '#262830' : '#f1f5f9' } },
      axisLabel: { color: isDark ? '#64748b' : '#94a3b8', fontSize: 12 },
    },
    series: [
      {
        name: t('dashboard.trendOperations'),
        type: 'line',
        smooth: 0.4,
        showSymbol: false,
        symbolSize: 6,
        itemStyle: { color: seriesColor.operations },
        lineStyle: { width: 2.5 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(6, 182, 212, 0.22)' },
              { offset: 1, color: 'rgba(6, 182, 212, 0.00)' },
            ],
          },
        },
        data: days.map((day: DashboardDayTrend) => day.operations),
      },
      {
        name: t('dashboard.trendLogins'),
        type: 'line',
        smooth: 0.4,
        showSymbol: false,
        symbolSize: 6,
        itemStyle: { color: seriesColor.logins },
        lineStyle: { width: 2.5 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(37, 99, 235, 0.16)' },
              { offset: 1, color: 'rgba(37, 99, 235, 0.00)' },
            ],
          },
        },
        data: days.map((day: DashboardDayTrend) => day.logins),
      },
      {
        name: t('dashboard.trendNewUsers'),
        type: 'line',
        smooth: 0.4,
        showSymbol: false,
        symbolSize: 6,
        itemStyle: { color: seriesColor.newUsers },
        lineStyle: { width: 2.5 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(249, 115, 22, 0.16)' },
              { offset: 1, color: 'rgba(249, 115, 22, 0.00)' },
            ],
          },
        },
        data: days.map((day: DashboardDayTrend) => day.newUsers),
      },
      {
        name: t('dashboard.trendFailedOperations'),
        type: 'line',
        smooth: 0.4,
        showSymbol: false,
        symbolSize: 6,
        itemStyle: { color: seriesColor.failedOperations },
        lineStyle: { width: 2 },
        data: days.map((day: DashboardDayTrend) => day.failedOperations),
      },
    ],
  }
})

function handleAutoRefreshChange(val: string | number): void {
  const seconds = Number(val)
  autoRefreshInterval.value = seconds
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  if (seconds > 0) {
    timer = setInterval(() => {
      void loadOverview()
    }, seconds * 1000)
  }
}

function navigateTo(path: string): void {
  void router.push(path)
}

onMounted(() => {
  void loadOverview()
  void loadTrends(trendsDays.value)
})

onBeforeUnmount(() => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
})
</script>

<template>
  <div class="dashboard-page">
    <!-- 顶部操作栏与统计周期 -->
    <div class="dashboard-top-bar">
      <div class="top-bar-left">
        <div class="dashboard-eyebrow">OVERVIEW METRICS</div>
        <h1 class="dashboard-main-title">
          <span>{{ t('dashboard.title') }}</span>
          <Tag color="cyan" class="live-status-pill">
            <span class="live-status-dot" />
            LIVE
          </Tag>
        </h1>
        <p v-if="overview" class="period-caption">
          <ClockCircleOutlined class="period-icon text-cyan-600" />
          <span>{{ t('dashboard.periodLabel') }}:</span>
          <strong>{{ formatDateTime(overview.periodStart) }}</strong> ~
          <strong>{{ formatDateTime(overview.periodEnd) }}</strong>
          <span class="text-slate-400 font-mono">(UTC)</span>
        </p>
      </div>

      <div class="top-bar-right">
        <div class="auto-refresh-pill">
          <span class="refresh-pill-label">{{ t('dashboard.autoRefresh') }}</span>
          <Segmented
            :value="autoRefreshInterval"
            :options="[
              { label: t('dashboard.autoRefreshOff'), value: 0 },
              { label: t('dashboard.autoRefresh30s'), value: 30 },
              { label: t('dashboard.autoRefresh60s'), value: 60 },
            ]"
            size="small"
            @change="handleAutoRefreshChange"
          />
        </div>

        <Tooltip v-if="lastUpdatedTime" :title="`${t('dashboard.lastUpdated')} ${lastUpdatedTime}`">
          <div class="updated-time-badge">
            <ClockCircleOutlined />
            <span>{{ lastUpdatedTime }}</span>
          </div>
        </Tooltip>

        <Button
          type="primary"
          :loading="loading"
          :disabled="!canQuery"
          class="manual-refresh-btn"
          @click="loadOverview"
        >
          <ReloadOutlined />
          {{ t('dashboard.refresh') }}
        </Button>
      </div>
    </div>

    <!-- 1. KPI 迷你波形卡片矩阵（参考图中 mobbin.com / acme-corp.io / nova-app.dev 样式） -->
    <div class="kpi-cards-grid">
      <!-- KPI 1: SLA 可用率与健康度 -->
      <Card variant="borderless" class="trend-kpi-card group">
        <div class="kpi-card-header">
          <div class="kpi-host-tag">
            <GlobalOutlined class="text-teal-600" />
            <span class="font-medium text-slate-700">api-gateway.prod</span>
          </div>
          <Button type="text" size="small" class="kpi-more-btn">
            <MoreOutlined />
          </Button>
        </div>

        <div class="kpi-metric-row">
          <div class="kpi-metric-val-wrap">
            <Statistic
              :title="t('dashboard.successRate')"
              :value="successRate"
              :suffix="successRate === '-' ? '' : '%'"
              class="hidden-title-stat"
            />
            <div class="kpi-delta-tag tag-success">
              <ArrowUpOutlined class="text-xs" />
              <span>15.2%</span>
            </div>
          </div>
          <div class="kpi-metric-label">{{ t('dashboard.healthTraffic') }}</div>
        </div>

        <!-- SVG 面积曲线与高光端点 -->
        <div class="kpi-sparkline-wrap">
          <svg viewBox="0 0 160 52" class="sparkline-svg" preserveAspectRatio="none">
            <defs>
              <linearGradient id="slaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#0d9488" stop-opacity="0.25" />
                <stop offset="100%" stop-color="#0d9488" stop-opacity="0.0" />
              </linearGradient>
            </defs>
            <path :d="slaSparkline.areaPath" fill="url(#slaGrad)" />
            <path
              :d="slaSparkline.linePath"
              fill="none"
              stroke="#0d9488"
              stroke-width="2.2"
              stroke-linecap="round"
            />
            <circle
              :cx="slaSparkline.lastPoint.x"
              :cy="slaSparkline.lastPoint.y"
              r="6"
              fill="#0d9488"
              fill-opacity="0.2"
              class="sparkline-pulse-node"
            />
            <circle
              :cx="slaSparkline.lastPoint.x"
              :cy="slaSparkline.lastPoint.y"
              r="3.2"
              fill="#0d9488"
              stroke="#ffffff"
              stroke-width="1.6"
            />
          </svg>
        </div>

        <div class="kpi-card-footer" @click="navigateTo('/system/log')">
          <span>{{ t('dashboard.viewReport') }}</span>
          <ArrowRightOutlined class="footer-arrow" />
        </div>
      </Card>

      <!-- KPI 2: 今日总调用吞吐 -->
      <Card variant="borderless" class="trend-kpi-card group">
        <div class="kpi-card-header">
          <div class="kpi-host-tag">
            <ThunderboltOutlined class="text-blue-600" />
            <span class="font-medium text-slate-700">operations.cluster</span>
          </div>
          <Button type="text" size="small" class="kpi-more-btn">
            <MoreOutlined />
          </Button>
        </div>

        <div class="kpi-metric-row">
          <div class="kpi-metric-val-wrap">
            <Statistic
              :title="t('dashboard.todayOperationCount')"
              :value="overview?.todayOperationCount ?? '-'"
              class="hidden-title-stat"
            />
            <div class="kpi-delta-tag tag-success">
              <ArrowUpOutlined class="text-xs" />
              <span>3.1%</span>
            </div>
          </div>
          <div class="kpi-metric-label">{{ t('dashboard.todayOperationCount') }}</div>
        </div>

        <div class="kpi-sparkline-wrap">
          <svg viewBox="0 0 160 52" class="sparkline-svg" preserveAspectRatio="none">
            <defs>
              <linearGradient id="opsGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#2563eb" stop-opacity="0.22" />
                <stop offset="100%" stop-color="#2563eb" stop-opacity="0.0" />
              </linearGradient>
            </defs>
            <path :d="operationsSparkline.areaPath" fill="url(#opsGrad)" />
            <path
              :d="operationsSparkline.linePath"
              fill="none"
              stroke="#2563eb"
              stroke-width="2.2"
              stroke-linecap="round"
            />
            <circle
              :cx="operationsSparkline.lastPoint.x"
              :cy="operationsSparkline.lastPoint.y"
              r="6"
              fill="#2563eb"
              fill-opacity="0.2"
              class="sparkline-pulse-node"
            />
            <circle
              :cx="operationsSparkline.lastPoint.x"
              :cy="operationsSparkline.lastPoint.y"
              r="3.2"
              fill="#2563eb"
              stroke="#ffffff"
              stroke-width="1.6"
            />
          </svg>
        </div>

        <div class="kpi-card-footer" @click="navigateTo('/system/log')">
          <span>{{ t('dashboard.viewReport') }}</span>
          <ArrowRightOutlined class="footer-arrow" />
        </div>
      </Card>

      <!-- KPI 3: 用户与活跃比率 -->
      <Card variant="borderless" class="trend-kpi-card group">
        <div class="kpi-card-header">
          <div class="kpi-host-tag">
            <UserOutlined class="text-indigo-600" />
            <span class="font-medium text-slate-700">users-auth.portal</span>
          </div>
          <Button type="text" size="small" class="kpi-more-btn">
            <MoreOutlined />
          </Button>
        </div>

        <div class="kpi-metric-row">
          <div class="kpi-metric-val-wrap">
            <Statistic
              :title="t('dashboard.userCount')"
              :value="overview?.userCount ?? '-'"
              class="hidden-title-stat"
            />
            <div class="kpi-delta-tag tag-warning">
              <ArrowDownOutlined class="text-xs" />
              <span>18.4%</span>
            </div>
          </div>
          <div class="kpi-metric-label">
            {{ t('dashboard.enabledUserCount') }}:
            <strong class="text-slate-800">{{ overview?.enabledUserCount ?? '-' }}</strong>
            ({{ userActiveRate }}%)
          </div>
        </div>

        <div class="kpi-sparkline-wrap">
          <svg viewBox="0 0 160 52" class="sparkline-svg" preserveAspectRatio="none">
            <defs>
              <linearGradient id="userGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#6366f1" stop-opacity="0.22" />
                <stop offset="100%" stop-color="#6366f1" stop-opacity="0.0" />
              </linearGradient>
            </defs>
            <path :d="usersSparkline.areaPath" fill="url(#userGrad)" />
            <path
              :d="usersSparkline.linePath"
              fill="none"
              stroke="#6366f1"
              stroke-width="2.2"
              stroke-linecap="round"
            />
            <circle
              :cx="usersSparkline.lastPoint.x"
              :cy="usersSparkline.lastPoint.y"
              r="6"
              fill="#6366f1"
              fill-opacity="0.2"
              class="sparkline-pulse-node"
            />
            <circle
              :cx="usersSparkline.lastPoint.x"
              :cy="usersSparkline.lastPoint.y"
              r="3.2"
              fill="#6366f1"
              stroke="#ffffff"
              stroke-width="1.6"
            />
          </svg>
        </div>

        <div class="kpi-card-footer" @click="navigateTo('/system/user')">
          <span>{{ t('dashboard.viewReport') }}</span>
          <ArrowRightOutlined class="footer-arrow" />
        </div>
      </Card>

      <!-- KPI 4: 文件与架构资产 -->
      <Card variant="borderless" class="trend-kpi-card group">
        <div class="kpi-card-header">
          <div class="kpi-host-tag">
            <FolderOpenOutlined class="text-amber-600" />
            <span class="font-medium text-slate-700">assets-cloud.oss</span>
          </div>
          <Button type="text" size="small" class="kpi-more-btn">
            <MoreOutlined />
          </Button>
        </div>

        <div class="kpi-metric-row">
          <div class="kpi-metric-val-wrap">
            <Statistic
              :title="t('dashboard.fileCount')"
              :value="overview?.fileCount ?? '-'"
              class="hidden-title-stat"
            />
            <div class="kpi-delta-tag tag-neutral">
              <span>+{{ overview?.deptCount ?? '-' }} depts</span>
            </div>
          </div>
          <div class="kpi-metric-label">
            {{ t('dashboard.deptCount') }}:
            <strong class="text-slate-800">{{ overview?.deptCount ?? '-' }}</strong> ·
            {{ t('dashboard.roleCount') }}:
            <strong class="text-slate-800">{{ overview?.roleCount ?? '-' }}</strong>
          </div>
        </div>

        <div class="kpi-sparkline-wrap">
          <svg viewBox="0 0 160 52" class="sparkline-svg" preserveAspectRatio="none">
            <defs>
              <linearGradient id="assetGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#f97316" stop-opacity="0.22" />
                <stop offset="100%" stop-color="#f97316" stop-opacity="0.0" />
              </linearGradient>
            </defs>
            <path :d="assetsSparkline.areaPath" fill="url(#assetGrad)" />
            <path
              :d="assetsSparkline.linePath"
              fill="none"
              stroke="#f97316"
              stroke-width="2.2"
              stroke-linecap="round"
            />
            <circle
              :cx="assetsSparkline.lastPoint.x"
              :cy="assetsSparkline.lastPoint.y"
              r="6"
              fill="#f97316"
              fill-opacity="0.2"
              class="sparkline-pulse-node"
            />
            <circle
              :cx="assetsSparkline.lastPoint.x"
              :cy="assetsSparkline.lastPoint.y"
              r="3.2"
              fill="#f97316"
              stroke="#ffffff"
              stroke-width="1.6"
            />
          </svg>
        </div>

        <div class="kpi-card-footer" @click="navigateTo('/system/file')">
          <span>{{ t('dashboard.viewReport') }}</span>
          <ArrowRightOutlined class="footer-arrow" />
        </div>
      </Card>
    </div>

    <!-- 2. 双面板深度透视（参考图中 AI Search Visibility 与 SEO Overview 样式） -->
    <Row :gutter="[20, 20]" class="mid-panels-row">
      <!-- 左侧卡片: AI Search Visibility / 服务观测与健康度 -->
      <Col :xs="24" :lg="14">
        <Card variant="borderless" class="modern-panel-card">
          <div class="panel-header-row">
            <div class="panel-header-title">
              <span class="header-star-icon">✦</span>
              <span>{{ t('dashboard.aiVisibility') }}</span>
            </div>
            <div class="panel-header-meta">
              <span class="meta-time-text">{{
                t('dashboard.updatedHoursAgo', { hours: 10 })
              }}</span>
              <Button type="text" size="small" class="kpi-more-btn">
                <MoreOutlined />
              </Button>
            </div>
          </div>

          <div class="visibility-content-grid">
            <!-- 环形得分仪表盘 (Score 96/100) -->
            <div class="score-gauge-wrap">
              <div class="donut-container">
                <svg viewBox="0 0 136 136" class="donut-svg">
                  <!-- 背景环 -->
                  <circle
                    cx="68"
                    cy="68"
                    r="54"
                    fill="none"
                    stroke="#f1f5f9"
                    stroke-width="12"
                    class="donut-bg-circle"
                  />
                  <!-- 渐变激活进度环 -->
                  <defs>
                    <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stop-color="#06b6d4" />
                      <stop offset="100%" stop-color="#0d9488" />
                    </linearGradient>
                  </defs>
                  <circle
                    cx="68"
                    cy="68"
                    r="54"
                    fill="none"
                    stroke="url(#gaugeGradient)"
                    stroke-width="12"
                    stroke-linecap="round"
                    class="donut-progress-arc"
                    stroke-dasharray="339.3"
                    :stroke-dashoffset="gaugeDashOffset"
                  />
                </svg>
                <div class="donut-inner-content">
                  <div class="donut-label">{{ t('dashboard.score') }}</div>
                  <div class="donut-score">{{ healthScore }}/100</div>
                  <div class="donut-status-badge">
                    {{
                      healthScore >= 90
                        ? t('dashboard.scoreOptimal')
                        : healthScore >= 70
                          ? t('dashboard.scoreGood')
                          : t('dashboard.scoreWarning')
                    }}
                  </div>
                </div>
              </div>
            </div>

            <!-- 右侧指标分解与渠道进度 -->
            <div class="visibility-details-wrap">
              <div class="top-stat-metrics">
                <div class="metric-block">
                  <span class="block-icon-label">@ {{ t('dashboard.mentions') }}</span>
                  <span class="block-val">1.1K</span>
                </div>
                <div class="metric-block">
                  <span class="block-icon-label">
                    <LinkOutlined class="text-xs" /> {{ t('dashboard.citedPages') }}
                  </span>
                  <span class="block-val">665</span>
                </div>
              </div>

              <div class="channel-progress-list">
                <!-- 渠道 1: 核心业务网关 -->
                <div class="channel-item">
                  <div class="channel-info-row">
                    <span class="channel-name">{{ t('dashboard.coreGateway') }}</span>
                    <div class="channel-stats">
                      <span>@ 167</span>
                      <span class="stats-sep">·</span>
                      <span><LinkOutlined /> 79</span>
                    </div>
                  </div>
                  <div class="channel-bar-wrap">
                    <Progress
                      :percent="85"
                      :show-info="false"
                      stroke-color="#06b6d4"
                      rail-color="#f1f5f9"
                      size="small"
                    />
                  </div>
                </div>

                <!-- 渠道 2: 异步调度与队列 -->
                <div class="channel-item">
                  <div class="channel-info-row">
                    <span class="channel-name">{{ t('dashboard.asyncTask') }}</span>
                    <div class="channel-stats">
                      <span>@ 574</span>
                      <span class="stats-sep">·</span>
                      <span><LinkOutlined /> 510</span>
                    </div>
                  </div>
                  <div class="channel-bar-wrap">
                    <Progress
                      :percent="72"
                      :show-info="false"
                      stroke-color="#0d9488"
                      rail-color="#f1f5f9"
                      size="small"
                    />
                  </div>
                </div>

                <!-- 渠道 3: 认证与安全中心 -->
                <div class="channel-item">
                  <div class="channel-info-row">
                    <span class="channel-name">{{ t('dashboard.authSecurity') }}</span>
                    <div class="channel-stats">
                      <span>@ 175</span>
                      <span class="stats-sep">·</span>
                      <span><LinkOutlined /> 94</span>
                    </div>
                  </div>
                  <div class="channel-bar-wrap">
                    <Progress
                      :percent="94"
                      :show-info="false"
                      stroke-color="#14b8a6"
                      rail-color="#f1f5f9"
                      size="small"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </Col>

      <!-- 右侧卡片: SEO Overview / 系统合规与态势 -->
      <Col :xs="24" :lg="10">
        <Card variant="borderless" class="modern-panel-card">
          <div class="panel-header-row">
            <div class="panel-header-title">
              <SafetyCertificateOutlined class="text-teal-600 text-base" />
              <span>{{ t('dashboard.seoOverview') }}</span>
            </div>
            <Button type="text" size="small" class="kpi-more-btn">
              <MoreOutlined />
            </Button>
          </div>

          <div class="seo-overview-body">
            <!-- 指标行 1: 业务基线吞吐 -->
            <div class="seo-metric-card">
              <div class="seo-metric-left">
                <span class="seo-label">{{ t('dashboard.organicTraffic') }}</span>
                <div class="seo-val-box">
                  <span class="seo-huge-val">{{ todaySuccessCount }}</span>
                  <div class="kpi-delta-tag tag-success">
                    <ArrowUpOutlined class="text-xs" />
                    <span>8.2%</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 指标行 2: 健康流量评级 -->
            <div class="seo-metric-card">
              <div class="seo-metric-left">
                <span class="seo-label">{{ t('dashboard.healthTraffic') }}</span>
                <div class="seo-val-box">
                  <span class="seo-huge-val">44</span>
                  <Tag color="cyan" class="badge-pill">{{ t('dashboard.veryGood') }}</Tag>
                </div>
              </div>
            </div>

            <!-- 指标行 3: 安全防御拦截与失败 -->
            <div class="seo-metric-card">
              <div class="seo-metric-left">
                <span class="seo-label">{{ t('dashboard.paidKeywords') }}</span>
                <div class="seo-val-box">
                  <span class="seo-huge-val">{{ overview?.todayFailedOperationCount ?? 0 }}</span>
                  <Tag
                    :color="(overview?.todayFailedOperationCount ?? 0) === 0 ? 'green' : 'error'"
                    class="badge-pill"
                  >
                    {{
                      (overview?.todayFailedOperationCount ?? 0) === 0
                        ? 'Zero Threat'
                        : t('dashboard.slaWarning')
                    }}
                  </Tag>
                </div>
              </div>
            </div>

            <!-- 底部导航跳转 -->
            <div class="seo-actions-row">
              <Button block class="quick-jump-action-btn" @click="navigateTo('/system/log')">
                <SafetyOutlined />
                <span>{{ t('dashboard.viewLogs') }}</span>
                <RightOutlined class="text-xs" />
              </Button>
            </div>
          </div>
        </Card>
      </Col>
    </Row>

    <!-- 3. Traffic Analytics 流量透视与多曲线平滑图表（参考图底部大卡片） -->
    <Card variant="borderless" class="modern-panel-card traffic-analytics-card">
      <div class="panel-header-row">
        <div class="panel-header-title">
          <LineChartOutlined class="text-teal-600 text-base" />
          <span>{{ t('dashboard.trafficAnalytics') }}</span>
        </div>

        <div class="panel-header-actions">
          <Segmented
            :value="trendsDays"
            :options="[
              { label: t('dashboard.trendDays7'), value: 7 },
              { label: t('dashboard.trendDays30'), value: 30 },
              { label: t('dashboard.trendDays90'), value: 90 },
            ]"
            size="small"
            @change="handleTrendsDaysChange"
          />
        </div>
      </div>

      <!-- 顶部 4 汇总指标条（Visits, Unique Visitors, Pages/Visit, Avg Duration） -->
      <div class="traffic-summary-strip">
        <div class="traffic-strip-item">
          <span class="strip-label">{{ t('dashboard.visits') }}</span>
          <div class="strip-val-wrap">
            <span class="strip-val">{{ overview?.todayOperationCount ?? '2.6M' }}</span>
            <span class="strip-delta delta-down">
              <ArrowDownOutlined class="text-xs" /> 15.1%
            </span>
          </div>
        </div>

        <div class="traffic-strip-divider" />

        <div class="traffic-strip-item">
          <span class="strip-label">{{ t('dashboard.uniqueVisitors') }}</span>
          <div class="strip-val-wrap">
            <span class="strip-val">{{ overview?.enabledUserCount ?? '922K' }}</span>
            <span class="strip-delta delta-down">
              <ArrowDownOutlined class="text-xs" /> 17.9%
            </span>
          </div>
        </div>

        <div class="traffic-strip-divider" />

        <div class="traffic-strip-item">
          <span class="strip-label">{{ t('dashboard.pagesPerVisit') }}</span>
          <div class="strip-val-wrap">
            <span class="strip-val">5.99</span>
            <span class="strip-delta delta-up"> <ArrowUpOutlined class="text-xs" /> 7.7% </span>
          </div>
        </div>

        <div class="traffic-strip-divider" />

        <div class="traffic-strip-item">
          <span class="strip-label">{{ t('dashboard.avgDuration') }}</span>
          <div class="strip-val-wrap">
            <span class="strip-val font-mono">11:15</span>
          </div>
        </div>
      </div>

      <!-- ECharts 多曲线图表 -->
      <div class="traffic-chart-container">
        <VChart
          v-if="trends"
          :option="trendChartOption"
          :loading="trendsLoading"
          autoresize
          class="traffic-echart"
        />
        <div v-else class="traffic-chart-empty">
          <span>{{ t('dashboard.trendEmpty') }}</span>
        </div>
      </div>
    </Card>

    <!-- 4. 核心资源快捷导航网格 -->
    <div class="resource-overview-section">
      <div class="resource-section-header">
        <div class="section-badge-bar" />
        <h3 class="section-title-text">{{ t('dashboard.resourceOverview') }}</h3>
      </div>

      <Row :gutter="[16, 16]">
        <Col :xs="24" :sm="12" :lg="6">
          <div class="quick-entry-card" @click="navigateTo('/system/user')">
            <div class="entry-icon-box bg-blue-50 text-blue-600">
              <UserOutlined />
            </div>
            <div class="entry-text-box">
              <div class="entry-title">{{ t('dashboard.userManage') }}</div>
              <div class="entry-sub">{{ t('dashboard.userManageDesc') }}</div>
            </div>
            <ArrowRightOutlined class="entry-arrow-icon" />
          </div>
        </Col>

        <Col :xs="24" :sm="12" :lg="6">
          <div class="quick-entry-card" @click="navigateTo('/system/role')">
            <div class="entry-icon-box bg-emerald-50 text-emerald-600">
              <TeamOutlined />
            </div>
            <div class="entry-text-box">
              <div class="entry-title">{{ t('dashboard.roleManage') }}</div>
              <div class="entry-sub">{{ t('dashboard.roleManageDesc') }}</div>
            </div>
            <ArrowRightOutlined class="entry-arrow-icon" />
          </div>
        </Col>

        <Col :xs="24" :sm="12" :lg="6">
          <div class="quick-entry-card" @click="navigateTo('/system/dept')">
            <div class="entry-icon-box bg-purple-50 text-purple-600">
              <TeamOutlined />
            </div>
            <div class="entry-text-box">
              <div class="entry-title">{{ t('dashboard.deptManage') }}</div>
              <div class="entry-sub">{{ t('dashboard.deptManageDesc') }}</div>
            </div>
            <ArrowRightOutlined class="entry-arrow-icon" />
          </div>
        </Col>

        <Col :xs="24" :sm="12" :lg="6">
          <div class="quick-entry-card" @click="navigateTo('/system/file')">
            <div class="entry-icon-box bg-amber-50 text-amber-600">
              <FolderOpenOutlined />
            </div>
            <div class="entry-text-box">
              <div class="entry-title">{{ t('dashboard.fileManage') }}</div>
              <div class="entry-sub">{{ t('dashboard.fileManageDesc') }}</div>
            </div>
            <ArrowRightOutlined class="entry-arrow-icon" />
          </div>
        </Col>
      </Row>
    </div>
  </div>
</template>

<style scoped lang="scss">
.dashboard-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 100%;
  padding-bottom: 32px;
}

/* 顶部操作与标题栏 */
.dashboard-top-bar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
}

.top-bar-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dashboard-eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #64748b;
  text-transform: uppercase;
}

.dashboard-main-title {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #0f172a;
}

.live-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border-radius: 9999px;
  padding: 1px 9px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  border: 1px solid #cffafe;
}

.live-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #06b6d4;
  animation: pulse-dot 1.8s infinite;
}

@keyframes pulse-dot {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.4;
    transform: scale(0.85);
  }
}

.period-caption {
  margin: 2px 0 0;
  font-size: 13px;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 6px;
}

.top-bar-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.auto-refresh-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}

.refresh-pill-label {
  font-size: 12px;
  color: #64748b;
}

.updated-time-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  background-color: #f1f5f9;
  border-radius: 8px;
  font-size: 12px;
  color: #475569;
  font-variant-numeric: tabular-nums;
}

.manual-refresh-btn {
  border-radius: 8px;
  font-weight: 600;
}

/* 1. KPI 迷你波形卡片矩阵 */
.kpi-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
}

.trend-kpi-card {
  background-color: #ffffff;
  border: 1px solid #eef2f6;
  border-radius: 14px;
  box-shadow:
    0 1px 3px rgba(15, 23, 42, 0.03),
    0 4px 12px rgba(15, 23, 42, 0.02);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;

  :deep(.ant-card-body) {
    padding: 16px 18px 0;
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 24px -4px rgba(15, 23, 42, 0.08);
    border-color: #cbd5e1;

    .footer-arrow {
      transform: translateX(4px);
      color: #0d9488;
    }
  }
}

.kpi-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.kpi-host-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.kpi-more-btn {
  color: #94a3b8;
  padding: 0 4px;
  height: 24px;

  &:hover {
    color: #334155;
    background-color: #f1f5f9;
  }
}

.kpi-metric-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.kpi-metric-val-wrap {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.hidden-title-stat {
  :deep(.ant-statistic-title) {
    display: none;
  }
  :deep(.ant-statistic-content-value) {
    font-size: 32px;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: -0.03em;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
  }
  :deep(.ant-statistic-content-suffix) {
    font-size: 16px;
    font-weight: 700;
    color: #64748b;
    margin-left: 2px;
  }
}

.kpi-delta-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 9999px;

  &.tag-success {
    color: #059669;
    background-color: #ecfdf5;
  }
  &.tag-warning {
    color: #e11d48;
    background-color: #fff1f2;
  }
  &.tag-neutral {
    color: #475569;
    background-color: #f1f5f9;
  }
}

.kpi-metric-label {
  font-size: 12px;
  color: #64748b;
  margin-top: 2px;
}

.kpi-sparkline-wrap {
  height: 52px;
  margin-top: 10px;
  margin-left: -18px;
  margin-right: -18px;
}

.sparkline-svg {
  width: 100%;
  height: 100%;
  display: block;
}

.sparkline-pulse-node {
  animation: pulse-node 2s infinite ease-in-out;
  transform-origin: center;
}

@keyframes pulse-node {
  0%,
  100% {
    r: 6;
    opacity: 0.2;
  }
  50% {
    r: 9;
    opacity: 0.5;
  }
}

.kpi-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 11px 0;
  margin-top: 4px;
  border-top: 1px solid #f1f5f9;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  transition: color 0.2s;

  &:hover {
    color: #0d9488;
  }
}

.footer-arrow {
  font-size: 11px;
  transition:
    transform 0.2s ease,
    color 0.2s ease;
}

/* 2. 双面板深度透视 */
.modern-panel-card {
  background-color: #ffffff;
  border: 1px solid #eef2f6;
  border-radius: 14px;
  box-shadow:
    0 1px 3px rgba(15, 23, 42, 0.03),
    0 4px 12px rgba(15, 23, 42, 0.02);
  height: 100%;

  :deep(.ant-card-body) {
    padding: 20px;
  }
}

.panel-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.panel-header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
}

.header-star-icon {
  color: #06b6d4;
  font-size: 16px;
}

.panel-header-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.meta-time-text {
  font-size: 12px;
  color: #94a3b8;
}

.visibility-content-grid {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 24px;
  align-items: center;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
    justify-items: center;
  }
}

.score-gauge-wrap {
  display: flex;
  justify-content: center;
  align-items: center;
}

.donut-container {
  position: relative;
  width: 136px;
  height: 136px;
}

.donut-svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.donut-progress-arc {
  transition: stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}

.donut-inner-content {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.donut-label {
  font-size: 11px;
  color: #94a3b8;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.donut-score {
  font-size: 18px;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.02em;
  margin: 1px 0;
}

.donut-status-badge {
  font-size: 10px;
  font-weight: 700;
  color: #d97706;
  background-color: #fef3c7;
  padding: 1px 7px;
  border-radius: 9999px;
}

.visibility-details-wrap {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.top-stat-metrics {
  display: flex;
  gap: 28px;
  border-bottom: 1px solid #f1f5f9;
  padding-bottom: 12px;
}

.metric-block {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.block-icon-label {
  font-size: 12px;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 4px;
}

.block-val {
  font-size: 22px;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.channel-progress-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.channel-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.channel-info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.channel-name {
  font-weight: 600;
  color: #334155;
}

.channel-stats {
  font-size: 11px;
  color: #64748b;
  font-variant-numeric: tabular-nums;
  display: flex;
  align-items: center;
  gap: 4px;
}

.stats-sep {
  color: #cbd5e1;
}

.seo-overview-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.seo-metric-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  background-color: #f8fafc;
  border: 1px solid #edf2f7;
  border-radius: 10px;
}

.seo-label {
  font-size: 12px;
  color: #64748b;
}

.seo-val-box {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 2px;
}

.seo-huge-val {
  font-size: 20px;
  font-weight: 800;
  color: #0f172a;
  font-variant-numeric: tabular-nums;
}

.badge-pill {
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 600;
  padding: 0 8px;
}

.seo-actions-row {
  margin-top: 4px;
}

.quick-jump-action-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 40px;
  border-radius: 8px;
  border-color: #e2e8f0;
  color: #475569;
  font-weight: 600;

  &:hover {
    color: #0d9488;
    border-color: #99f6e4;
    background-color: #f0fdfa;
  }
}

/* 3. Traffic Analytics 卡片 */
.traffic-analytics-card {
  :deep(.ant-card-body) {
    padding: 22px 24px;
  }
}

.traffic-summary-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  padding: 14px 18px;
  background-color: #f8fafc;
  border: 1px solid #edf2f7;
  border-radius: 10px;
  margin-bottom: 20px;
}

.traffic-strip-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.strip-label {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.strip-val-wrap {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.strip-val {
  font-size: 22px;
  font-weight: 800;
  color: #0f172a;
  font-variant-numeric: tabular-nums;
}

.strip-delta {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 11px;
  font-weight: 700;

  &.delta-up {
    color: #059669;
  }
  &.delta-down {
    color: #e11d48;
  }
}

.traffic-strip-divider {
  width: 1px;
  height: 28px;
  background-color: #e2e8f0;
}

.traffic-chart-container {
  height: 340px;
  width: 100%;
}

.traffic-echart {
  width: 100%;
  height: 100%;
}

.traffic-chart-empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  font-size: 13px;
}

/* 4. 资源全景导航 */
.resource-overview-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.resource-section-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-badge-bar {
  width: 4px;
  height: 16px;
  border-radius: 2px;
  background-color: #0d9488;
}

.section-title-text {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
}

.quick-entry-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background-color: #ffffff;
  border: 1px solid #eef2f6;
  border-radius: 12px;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
  transition: all 0.25s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 16px -2px rgba(15, 23, 42, 0.06);
    border-color: #cbd5e1;

    .entry-arrow-icon {
      color: #0d9488;
      transform: translateX(4px);
    }
  }
}

.entry-icon-box {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.entry-text-box {
  flex: 1;
  min-width: 0;
}

.entry-title {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
}

.entry-sub {
  font-size: 12px;
  color: #64748b;
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.entry-arrow-icon {
  color: #94a3b8;
  font-size: 13px;
  transition: all 0.2s ease;
}

html.dark {
  .dashboard-main-title {
    color: #ffffff;
  }

  .dashboard-eyebrow,
  .period-caption {
    color: #94a3b8;
  }

  .auto-refresh-pill {
    background-color: #22242a;
    border-color: #2e3038;
  }

  .refresh-pill-label {
    color: #94a3b8;
  }

  .updated-time-badge {
    background-color: #22242a;
    color: #94a3b8;
  }

  .trend-kpi-card {
    background-color: #222429 !important;
    border-color: #2e3038 !important;
    box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.35);

    &:hover {
      border-color: #3b3e48 !important;
      box-shadow: 0 12px 24px -4px rgba(0, 0, 0, 0.5);
    }

    :deep(.ant-statistic-content-value) {
      color: #ffffff !important;
    }
  }

  .kpi-host-tag span {
    color: #cbd5e1;
  }

  .kpi-metric-label {
    color: #8b909a;
  }

  .kpi-card-footer {
    border-top: 1px solid #2a2c33;
    color: #8b909a;

    &:hover {
      color: #00f2c3;
    }
  }

  .tag-neutral {
    background-color: #1c1d22;
    color: #94a3b8;
  }

  .modern-panel-card {
    background-color: #222429 !important;
    border-color: #2e3038 !important;
    box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.35);
  }

  .panel-header-title {
    color: #ffffff;
  }

  .meta-time-text {
    color: #64748b;
  }

  .donut-bg-circle {
    stroke: #2e3038;
  }

  .donut-score {
    color: #ffffff;
  }

  .donut-status-badge {
    background-color: #452c16;
    color: #f59e0b;
  }

  .top-stat-metrics {
    border-bottom: 1px solid #2a2c33;
  }

  .block-val {
    color: #ffffff;
  }

  .block-icon-label {
    color: #8b909a;
  }

  .channel-name {
    color: #cbd5e1;
  }

  .channel-stats {
    color: #8b909a;
  }

  :deep(.ant-progress-inner) {
    background-color: #2e3038 !important;
  }

  .seo-metric-card {
    background-color: #1c1d22 !important;
    border-color: #2a2c33 !important;
  }

  .seo-huge-val {
    color: #ffffff;
  }

  .seo-label {
    color: #8b909a;
  }

  .quick-jump-action-btn {
    border-color: #2e3038;
    color: #cbd5e1;

    &:hover {
      background-color: #22242a;
      border-color: #06b6d4;
      color: #06b6d4;
    }
  }

  .traffic-analytics-card {
    background-color: #222429 !important;
    border-color: #2e3038 !important;
    box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.35);
  }

  .traffic-summary-strip {
    background-color: #1c1d22 !important;
    border-color: #2a2c33 !important;
  }

  .strip-val {
    color: #ffffff;
  }

  .strip-label {
    color: #8b909a;
  }

  .traffic-strip-divider {
    background-color: #2a2c33;
  }

  .section-title-text {
    color: #ffffff;
  }

  .quick-entry-card {
    background-color: #222429 !important;
    border-color: #2e3038 !important;
    box-shadow: 0 4px 10px -2px rgba(0, 0, 0, 0.35);

    &:hover {
      border-color: #3b3e48 !important;
      box-shadow: 0 8px 20px -2px rgba(0, 0, 0, 0.5);
    }
  }

  .entry-title {
    color: #ffffff;
  }

  .entry-sub {
    color: #8b909a;
  }

  .entry-icon-box {
    background-color: #2a2c33 !important;
  }
}
</style>
