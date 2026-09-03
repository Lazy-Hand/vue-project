<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Avatar, Button, Card, Col, Row, Skeleton, Tag } from 'antdv-next'
import {
  ArrowRightOutlined,
  AuditOutlined,
  CheckCircleFilled,
  FileTextOutlined,
  NotificationOutlined,
  PlusOutlined,
  ReloadOutlined,
  SettingOutlined,
  TeamOutlined,
  ThunderboltFilled,
  ThunderboltOutlined,
  UserAddOutlined,
  UserOutlined,
} from '@antdv-next/icons'

import { fetchTodoList } from '@/api/approval'
import { fetchDashboardOverview } from '@/api/dashboard'
import { buildFileUrl } from '@/api/file'
import { fetchPublishedNotices } from '@/api/notice'
import MenuIcon from '@/components/MenuIcon/index.vue'
import { useNoticeSse } from '@/composables/useNoticeSse'
import { useAuthStore } from '@/stores/auth'
import type { ApprovalInstance } from '@/types/approval'
import type { DashboardOverview } from '@/types/dashboard'
import type { PublishedNotice } from '@/types/notice'

interface LaunchpadApp {
  key: string
  title: string
  desc: string
  path: string
  icon: string
  badgeText: string
  themeClass: string
}

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()

const overview = ref<DashboardOverview | null>(null)
const notices = ref<PublishedNotice[]>([])
const loading = ref(false)
const noticesLoading = ref(false)
const todos = ref<ApprovalInstance[]>([])
const todosLoading = ref(false)

const displayName = computed(
  () => authStore.user?.nickname || authStore.user?.username || t('common.user'),
)

const avatarSrc = computed(() =>
  authStore.user?.avatar ? buildFileUrl(authStore.user.avatar) : undefined,
)

const currentAccountSetName = computed(() => {
  const currentId = authStore.currentAccountSetId
  const match = (authStore.accountSets || []).find((a) => a.id === currentId)
  return match?.name || t('home.accountSet')
})

const greetingText = computed(() => {
  const hour = new Date().getHours()
  if (hour < 9) return t('home.greetingMorning')
  if (hour < 12) return t('home.greetingForenoon')
  if (hour < 14) return t('home.greetingNoon')
  if (hour < 18) return t('home.greetingAfternoon')
  return t('home.greetingEvening')
})

const successRate = computed<string>(() => {
  const total = overview.value?.todayOperationCount ?? 0
  if (total <= 0) return '100.0'
  const failed = overview.value?.todayFailedOperationCount ?? 0
  return (((total - failed) / total) * 100).toFixed(1)
})

const launchpadApps: LaunchpadApp[] = [
  {
    key: 'user',
    title: '用户管理',
    desc: '账号分配与部门岗位体系',
    path: '/system/user',
    icon: 'UserOutlined',
    badgeText: '核心账号',
    themeClass: 'theme-blue',
  },
  {
    key: 'role',
    title: '角色管理',
    desc: '角色标识与权限授权矩阵',
    path: '/system/role',
    icon: 'SafetyOutlined',
    badgeText: 'RBAC',
    themeClass: 'theme-emerald',
  },
  {
    key: 'dept',
    title: '部门架构',
    desc: '组织树级关系与部门负责人',
    path: '/system/dept',
    icon: 'ApartmentOutlined',
    badgeText: '组织拓扑',
    themeClass: 'theme-purple',
  },
  {
    key: 'permission',
    title: '菜单权限',
    desc: '动态路由规则与接口鉴权',
    path: '/system/permission',
    icon: 'SettingOutlined',
    badgeText: '路由鉴权',
    themeClass: 'theme-indigo',
  },
  {
    key: 'post',
    title: '岗位管理',
    desc: '职位体系与岗位编制设定',
    path: '/system/post',
    icon: 'TeamOutlined',
    badgeText: '职位体系',
    themeClass: 'theme-amber',
  },
  {
    key: 'file',
    title: '文件中心',
    desc: '云端多媒体与公共存储资源',
    path: '/system/file',
    icon: 'FolderOutlined',
    badgeText: '存储分发',
    themeClass: 'theme-cyan',
  },
  {
    key: 'log',
    title: '审计日志',
    desc: '全量操作轨迹与安全回溯',
    path: '/system/log',
    icon: 'AuditOutlined',
    badgeText: '安全可溯',
    themeClass: 'theme-slate',
  },
  {
    key: 'notice',
    title: '通知公告',
    desc: '全员与受众精准业务公文',
    path: '/system/notice',
    icon: 'NotificationOutlined',
    badgeText: '即时触达',
    themeClass: 'theme-rose',
  },
]

async function loadData() {
  loading.value = true
  try {
    overview.value = await fetchDashboardOverview()
  } catch {
    // Graceful fallback for mock or unauthenticated states
  } finally {
    loading.value = false
  }
}

async function loadNotices() {
  noticesLoading.value = true
  try {
    const res = await fetchPublishedNotices({ page: 1, pageSize: 4 })
    notices.value = res.items || []
  } catch {
    notices.value = []
  } finally {
    noticesLoading.value = false
  }
}

async function loadTodos() {
  todosLoading.value = true
  try {
    const res = await fetchTodoList({ page: 1, pageSize: 4 })
    todos.value = (res.items || []).map((item) => item.instance)
  } catch {
    todos.value = []
  } finally {
    todosLoading.value = false
  }
}

function navigateTo(path: string) {
  void router.push(path)
}

function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getMonth() + 1}/${d.getDate()}`
}

useNoticeSse({
  onApprovalTodo: () => void loadTodos(),
  onApprovalTodoRefresh: () => void loadTodos(),
})

onMounted(() => {
  void loadData()
  void loadNotices()
  void loadTodos()
})
</script>

<template>
  <div class="home-workbench">
    <!-- 顶部工作台指令横幅 (Welcome Command Strip) -->
    <div class="command-strip">
      <div class="command-strip__main">
        <div class="command-strip__avatar-wrap">
          <Avatar :size="48" :src="avatarSrc" class="command-strip__avatar">
            <template v-if="!avatarSrc" #icon>
              <UserOutlined />
            </template>
          </Avatar>
          <span class="command-strip__status-dot" />
        </div>

        <div class="command-strip__meta">
          <div class="command-strip__title-row">
            <h1 class="command-strip__greeting">{{ greetingText }}，{{ displayName }}</h1>
            <div class="command-strip__live-pill">
              <span class="live-pulse-dot" />
              <span class="live-pulse-text">{{ t('home.systemOnline') }}</span>
              <span class="live-pulse-sep">·</span>
              <span class="live-pulse-sla">SLA 99.9%</span>
            </div>
          </div>
          <div class="command-strip__sub-row">
            <span class="command-strip__tag">
              <span class="command-strip__tag-label">{{ t('home.accountSet') }}:</span>
              <span class="command-strip__tag-value">{{ currentAccountSetName }}</span>
            </span>
            <span class="command-strip__divider">/</span>
            <span class="command-strip__tag">
              <span class="command-strip__tag-label"
                >{{ t('dashboard.todayOperationCount') }}:</span
              >
              <span class="command-strip__tag-value">{{ overview?.todayOperationCount ?? 0 }}</span>
            </span>
            <span class="command-strip__divider">/</span>
            <span class="command-strip__tag">
              <span class="command-strip__tag-label">{{ t('dashboard.successRate') }}:</span>
              <span class="command-strip__tag-value text-emerald-500 font-semibold"
                >{{ successRate }}%</span
              >
            </span>
          </div>
        </div>
      </div>

      <div class="command-strip__actions">
        <Button class="action-btn action-btn--ghost" :loading="loading" @click="loadData">
          <ReloadOutlined />
          <span>{{ t('dashboard.refresh') }}</span>
        </Button>
        <Button
          type="primary"
          class="action-btn action-btn--primary"
          @click="navigateTo('/approval/todo')"
        >
          <AuditOutlined />
          <span>{{ t('approval.instance.todoTitle') }} ({{ todos.length }})</span>
        </Button>
      </div>
    </div>

    <!-- Ridgeline 风格三大核心指标卡 (Hero KPI Cards with Sparklines) -->
    <div class="kpi-grid">
      <!-- KPI 1: 用户规模与活跃 -->
      <div class="kpi-card" @click="navigateTo('/system/user')">
        <div class="kpi-card__header">
          <div class="kpi-card__title-box">
            <div class="kpi-card__icon-badge kpi-card__icon-badge--blue">
              <TeamOutlined />
            </div>
            <span class="kpi-card__label">{{ t('home.userScale') }}</span>
          </div>
          <span class="trend-badge trend-badge--up">
            <span>↑ 12.5%</span>
          </span>
        </div>

        <div class="kpi-card__metric">
          <span class="metric-number">{{ overview?.userCount ?? 0 }}</span>
          <span class="metric-caption"
            >{{ t('dashboard.enabledUserCount') }}: {{ overview?.enabledUserCount ?? 0 }}</span
          >
        </div>

        <!-- 拟真趋势微图 (SVG Sparkline Curve) -->
        <div class="kpi-card__sparkline-box">
          <svg class="sparkline-svg" viewBox="0 0 280 48" preserveAspectRatio="none">
            <defs>
              <linearGradient id="kpiGradBlue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.25" />
                <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.0" />
              </linearGradient>
            </defs>
            <path
              d="M0,38 C30,36 60,30 90,34 C120,38 150,22 180,26 C210,30 240,12 280,10 L280,48 L0,48 Z"
              fill="url(#kpiGradBlue)"
            />
            <path
              d="M0,38 C30,36 60,30 90,34 C120,38 150,22 180,26 C210,30 240,12 280,10"
              fill="none"
              stroke="#3b82f6"
              stroke-width="2.2"
              stroke-linecap="round"
            />
            <circle cx="280" cy="10" r="3.5" fill="#3b82f6" class="sparkline-glow-dot" />
          </svg>
        </div>

        <div class="kpi-card__footer">
          <span class="footer-link-text">{{ t('home.viewUserManage') }}</span>
          <ArrowRightOutlined class="footer-link-arrow" />
        </div>
      </div>

      <!-- KPI 2: 服务调用质量与稳定性 -->
      <div class="kpi-card" @click="navigateTo('/system/log')">
        <div class="kpi-card__header">
          <div class="kpi-card__title-box">
            <div class="kpi-card__icon-badge kpi-card__icon-badge--emerald">
              <ThunderboltOutlined />
            </div>
            <span class="kpi-card__label">{{ t('home.serviceQuality') }}</span>
          </div>
          <span class="trend-badge trend-badge--emerald">
            <CheckCircleFilled />
            <span>99.9% SLA</span>
          </span>
        </div>

        <div class="kpi-card__metric">
          <span class="metric-number text-emerald-500">{{ successRate }}%</span>
          <span class="metric-caption">
            {{ t('dashboard.todayOperationCount') }}: {{ overview?.todayOperationCount ?? 0 }}
          </span>
        </div>

        <div class="kpi-card__sparkline-box">
          <svg class="sparkline-svg" viewBox="0 0 280 48" preserveAspectRatio="none">
            <defs>
              <linearGradient id="kpiGradEmerald" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#10b981" stop-opacity="0.25" />
                <stop offset="100%" stop-color="#10b981" stop-opacity="0.0" />
              </linearGradient>
            </defs>
            <path
              d="M0,32 C40,30 70,36 110,24 C150,14 190,20 230,12 C255,8 270,10 280,6 L280,48 L0,48 Z"
              fill="url(#kpiGradEmerald)"
            />
            <path
              d="M0,32 C40,30 70,36 110,24 C150,14 190,20 230,12 C255,8 270,10 280,6"
              fill="none"
              stroke="#10b981"
              stroke-width="2.2"
              stroke-linecap="round"
            />
            <circle cx="280" cy="6" r="3.5" fill="#10b981" class="sparkline-glow-dot" />
          </svg>
        </div>

        <div class="kpi-card__footer">
          <span class="footer-link-text">{{ t('home.viewAuditLog') }}</span>
          <ArrowRightOutlined class="footer-link-arrow" />
        </div>
      </div>

      <!-- KPI 3: 流程待办与数字资产 -->
      <div class="kpi-card" @click="navigateTo('/approval/todo')">
        <div class="kpi-card__header">
          <div class="kpi-card__title-box">
            <div class="kpi-card__icon-badge kpi-card__icon-badge--amber">
              <AuditOutlined />
            </div>
            <span class="kpi-card__label">{{ t('home.workflowAssets') }}</span>
          </div>
          <span class="trend-badge trend-badge--amber">
            <span>{{ todos.length }} 待办任务</span>
          </span>
        </div>

        <div class="kpi-card__metric">
          <span class="metric-number">{{ overview?.fileCount ?? 0 }}</span>
          <span class="metric-caption">
            {{ t('dashboard.fileCount') }} · 部门 {{ overview?.deptCount ?? 0 }}
          </span>
        </div>

        <div class="kpi-card__sparkline-box">
          <svg class="sparkline-svg" viewBox="0 0 280 48" preserveAspectRatio="none">
            <defs>
              <linearGradient id="kpiGradAmber" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.25" />
                <stop offset="100%" stop-color="#f59e0b" stop-opacity="0.0" />
              </linearGradient>
            </defs>
            <path
              d="M0,28 C35,32 75,18 115,22 C155,26 195,14 235,16 C255,18 270,12 280,10 L280,48 L0,48 Z"
              fill="url(#kpiGradAmber)"
            />
            <path
              d="M0,28 C35,32 75,18 115,22 C155,26 195,14 235,16 C255,18 270,12 280,10"
              fill="none"
              stroke="#f59e0b"
              stroke-width="2.2"
              stroke-linecap="round"
            />
            <circle cx="280" cy="10" r="3.5" fill="#f59e0b" class="sparkline-glow-dot" />
          </svg>
        </div>

        <div class="kpi-card__footer">
          <span class="footer-link-text">{{ t('home.viewTodoCenter') }}</span>
          <ArrowRightOutlined class="footer-link-arrow" />
        </div>
      </div>
    </div>

    <!-- 核心业务应用矩阵 (Application Launchpad) -->
    <div class="section-container">
      <div class="section-header">
        <div class="section-title-wrap">
          <div class="section-badge-dot" />
          <h2 class="section-heading">{{ t('home.launchpadTitle') }}</h2>
          <span class="section-subheading">{{ t('home.launchpadSubtitle') }}</span>
        </div>
      </div>

      <div class="launchpad-grid">
        <div
          v-for="app in launchpadApps"
          :key="app.key"
          class="launchpad-card"
          @click="navigateTo(app.path)"
        >
          <div class="launchpad-card__top">
            <div class="launchpad-icon-box" :class="app.themeClass">
              <MenuIcon :icon="app.icon" class="launchpad-icon" />
            </div>
            <span class="launchpad-pill-tag">{{ app.badgeText }}</span>
          </div>

          <div class="launchpad-card__body">
            <div class="launchpad-app-title">{{ app.title }}</div>
            <div class="launchpad-app-desc">{{ app.desc }}</div>
          </div>

          <div class="launchpad-card__bottom">
            <span class="launchpad-enter-hint">进入模块</span>
            <ArrowRightOutlined class="launchpad-arrow-icon" />
          </div>
        </div>
      </div>
    </div>

    <!-- 下半部分：双栏操作与信息流 (Two-Column Workspace Feeds) -->
    <Row :gutter="[20, 20]" class="workbench-split">
      <!-- 左侧 60%：审批流程流转与高频快捷入口 -->
      <Col :xs="24" :lg="15" class="split-col">
        <!-- 待办审批流转 -->
        <Card variant="borderless" class="workbench-panel">
          <template #title>
            <div class="panel-header-title">
              <AuditOutlined class="panel-title-icon text-amber-500" />
              <span>{{ t('approval.instance.todoTitle') }}</span>
              <span v-if="todos.length" class="panel-badge-count">{{ todos.length }}</span>
            </div>
          </template>
          <template #extra>
            <Button
              type="link"
              size="small"
              class="panel-extra-link"
              @click="navigateTo('/approval/todo')"
            >
              {{ t('home.viewTodoCenter') }} →
            </Button>
          </template>

          <div v-if="todosLoading" class="panel-loading-wrap">
            <Skeleton active :paragraph="{ rows: 3 }" />
          </div>
          <div v-else-if="todos.length > 0" class="feed-list">
            <div
              v-for="item in todos"
              :key="item.id"
              class="feed-item"
              @click="navigateTo('/approval/todo')"
            >
              <div class="feed-item__avatar feed-item__avatar--amber">
                <AuditOutlined />
              </div>
              <div class="feed-item__content">
                <div class="feed-item__title-row">
                  <span class="feed-item__title">{{ item.title }}</span>
                  <span class="feed-item__date">{{ formatDate(item.createdAt) }}</span>
                </div>
                <div class="feed-item__meta-row">
                  <Tag color="orange" class="feed-item__tag">流转审批中</Tag>
                  <span class="feed-item__subtext">流程编号: {{ item.id.slice(0, 8) }}</span>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="feed-empty-state">
            <span class="empty-hint">{{ t('approval.instance.noTasks') }}</span>
          </div>
        </Card>

        <!-- 高频快捷操作栏 -->
        <Card variant="borderless" class="workbench-panel">
          <template #title>
            <div class="panel-header-title">
              <ThunderboltFilled class="panel-title-icon text-blue-500" />
              <span>{{ t('home.quickActionsTitle') }}</span>
            </div>
          </template>

          <div class="quick-nav-grid">
            <div class="quick-nav-pill" @click="navigateTo('/system/user')">
              <UserAddOutlined class="quick-pill-icon text-blue-500" />
              <span class="quick-pill-label">{{ t('home.createUser') }}</span>
            </div>
            <div class="quick-nav-pill" @click="navigateTo('/system/dept')">
              <PlusOutlined class="quick-pill-icon text-purple-500" />
              <span class="quick-pill-label">{{ t('home.createDept') }}</span>
            </div>
            <div class="quick-nav-pill" @click="navigateTo('/system/notice')">
              <NotificationOutlined class="quick-pill-icon text-rose-500" />
              <span class="quick-pill-label">{{ t('home.publishNotice') }}</span>
            </div>
            <div class="quick-nav-pill" @click="navigateTo('/system/log')">
              <AuditOutlined class="quick-pill-icon text-slate-500" />
              <span class="quick-pill-label">{{ t('home.viewLogs') }}</span>
            </div>
            <div class="quick-nav-pill" @click="navigateTo('/approval/todo')">
              <AuditOutlined class="quick-pill-icon text-amber-500" />
              <span class="quick-pill-label">{{ t('approval.instance.todoTitle') }}</span>
            </div>
            <div class="quick-nav-pill" @click="navigateTo('/system/config')">
              <SettingOutlined class="quick-pill-icon text-indigo-500" />
              <span class="quick-pill-label">参数配置</span>
            </div>
          </div>
        </Card>
      </Col>

      <!-- 右侧 40%：系统公告速递与环境基座 -->
      <Col :xs="24" :lg="9" class="split-col">
        <!-- 最新系统公告 -->
        <Card variant="borderless" class="workbench-panel">
          <template #title>
            <div class="panel-header-title">
              <NotificationOutlined class="panel-title-icon text-rose-500" />
              <span>{{ t('home.noticesTitle') }}</span>
            </div>
          </template>
          <template #extra>
            <Button
              type="link"
              size="small"
              class="panel-extra-link"
              @click="navigateTo('/system/notice')"
            >
              {{ t('home.viewAllNotices') }} →
            </Button>
          </template>

          <div v-if="noticesLoading" class="panel-loading-wrap">
            <Skeleton active :paragraph="{ rows: 3 }" />
          </div>
          <div v-else-if="notices.length > 0" class="feed-list">
            <div
              v-for="item in notices"
              :key="item.id"
              class="feed-item"
              @click="navigateTo('/system/notice')"
            >
              <div class="feed-item__avatar feed-item__avatar--rose">
                <FileTextOutlined />
              </div>
              <div class="feed-item__content">
                <div class="feed-item__title-row">
                  <span class="feed-item__title">{{ item.title }}</span>
                  <span class="feed-item__date">{{
                    formatDate(item.publishedAt || item.createdAt)
                  }}</span>
                </div>
                <div class="feed-item__meta-row">
                  <Tag color="magenta" class="feed-item__tag">{{ item.targetScope || 'ALL' }}</Tag>
                  <span class="feed-item__subtext">官方已发布</span>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="feed-empty-state">
            <span class="empty-hint">{{ t('home.noNotices') }}</span>
          </div>
        </Card>

        <!-- 系统运行基座 -->
        <Card variant="borderless" class="workbench-panel">
          <template #title>
            <div class="panel-header-title">
              <SettingOutlined class="panel-title-icon text-indigo-500" />
              <span>{{ t('home.techInfoTitle') }}</span>
            </div>
          </template>

          <div class="spec-list">
            <div class="spec-row">
              <span class="spec-label">核心底座</span>
              <span class="spec-pill spec-pill--cyan">Vue 3.6 + TS 6.0</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">UI 组件库</span>
              <span class="spec-pill spec-pill--blue">Antdv-Next</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">样式系统</span>
              <span class="spec-pill spec-pill--purple">SCSS + Tailwind</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">网络与状态</span>
              <span class="spec-pill spec-pill--amber">Alova + Pinia</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">运行环境</span>
              <span class="spec-pill spec-pill--emerald">Node >= 22.12.0</span>
            </div>
          </div>
        </Card>
      </Col>
    </Row>
  </div>
</template>

<style scoped lang="scss">
.home-workbench {
  padding-bottom: 24px;
}

/* 1. 顶部指令横幅 (Command Strip) */
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

.command-strip__avatar {
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
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

/* 2. Ridgeline 风格三大指标卡 (KPI Grid) */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 24px;

  @media (max-width: 960px) {
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

    .footer-link-arrow {
      transform: translateX(4px);
      color: var(--app-color-primary, #3b82f6);
    }
    .footer-link-text {
      color: var(--app-color-primary, #3b82f6);
    }
  }
}

.kpi-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.kpi-card__title-box {
  display: flex;
  align-items: center;
  gap: 8px;
}

.kpi-card__icon-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  font-size: 14px;
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

.kpi-card__label {
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
}

.trend-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 600;
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

.kpi-card__metric {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 8px;
}

.metric-number {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.1;
  color: #0f172a;
  letter-spacing: -0.02em;
}

.metric-caption {
  font-size: 12px;
  color: #94a3b8;
}

.kpi-card__sparkline-box {
  width: 100%;
  height: 48px;
  margin: 4px 0 10px;
}

.sparkline-svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.sparkline-glow-dot {
  filter: drop-shadow(0 0 3px currentColor);
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
}

.footer-link-text {
  font-weight: 500;
  transition: color 0.2s;
}

.footer-link-arrow {
  font-size: 11px;
  transition:
    transform 0.2s,
    color 0.2s;
}

/* 3. 应用启动台矩阵 (Application Launchpad) */
.section-container {
  margin-bottom: 24px;
}

.section-header {
  margin-bottom: 14px;
}

.section-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-badge-dot {
  width: 4px;
  height: 14px;
  background-color: var(--app-color-primary, #3b82f6);
  border-radius: 2px;
}

.section-heading {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
}

.section-subheading {
  font-size: 12px;
  color: #94a3b8;
}

.launchpad-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;

  @media (max-width: 1100px) {
    grid-template-columns: repeat(2, 1fr);
  }
  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
}

.launchpad-card {
  display: flex;
  flex-direction: column;
  padding: 16px;
  background: #ffffff;
  border: 1px solid #eaedf3;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    transform: translateY(-2px);
    border-color: #cbd5e1;
    box-shadow: 0 6px 16px rgba(15, 23, 42, 0.05);

    .launchpad-arrow-icon {
      transform: translateX(4px);
      color: var(--app-color-primary, #3b82f6);
    }
    .launchpad-enter-hint {
      color: var(--app-color-primary, #3b82f6);
    }
  }
}

.launchpad-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.launchpad-icon-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 8px;
  font-size: 18px;
}

.theme-blue {
  background-color: #eff6ff;
  color: #3b82f6;
}
.theme-emerald {
  background-color: #ecfdf5;
  color: #10b981;
}
.theme-purple {
  background-color: #faf5ff;
  color: #a855f7;
}
.theme-indigo {
  background-color: #eef2ff;
  color: #6366f1;
}
.theme-amber {
  background-color: #fffbeb;
  color: #f59e0b;
}
.theme-cyan {
  background-color: #ecfeff;
  color: #06b6d4;
}
.theme-slate {
  background-color: #f1f5f9;
  color: #475569;
}
.theme-rose {
  background-color: #fff1f2;
  color: #f43f5e;
}

.launchpad-pill-tag {
  font-size: 11px;
  font-weight: 500;
  color: #94a3b8;
  background-color: #f8fafc;
  border: 1px solid #f1f5f9;
  padding: 1px 6px;
  border-radius: 4px;
}

.launchpad-card__body {
  flex: 1;
}

.launchpad-app-title {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  margin-bottom: 4px;
}

.launchpad-app-desc {
  font-size: 12px;
  color: #64748b;
  line-height: 1.4;
}

.launchpad-card__bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 14px;
  padding-top: 10px;
  border-top: 1px solid #f8fafc;
  font-size: 12px;
  color: #94a3b8;
}

.launchpad-enter-hint {
  font-weight: 500;
  transition: color 0.2s;
}

.launchpad-arrow-icon {
  font-size: 11px;
  transition:
    transform 0.2s,
    color 0.2s;
}

/* 4. 双栏流转与信息看板 (Workbench Split Layout) */
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

/* 动态列表 (Feed List) */
.feed-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.feed-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #f8fafc;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background-color: #f8fafc;
    border-color: #e2e8f0;

    .feed-item__title {
      color: var(--app-color-primary, #3b82f6);
    }
  }
}

.feed-item__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  flex-shrink: 0;
  font-size: 14px;
}

.feed-item__avatar--amber {
  background-color: #fffbeb;
  color: #f59e0b;
}

.feed-item__avatar--rose {
  background-color: #fff1f2;
  color: #f43f5e;
}

.feed-item__content {
  flex: 1;
  min-width: 0;
}

.feed-item__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.feed-item__title {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.2s;
}

.feed-item__date {
  font-size: 11px;
  color: #94a3b8;
  flex-shrink: 0;
}

.feed-item__meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.feed-item__tag {
  margin: 0;
  padding: 0 4px;
  font-size: 10px;
  line-height: 16px;
}

.feed-item__subtext {
  font-size: 11px;
  color: #94a3b8;
}

.feed-empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 0;
  color: #94a3b8;
  font-size: 13px;
}

/* 高频快捷操作网格 (Quick Nav Grid) */
.quick-nav-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;

  @media (max-width: 640px) {
    grid-template-columns: repeat(2, 1fr);
  }
}

.quick-nav-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background-color: #f8fafc;
  border: 1px solid #eaedf3;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background-color: #ffffff;
    border-color: #cbd5e1;
    box-shadow: 0 2px 6px rgba(15, 23, 42, 0.04);
  }
}

.quick-pill-icon {
  font-size: 15px;
}

.quick-pill-label {
  font-size: 13px;
  font-weight: 500;
  color: #334155;
}

/* 规格环境列表 (Spec List) */
.spec-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.spec-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: 6px;
  background-color: #f8fafc;
  font-size: 12px;
}

.spec-label {
  color: #64748b;
  font-weight: 500;
}

.spec-pill {
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
  font-size: 11px;
}

.spec-pill--cyan {
  background-color: #ecfeff;
  color: #0891b2;
}
.spec-pill--blue {
  background-color: #eff6ff;
  color: #2563eb;
}
.spec-pill--purple {
  background-color: #faf5ff;
  color: #9333ea;
}
.spec-pill--amber {
  background-color: #fffbeb;
  color: #d97706;
}
.spec-pill--emerald {
  background-color: #ecfdf5;
  color: #059669;
}

/* ==========================================================================
   暗黑模式适配 (Dark Theme Harmony)
   ========================================================================== */
html.dark {
  .command-strip {
    background: #1c1d22;
    border-color: #2a2c33;
    box-shadow: none;
  }

  .command-strip__avatar {
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

  /* 启动台 */
  .section-heading {
    color: #ffffff;
  }

  .launchpad-card {
    background: #1c1d22;
    border-color: #2a2c33;

    &:hover {
      background: #202228;
      border-color: #3e424e;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
    }
  }

  .launchpad-app-title {
    color: #ffffff;
  }

  .launchpad-app-desc {
    color: #8b909a;
  }

  .launchpad-pill-tag {
    background-color: #22242a;
    border-color: #2e3038;
    color: #94a3b8;
  }

  .launchpad-card__bottom {
    border-top-color: #262830;
    color: #64748b;
  }

  .theme-blue {
    background-color: rgba(59, 130, 246, 0.12);
    color: #60a5fa;
  }
  .theme-emerald {
    background-color: rgba(16, 185, 129, 0.12);
    color: #34d399;
  }
  .theme-purple {
    background-color: rgba(168, 85, 247, 0.12);
    color: #c084fc;
  }
  .theme-indigo {
    background-color: rgba(99, 102, 241, 0.12);
    color: #818cf8;
  }
  .theme-amber {
    background-color: rgba(245, 158, 11, 0.12);
    color: #fbbf24;
  }
  .theme-cyan {
    background-color: rgba(6, 182, 212, 0.12);
    color: #22d3ee;
  }
  .theme-slate {
    background-color: rgba(148, 163, 184, 0.12);
    color: #cbd5e1;
  }
  .theme-rose {
    background-color: rgba(244, 63, 94, 0.12);
    color: #fb7185;
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

  .feed-item {
    border-color: transparent;

    &:hover {
      background-color: #22242a;
      border-color: #2e3038;

      .feed-item__title {
        color: #ffffff;
      }
    }
  }

  .feed-item__avatar--amber {
    background-color: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
  }

  .feed-item__avatar--rose {
    background-color: rgba(244, 63, 94, 0.15);
    color: #fb7185;
  }

  .feed-item__title {
    color: #e2e8f0;
  }

  .feed-item__subtext {
    color: #64748b;
  }

  .quick-nav-pill {
    background-color: #22242a;
    border-color: #2e3038;

    &:hover {
      background-color: #262830;
      border-color: #3b3e48;

      .quick-pill-label {
        color: #ffffff;
      }
    }
  }

  .quick-pill-label {
    color: #cbd5e1;
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
  .spec-pill--purple {
    background-color: rgba(168, 85, 247, 0.15);
    color: #c084fc;
  }
  .spec-pill--amber {
    background-color: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
  }
  .spec-pill--emerald {
    background-color: rgba(16, 185, 129, 0.15);
    color: #34d399;
  }
}
</style>
