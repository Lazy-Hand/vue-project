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
  ArrowRightOutlined,
  AuditOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  DashboardOutlined,
  ExclamationCircleFilled,
  FolderOpenOutlined,
  ReloadOutlined,
  RightOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserOutlined,
} from '@antdv-next/icons'

import { fetchTodoList } from '@/api/approval'
import { fetchDashboardOverview } from '@/api/dashboard'
import { useNoticeSse } from '@/composables/useNoticeSse'
import { usePermission } from '@/composables/usePermission'
import type { DashboardOverview } from '@/types/dashboard'
import { ApiRequestError } from '@/utils/request'

const { locale, t } = useI18n()
const router = useRouter()
const { hasPermission } = usePermission()

const canQuery = computed(() => hasPermission('system:dashboard:query'))

const overview = ref<DashboardOverview | null>(null)
const loading = ref(false)
const lastUpdatedTime = ref<string>('')
const autoRefreshInterval = ref<number>(0) // 0 = off, 30 = 30s, 60 = 60s
let timer: ReturnType<typeof setInterval> | null = null

const todoCount = ref(0)

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
    const [ov, todo] = await Promise.all([
      fetchDashboardOverview(),
      fetchTodoList({ page: 1, pageSize: 1 }).catch(() => ({ total: 0, items: [] as never[] })),
    ])
    overview.value = ov
    todoCount.value = (todo as { total: number }).total ?? 0
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
      void loadOverview()
    }, seconds * 1000)
  }
}

function navigateTo(path: string): void {
  void router.push(path)
}

async function refreshTodoCount(): Promise<void> {
  try {
    const res = await fetchTodoList({ page: 1, pageSize: 1 })
    todoCount.value = res.total
  } catch {
    // 忽略
  }
}

useNoticeSse({
  onApprovalTodo: () => void refreshTodoCount(),
  onApprovalTodoRefresh: () => void refreshTodoCount(),
})

onMounted(() => {
  void loadOverview()
})

onBeforeUnmount(() => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
})
</script>

<template>
  <div class="dashboard-container">
    <!-- 顶部标题与控制栏 -->
    <div class="dashboard-header">
      <div class="header-left">
        <div class="header-badge">
          <DashboardOutlined class="header-badge-icon" />
          <span>{{ t('dashboard.title') }}</span>
        </div>
        <p class="header-sub">
          {{ t('dashboard.subtitle') }}
        </p>
      </div>

      <div class="header-actions">
        <div class="refresh-controls">
          <span class="refresh-label">{{ t('dashboard.autoRefresh') }}:</span>
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
          @click="loadOverview"
        >
          <ReloadOutlined />
          {{ t('dashboard.refresh') }}
        </Button>
      </div>
    </div>

    <!-- 周期时间提示栏 -->
    <div v-if="overview" class="period-banner">
      <div class="period-info">
        <ClockCircleOutlined class="period-icon" />
        <span class="period-text">
          {{ t('dashboard.periodLabel') }}:
          <strong>{{ formatDateTime(overview.periodStart) }}</strong> ~
          <strong>{{ formatDateTime(overview.periodEnd) }}</strong> (UTC)
        </span>
      </div>
      <Tag color="cyan" class="live-tag">
        <span class="live-dot" />
        LIVE OVERVIEW
      </Tag>
    </div>

    <!-- 核心业务 KPI 4 栏矩阵 -->
    <div class="kpi-grid">
      <!-- 1. 用户总数 -->
      <Card variant="borderless" class="kpi-card hover-lift">
        <div class="kpi-card-inner">
          <div class="kpi-icon-box bg-gradient-to-br from-blue-500 to-indigo-600">
            <UserOutlined />
          </div>
          <div class="kpi-body">
            <Statistic
              :title="t('dashboard.userCount')"
              :value="overview?.userCount ?? '-'"
              class="kpi-stat"
            />
            <div class="kpi-progress-box">
              <div class="kpi-progress-labels">
                <span class="kpi-sub-label">
                  {{ t('dashboard.enabledUserCount') }}:
                  <strong class="text-blue-600">{{ overview?.enabledUserCount ?? '-' }}</strong>
                </span>
                <span class="kpi-sub-rate">{{ userActiveRate }}%</span>
              </div>
              <Progress
                :percent="userActiveRate"
                :show-info="false"
                stroke-color="#3b82f6"
                size="small"
              />
            </div>
          </div>
        </div>
      </Card>

      <!-- 2. 角色与权限 -->
      <Card variant="borderless" class="kpi-card hover-lift">
        <div class="kpi-card-inner">
          <div class="kpi-icon-box bg-gradient-to-br from-emerald-500 to-teal-600">
            <TeamOutlined />
          </div>
          <div class="kpi-body">
            <Statistic
              :title="t('dashboard.roleCount')"
              :value="overview?.roleCount ?? '-'"
              class="kpi-stat"
            />
            <div class="kpi-meta-row">
              <span class="kpi-sub-label">
                {{ t('dashboard.deptCount') }}:
                <strong class="text-emerald-600">{{ overview?.deptCount ?? '-' }}</strong>
              </span>
              <Tag color="green" class="kpi-tag">RBAC Ready</Tag>
            </div>
          </div>
        </div>
      </Card>

      <!-- 3. 文件资产 -->
      <Card variant="borderless" class="kpi-card hover-lift">
        <div class="kpi-card-inner">
          <div class="kpi-icon-box bg-gradient-to-br from-amber-500 to-orange-600">
            <FolderOpenOutlined />
          </div>
          <div class="kpi-body">
            <Statistic
              :title="t('dashboard.fileCount')"
              :value="overview?.fileCount ?? '-'"
              class="kpi-stat"
            />
            <div class="kpi-meta-row">
              <span class="kpi-sub-label text-slate-500">
                {{ t('dashboard.fileManage') }}
              </span>
              <Tag color="orange" class="kpi-tag">Cloud / OSS</Tag>
            </div>
          </div>
        </div>
      </Card>

      <!-- 4. 待办审批 -->
      <Card variant="borderless" class="kpi-card hover-lift" @click="navigateTo('/approval/todo')">
        <div class="kpi-card-inner">
          <div class="kpi-icon-box bg-gradient-to-br from-orange-500 to-red-600">
            <AuditOutlined />
          </div>
          <div class="kpi-body">
            <Statistic
              :title="t('approval.instance.todoTitle')"
              :value="todoCount"
              class="kpi-stat"
            />
            <div class="kpi-meta-row">
              <span class="kpi-sub-label">{{ t('approval.instance.todoTitle') }}</span>
              <Tag v-if="todoCount > 0" color="orange" class="kpi-tag">{{ todoCount }} 待处理</Tag>
              <Tag v-else color="green" class="kpi-tag">无待办</Tag>
            </div>
          </div>
        </div>
      </Card>

      <!-- 5. SLA 成功率与吞吐 -->
      <Card variant="borderless" class="kpi-card hover-lift">
        <div class="kpi-card-inner">
          <div class="kpi-icon-box bg-gradient-to-br from-purple-500 to-pink-600">
            <SafetyCertificateOutlined />
          </div>
          <div class="kpi-body">
            <Statistic
              :title="t('dashboard.successRate')"
              :value="successRate"
              :suffix="successRate === '-' ? '' : '%'"
              class="kpi-stat"
            />
            <div class="kpi-meta-row">
              <span class="kpi-sub-label">
                {{ t('dashboard.todayOperationCount') }}:
                <strong>{{ overview?.todayOperationCount ?? '-' }}</strong>
              </span>
              <Tag
                :color="
                  numericSuccessRate >= 99 ? 'green' : numericSuccessRate >= 95 ? 'orange' : 'red'
                "
                class="kpi-tag"
              >
                {{
                  numericSuccessRate >= 99
                    ? t('dashboard.slaExcellent')
                    : numericSuccessRate >= 95
                      ? t('dashboard.slaGood')
                      : t('dashboard.slaWarning')
                }}
              </Tag>
            </div>
          </div>
        </div>
      </Card>
    </div>

    <!-- 运营质量、吞吐分析与日志排查区 -->
    <Row :gutter="[20, 20]" class="dashboard-mid-row">
      <!-- 左侧：今日吞吐与调用质量透视 -->
      <Col :xs="24" :lg="16">
        <Card variant="borderless" class="panel-card">
          <template #title>
            <div class="panel-card-title">
              <DashboardOutlined class="text-blue-500" />
              <span>{{ t('dashboard.healthTitle') }}</span>
            </div>
          </template>

          <div class="throughput-visual">
            <div class="throughput-stats-bar">
              <div class="tp-stat-item">
                <span class="tp-stat-label">{{ t('dashboard.todayOperationCount') }}</span>
                <span class="tp-stat-num">{{ overview?.todayOperationCount ?? 0 }}</span>
              </div>
              <div class="tp-stat-divider" />
              <div class="tp-stat-item">
                <span class="tp-stat-label text-emerald-600">
                  <CheckCircleFilled /> {{ t('dashboard.todaySuccessCount') }}
                </span>
                <span class="tp-stat-num text-emerald-600">{{ todaySuccessCount }}</span>
              </div>
              <div class="tp-stat-divider" />
              <div class="tp-stat-item">
                <span class="tp-stat-label text-rose-500">
                  <ExclamationCircleFilled /> {{ t('dashboard.todayFailedOperationCount') }}
                </span>
                <span class="tp-stat-num text-rose-500">{{
                  overview?.todayFailedOperationCount ?? 0
                }}</span>
              </div>
            </div>

            <div class="throughput-progress-wrap">
              <div class="tp-bar-legend">
                <span>{{ t('dashboard.successRate') }} (SLA)</span>
                <strong class="text-emerald-600">{{
                  successRate === '-' ? '-' : `${successRate}%`
                }}</strong>
              </div>
              <Progress
                :percent="numericSuccessRate"
                :stroke-color="{ '0%': '#10b981', '100%': '#059669' }"
                :rail-color="'#fee2e2'"
                :show-info="false"
              />
            </div>
          </div>
        </Card>
      </Col>

      <!-- 右侧：故障排查与审计通道 -->
      <Col :xs="24" :lg="8">
        <Card variant="borderless" class="panel-card">
          <template #title>
            <div class="panel-card-title">
              <AuditOutlined class="text-purple-500" />
              <span>{{ t('dashboard.viewLogs') }}</span>
            </div>
          </template>

          <div class="troubleshoot-box">
            <div v-if="(overview?.todayFailedOperationCount ?? 0) > 0" class="alert-box-warning">
              <ExclamationCircleFilled class="alert-icon text-rose-500" />
              <div class="alert-content">
                <div class="alert-title text-rose-700">
                  {{ t('dashboard.todayFailedOperationCount') }}:
                  {{ overview?.todayFailedOperationCount }}
                </div>
                <p class="alert-desc text-rose-600">建议进入审计日志查看具体异常堆栈与操作记录</p>
              </div>
            </div>
            <div v-else class="alert-box-healthy">
              <CheckCircleFilled class="alert-icon text-emerald-500" />
              <div class="alert-content">
                <div class="alert-title text-emerald-700">系统运行状态优良</div>
                <p class="alert-desc text-emerald-600">今日暂无失败操作记录，全业务链路稳定</p>
              </div>
            </div>

            <Button block class="log-jump-btn" @click="navigateTo('/system/log')">
              <AuditOutlined />
              {{ t('dashboard.viewLogs') }}
              <RightOutlined />
            </Button>
          </div>
        </Card>
      </Col>
    </Row>

    <!-- 核心资源全景导航卡片 -->
    <div class="resource-section">
      <div class="section-title-wrap">
        <div class="section-bar bg-blue-500" />
        <h3 class="section-heading">{{ t('dashboard.resourceOverview') }}</h3>
      </div>

      <Row :gutter="[16, 16]">
        <Col :xs="24" :sm="12" :lg="6">
          <div class="resource-card hover-lift" @click="navigateTo('/system/user')">
            <div class="res-icon bg-blue-50 text-blue-600">
              <UserOutlined />
            </div>
            <div class="res-info">
              <div class="res-name">{{ t('dashboard.userManage') }}</div>
              <div class="res-desc">{{ t('dashboard.userManageDesc') }}</div>
            </div>
            <ArrowRightOutlined class="res-arrow" />
          </div>
        </Col>

        <Col :xs="24" :sm="12" :lg="6">
          <div class="resource-card hover-lift" @click="navigateTo('/system/role')">
            <div class="res-icon bg-emerald-50 text-emerald-600">
              <TeamOutlined />
            </div>
            <div class="res-info">
              <div class="res-name">{{ t('dashboard.roleManage') }}</div>
              <div class="res-desc">{{ t('dashboard.roleManageDesc') }}</div>
            </div>
            <ArrowRightOutlined class="res-arrow" />
          </div>
        </Col>

        <Col :xs="24" :sm="12" :lg="6">
          <div class="resource-card hover-lift" @click="navigateTo('/system/dept')">
            <div class="res-icon bg-purple-50 text-purple-600">
              <TeamOutlined />
            </div>
            <div class="res-info">
              <div class="res-name">{{ t('dashboard.deptManage') }}</div>
              <div class="res-desc">{{ t('dashboard.deptManageDesc') }}</div>
            </div>
            <ArrowRightOutlined class="res-arrow" />
          </div>
        </Col>

        <Col :xs="24" :sm="12" :lg="6">
          <div class="resource-card hover-lift" @click="navigateTo('/approval/todo')">
            <div class="res-icon bg-orange-50 text-orange-600">
              <AuditOutlined />
            </div>
            <div class="res-info">
              <div class="res-name">{{ t('approval.instance.todoTitle') }}</div>
              <div class="res-desc">{{ t('approval.title') }}</div>
            </div>
            <ArrowRightOutlined class="res-arrow" />
          </div>
        </Col>

        <Col :xs="24" :sm="12" :lg="6">
          <div class="resource-card hover-lift" @click="navigateTo('/system/file')">
            <div class="res-icon bg-amber-50 text-amber-600">
              <FolderOpenOutlined />
            </div>
            <div class="res-info">
              <div class="res-name">{{ t('dashboard.fileManage') }}</div>
              <div class="res-desc">{{ t('dashboard.fileManageDesc') }}</div>
            </div>
            <ArrowRightOutlined class="res-arrow" />
          </div>
        </Col>
      </Row>
    </div>
  </div>
</template>

<style scoped lang="scss">
.dashboard-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 100%;
  padding-bottom: 24px;
}

.dashboard-header {
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

.period-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  background: #ffffff;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}

.period-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #475569;
}

.period-icon {
  color: #0284c7;
}

.live-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 4px;
}

.live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #06b6d4;
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
    transform: scale(0.8);
  }
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}

.kpi-card {
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

.kpi-card-inner {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.kpi-icon-box {
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

.kpi-body {
  flex: 1;
  min-width: 0;
}

.kpi-stat {
  :deep(.ant-statistic-title) {
    font-size: 13px;
    color: #64748b;
    margin-bottom: 4px;
    font-weight: 500;
  }

  :deep(.ant-statistic-content-value) {
    font-size: 24px;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: -0.02em;
  }

  :deep(.ant-statistic-content-suffix) {
    font-size: 14px;
    font-weight: 600;
    color: #64748b;
    margin-left: 2px;
  }
}

.kpi-progress-box {
  margin-top: 8px;
}

.kpi-progress-labels {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  margin-bottom: 2px;
}

.kpi-sub-label {
  font-size: 12px;
  color: #64748b;
}

.kpi-sub-rate {
  font-size: 12px;
  font-weight: 600;
  color: #3b82f6;
}

.kpi-meta-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
}

.kpi-tag {
  margin: 0;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.panel-card {
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  height: 100%;

  :deep(.ant-card-head) {
    padding: 14px 20px;
    border-bottom: 1px solid #f1f5f9;
  }

  :deep(.ant-card-body) {
    padding: 20px;
  }
}

.panel-card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: #0f172a;
}

.throughput-visual {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.throughput-stats-bar {
  display: flex;
  justify-content: space-around;
  align-items: center;
  background: #f8fafc;
  border-radius: 10px;
  padding: 14px 16px;
  border: 1px solid #edf2f7;
}

.tp-stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.tp-stat-label {
  font-size: 12px;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 4px;
}

.tp-stat-num {
  font-size: 22px;
  font-weight: 700;
  color: #0f172a;
}

.tp-stat-divider {
  width: 1px;
  height: 32px;
  background: #e2e8f0;
}

.throughput-progress-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tp-bar-legend {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: #475569;
}

.troubleshoot-box {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  justify-content: space-between;
}

.alert-box-warning {
  display: flex;
  gap: 12px;
  padding: 14px;
  background: #fff1f2;
  border: 1px solid #fecdd3;
  border-radius: 10px;
}

.alert-box-healthy {
  display: flex;
  gap: 12px;
  padding: 14px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 10px;
}

.alert-icon {
  font-size: 20px;
  margin-top: 2px;
  flex-shrink: 0;
}

.alert-content {
  flex: 1;
}

.alert-title {
  font-size: 14px;
  font-weight: 600;
}

.alert-desc {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.5;
}

.log-jump-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  height: 40px;
  border-radius: 8px;
  border-color: #cbd5e1;
  color: #334155;
  font-weight: 500;

  &:hover {
    color: #2563eb;
    border-color: #93c5fd;
    background: #eff6ff;
  }
}

.resource-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.section-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-bar {
  width: 4px;
  height: 16px;
  border-radius: 2px;
}

.section-heading {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #0f172a;
}

.resource-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: #ffffff;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  cursor: pointer;
  transition: all 0.25s ease;
}

.res-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.res-info {
  flex: 1;
  min-width: 0;
}

.res-name {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
}

.res-desc {
  font-size: 12px;
  color: #64748b;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.res-arrow {
  color: #94a3b8;
  font-size: 14px;
  transition: transform 0.2s ease;
}

.resource-card:hover .res-arrow {
  color: #2563eb;
  transform: translateX(4px);
}
</style>
