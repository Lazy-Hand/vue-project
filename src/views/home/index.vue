<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Avatar, Button, Card, Col, Row, Skeleton, Statistic, Tag } from 'antdv-next'
import {
  ArrowRightOutlined,
  AuditOutlined,
  CheckCircleFilled,
  FileTextOutlined,
  NotificationOutlined,
  PlusOutlined,
  ReloadOutlined,
  RocketFilled,
  SettingOutlined,
  ThunderboltFilled,
  UserAddOutlined,
  UserOutlined,
} from '@antdv-next/icons'

import { fetchDashboardOverview } from '@/api/dashboard'
import { buildFileUrl } from '@/api/file'
import { fetchPublishedNotices } from '@/api/notice'
import MenuIcon from '@/components/MenuIcon/index.vue'
import { useAuthStore } from '@/stores/auth'
import type { DashboardOverview } from '@/types/dashboard'
import type { PublishedNotice } from '@/types/notice'

interface LaunchpadApp {
  key: string
  title: string
  desc: string
  path: string
  icon: string
  gradientClass: string
}

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()

const overview = ref<DashboardOverview | null>(null)
const notices = ref<PublishedNotice[]>([])
const loading = ref(false)
const noticesLoading = ref(false)

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
    desc: '系统账号与部门/岗位归属分配',
    path: '/system/user',
    icon: 'UserOutlined',
    gradientClass: 'from-blue-500 to-blue-700',
  },
  {
    key: 'role',
    title: '角色管理',
    desc: '角色标识与功能/数据权限策略',
    path: '/system/role',
    icon: 'SafetyOutlined',
    gradientClass: 'from-emerald-500 to-emerald-700',
  },
  {
    key: 'dept',
    title: '部门架构',
    desc: '公司多级组织架构树与负责人',
    path: '/system/dept',
    icon: 'ApartmentOutlined',
    gradientClass: 'from-purple-500 to-purple-700',
  },
  {
    key: 'permission',
    title: '菜单权限',
    desc: '动态路由、菜单树与按钮鉴权',
    path: '/system/permission',
    icon: 'SettingOutlined',
    gradientClass: 'from-pink-500 to-pink-700',
  },
  {
    key: 'post',
    title: '岗位管理',
    desc: '企业职位体系与岗位人员配置',
    path: '/system/post',
    icon: 'TeamOutlined',
    gradientClass: 'from-amber-500 to-amber-700',
  },
  {
    key: 'file',
    title: '文件中心',
    desc: '系统公共资源与媒体存储管理',
    path: '/system/file',
    icon: 'FolderOutlined',
    gradientClass: 'from-cyan-500 to-cyan-700',
  },
  {
    key: 'log',
    title: '审计日志',
    desc: '用户操作行为追踪与安全分析',
    path: '/system/log',
    icon: 'AuditOutlined',
    gradientClass: 'from-slate-500 to-slate-700',
  },
  {
    key: 'notice',
    title: '通知公告',
    desc: '平台通知发布与受众推送管理',
    path: '/system/notice',
    icon: 'NotificationOutlined',
    gradientClass: 'from-rose-500 to-rose-700',
  },
]

async function loadData() {
  loading.value = true
  try {
    overview.value = await fetchDashboardOverview()
  } catch {
    // Graceful fallback for mock / initial state
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

function navigateTo(path: string) {
  void router.push(path)
}

function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getMonth() + 1}/${d.getDate()}`
}

onMounted(() => {
  void loadData()
  void loadNotices()
})
</script>

<template>
  <div class="launchpad-workbench">
    <!-- 顶部问候 Banner -->
    <div class="hero-banner">
      <div class="hero-content">
        <div class="hero-avatar-box">
          <Avatar :size="64" :src="avatarSrc" class="hero-avatar">
            <template v-if="!avatarSrc" #icon>
              <UserOutlined />
            </template>
          </Avatar>
          <div class="online-indicator" title="Online" />
        </div>

        <div class="hero-text">
          <div class="greeting-row">
            <h1 class="greeting-title">{{ greetingText }}，{{ displayName }}</h1>
            <Tag color="blue" class="status-tag">
              <CheckCircleFilled class="status-icon" />
              {{ t('home.systemOnline') }}
            </Tag>
          </div>
          <p class="greeting-sub">
            {{ t('home.greetingSubtitle') }}
          </p>
          <div class="hero-meta-badges">
            <span class="meta-badge">
              <span class="meta-badge-label">{{ t('home.accountSet') }}:</span>
              <strong class="meta-badge-val">{{ currentAccountSetName }}</strong>
            </span>
            <span class="meta-badge-divider">•</span>
            <span class="meta-badge">
              <span class="meta-badge-label">{{ t('dashboard.todayOperationCount') }}:</span>
              <strong class="meta-badge-val">{{ overview?.todayOperationCount ?? 0 }}</strong>
            </span>
            <span class="meta-badge-divider">•</span>
            <span class="meta-badge">
              <span class="meta-badge-label">{{ t('dashboard.successRate') }}:</span>
              <strong class="meta-badge-val text-green-600">{{ successRate }}%</strong>
            </span>
          </div>
        </div>
      </div>

      <div class="hero-actions">
        <Button :loading="loading" class="refresh-hero-btn" @click="loadData">
          <ReloadOutlined />
          {{ t('dashboard.refresh') }}
        </Button>
      </div>
    </div>

    <!-- 核心应用启动台矩阵 -->
    <div class="section-container">
      <div class="section-header">
        <div class="section-title-wrap">
          <div class="section-icon-dot bg-blue-500" />
          <h2 class="section-title">{{ t('home.launchpadTitle') }}</h2>
          <span class="section-subtitle">{{ t('home.launchpadSubtitle') }}</span>
        </div>
      </div>

      <div class="launchpad-grid">
        <div
          v-for="app in launchpadApps"
          :key="app.key"
          class="launchpad-card"
          @click="navigateTo(app.path)"
        >
          <div class="launchpad-icon-wrap bg-gradient-to-br" :class="app.gradientClass">
            <MenuIcon :icon="app.icon" class="launchpad-icon" />
          </div>

          <div class="launchpad-info">
            <div class="launchpad-app-title">{{ app.title }}</div>
            <div class="launchpad-app-desc">{{ app.desc }}</div>
          </div>

          <div class="launchpad-arrow">
            <ArrowRightOutlined />
          </div>
        </div>
      </div>
    </div>

    <!-- 下半部分：双栏工作台布局 -->
    <Row :gutter="[20, 20]" class="workbench-row">
      <!-- 左侧 2/3：核心数据指标与快捷操作 -->
      <Col :xs="24" :lg="16" class="workbench-col">
        <!-- 数据概览 -->
        <Card variant="borderless" class="workbench-card">
          <template #title>
            <div class="card-title-box">
              <RocketFilled class="card-title-icon text-blue-500" />
              <span>{{ t('home.statsTitle') }}</span>
            </div>
          </template>

          <Row :gutter="[16, 16]" class="stats-matrix">
            <Col :xs="12" :sm="8">
              <div class="metric-item">
                <Statistic
                  :title="t('dashboard.userCount')"
                  :value="overview?.userCount ?? 0"
                  class="metric-stat"
                />
                <span class="metric-sub"
                  >{{ t('dashboard.enabledUserCount') }}:
                  {{ overview?.enabledUserCount ?? 0 }}</span
                >
              </div>
            </Col>
            <Col :xs="12" :sm="8">
              <div class="metric-item">
                <Statistic
                  :title="t('dashboard.deptCount')"
                  :value="overview?.deptCount ?? 0"
                  class="metric-stat"
                />
                <span class="metric-sub">组织部门节点</span>
              </div>
            </Col>
            <Col :xs="12" :sm="8">
              <div class="metric-item">
                <Statistic
                  :title="t('dashboard.roleCount')"
                  :value="overview?.roleCount ?? 0"
                  class="metric-stat"
                />
                <span class="metric-sub">权限分配角色</span>
              </div>
            </Col>
            <Col :xs="12" :sm="8">
              <div class="metric-item">
                <Statistic
                  :title="t('dashboard.fileCount')"
                  :value="overview?.fileCount ?? 0"
                  class="metric-stat"
                />
                <span class="metric-sub">存储资源对象</span>
              </div>
            </Col>
            <Col :xs="12" :sm="8">
              <div class="metric-item">
                <Statistic
                  :title="t('dashboard.todayOperationCount')"
                  :value="overview?.todayOperationCount ?? 0"
                  class="metric-stat"
                />
                <span class="metric-sub">今日平台请求</span>
              </div>
            </Col>
            <Col :xs="12" :sm="8">
              <div class="metric-item">
                <Statistic
                  :title="t('dashboard.successRate')"
                  :value="successRate"
                  suffix="%"
                  class="metric-stat"
                  :value-style="{ color: '#10b981' }"
                />
                <span class="metric-sub">服务稳定性</span>
              </div>
            </Col>
          </Row>
        </Card>

        <!-- 高频快捷操作 -->
        <Card variant="borderless" class="workbench-card">
          <template #title>
            <div class="card-title-box">
              <ThunderboltFilled class="card-title-icon text-amber-500" />
              <span>{{ t('home.quickActionsTitle') }}</span>
            </div>
          </template>

          <div class="quick-actions-bar">
            <Button class="quick-action-btn" @click="navigateTo('/system/user')">
              <UserAddOutlined class="quick-btn-icon text-blue-500" />
              <span>{{ t('home.createUser') }}</span>
            </Button>

            <Button class="quick-action-btn" @click="navigateTo('/system/dept')">
              <PlusOutlined class="quick-btn-icon text-purple-500" />
              <span>{{ t('home.createDept') }}</span>
            </Button>

            <Button class="quick-action-btn" @click="navigateTo('/system/notice')">
              <NotificationOutlined class="quick-btn-icon text-rose-500" />
              <span>{{ t('home.publishNotice') }}</span>
            </Button>

            <Button class="quick-action-btn" @click="navigateTo('/system/log')">
              <AuditOutlined class="quick-btn-icon text-slate-500" />
              <span>{{ t('home.viewLogs') }}</span>
            </Button>

            <Button class="quick-action-btn" @click="navigateTo('/system/config')">
              <SettingOutlined class="quick-btn-icon text-indigo-500" />
              <span>系统参数配置</span>
            </Button>
          </div>
        </Card>
      </Col>

      <!-- 右侧 1/3：最新公告与系统环境 -->
      <Col :xs="24" :lg="8" class="workbench-col">
        <!-- 最新公告 -->
        <Card variant="borderless" class="workbench-card">
          <template #title>
            <div class="card-title-box">
              <NotificationOutlined class="card-title-icon text-rose-500" />
              <span>{{ t('home.noticesTitle') }}</span>
            </div>
          </template>
          <template #extra>
            <Button type="link" size="small" @click="navigateTo('/system/notice')">
              {{ t('home.viewAllNotices') }}
            </Button>
          </template>

          <div v-if="noticesLoading" class="p-2">
            <Skeleton active :paragraph="{ rows: 3 }" />
          </div>

          <div v-else-if="notices.length > 0" class="notices-list">
            <div
              v-for="item in notices"
              :key="item.id"
              class="notice-list-item"
              @click="navigateTo('/system/notice')"
            >
              <div class="notice-item-prefix">
                <FileTextOutlined class="text-rose-400" />
              </div>
              <div class="notice-item-main">
                <span class="notice-item-title">{{ item.title }}</span>
                <span class="notice-item-date">{{
                  formatDate(item.publishedAt || item.createdAt)
                }}</span>
              </div>
            </div>
          </div>

          <div v-else class="empty-notice-box">
            <span class="text-gray-400 text-sm">{{ t('home.noNotices') }}</span>
          </div>
        </Card>

        <!-- 系统环境与技术栈 -->
        <Card variant="borderless" class="workbench-card">
          <template #title>
            <div class="card-title-box">
              <SettingOutlined class="card-title-icon text-indigo-500" />
              <span>{{ t('home.techInfoTitle') }}</span>
            </div>
          </template>

          <div class="tech-stack-list">
            <div class="tech-row">
              <span class="tech-label">前端框架</span>
              <Tag color="cyan">Vue 3.6 + TypeScript 6.0</Tag>
            </div>
            <div class="tech-row">
              <span class="tech-label">UI 组件库</span>
              <Tag color="geekblue">Antdv-Next</Tag>
            </div>
            <div class="tech-row">
              <span class="tech-label">样式方案</span>
              <Tag color="purple">SCSS + Tailwind CSS</Tag>
            </div>
            <div class="tech-row">
              <span class="tech-label">请求与状态</span>
              <Tag color="orange">Alova + Pinia</Tag>
            </div>
          </div>
        </Card>
      </Col>
    </Row>
  </div>
</template>

<style scoped lang="scss">
.launchpad-workbench {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 1440px;
  margin: 0 auto;
}

/* 顶部问候 Banner */
.hero-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 28px;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 4%);
}

.hero-content {
  display: flex;
  align-items: center;
  gap: 20px;
  min-width: 0;
}

.hero-avatar-box {
  position: relative;
  flex-shrink: 0;
}

.hero-avatar {
  background-color: var(--app-color-primary, #409eff);
  box-shadow: 0 4px 12px rgb(59 130 246 / 20%);
}

.online-indicator {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 14px;
  height: 14px;
  background-color: #10b981;
  border: 2px solid #ffffff;
  border-radius: 50%;
}

.hero-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.greeting-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.greeting-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #111827;
  letter-spacing: -0.01em;
}

.status-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-radius: 9999px;
  padding: 1px 10px;
  font-size: 12px;
}

.status-icon {
  font-size: 12px;
}

.greeting-sub {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
}

.hero-meta-badges {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  font-size: 12px;
  color: #4b5563;
}

.meta-badge-divider {
  color: #d1d5db;
}

.meta-badge-val {
  margin-left: 4px;
  color: #111827;
}

.refresh-hero-btn {
  border-radius: 8px;
  color: #4b5563;
}

/* 启动台区域 */
.section-container {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-icon-dot {
  width: 6px;
  height: 18px;
  border-radius: 3px;
}

.section-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #111827;
}

.section-subtitle {
  font-size: 13px;
  color: #9ca3af;
  margin-left: 6px;
}

.launchpad-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

.launchpad-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  background-color: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  cursor: pointer;
  box-shadow: 0 1px 2px rgb(0 0 0 / 3%);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 20px -6px rgb(0 0 0 / 8%);
    border-color: color-mix(in srgb, var(--app-color-primary, #409eff) 40%, #e5e7eb);

    .launchpad-arrow {
      opacity: 1;
      transform: translateX(0);
      color: var(--app-color-primary, #409eff);
    }
  }
}

.launchpad-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  color: #ffffff;
  font-size: 20px;
  flex-shrink: 0;
  box-shadow: 0 4px 10px rgb(0 0 0 / 12%);
}

.launchpad-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.launchpad-app-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
  line-height: 1.3;
}

.launchpad-app-desc {
  font-size: 12px;
  color: #9ca3af;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.launchpad-arrow {
  font-size: 14px;
  color: #9ca3af;
  opacity: 0;
  transform: translateX(-4px);
  transition: all 0.2s ease;
  flex-shrink: 0;
}

/* 工作台双栏卡片 */
.workbench-col {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.workbench-card {
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 4%);
}

.card-title-box {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}

.card-title-icon {
  font-size: 16px;
}

/* 指标卡矩阵 */
.stats-matrix {
  margin: 0 !important;
}

.metric-item {
  display: flex;
  flex-direction: column;
  padding: 12px 14px;
  background-color: #f9fafb;
  border-radius: 8px;
  border: 1px solid #f3f4f6;
}

.metric-stat :deep(.ant-statistic-title) {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 2px;
}

.metric-stat :deep(.ant-statistic-content-value) {
  font-size: 22px;
  font-weight: 700;
}

.metric-sub {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 4px;
}

/* 快捷操作 */
.quick-actions-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.quick-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 38px;
  padding: 0 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  background-color: #f9fafb;
  border-color: #e5e7eb;

  &:hover {
    color: var(--app-color-primary, #409eff);
    border-color: var(--app-color-primary, #409eff);
    background-color: color-mix(in srgb, var(--app-color-primary, #409eff) 6%, #ffffff);
  }
}

.quick-btn-icon {
  font-size: 14px;
}

/* 公告列表 */
.notices-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.notice-list-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s ease;

  &:hover {
    background-color: #f3f4f6;

    .notice-item-title {
      color: var(--app-color-primary, #409eff);
    }
  }
}

.notice-item-prefix {
  font-size: 14px;
  flex-shrink: 0;
}

.notice-item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.notice-item-title {
  font-size: 13px;
  color: #374151;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notice-item-date {
  font-size: 11px;
  color: #9ca3af;
  flex-shrink: 0;
}

.empty-notice-box {
  padding: 24px 0;
  text-align: center;
}

/* 系统技术栈卡片 */
.tech-stack-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tech-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}

.tech-label {
  color: #6b7280;
}

@media (width <= 768px) {
  .hero-banner {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .launchpad-grid {
    grid-template-columns: 1fr;
  }
}
</style>
