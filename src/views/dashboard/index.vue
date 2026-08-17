<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Card, Statistic, message } from 'antdv-next'
import { ReloadOutlined } from '@antdv-next/icons'

import { fetchDashboardOverview } from '@/api/dashboard'
import { usePermission } from '@/composables/usePermission'
import type { DashboardOverview } from '@/types/dashboard'
import { ApiRequestError } from '@/utils/request'

const { locale, t } = useI18n()
const { hasPermission } = usePermission()

const canQuery = computed(() => hasPermission('system:dashboard:query'))

const overview = ref<DashboardOverview | null>(null)
const loading = ref(false)

const successRate = computed<string>(() => {
  const total = overview.value?.todayOperationCount ?? 0
  if (total <= 0) return '-'
  const failed = overview.value?.todayFailedOperationCount ?? 0
  return (((total - failed) / total) * 100).toFixed(1)
})

function formatDateTime(value: string): string {
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
  } catch (error) {
    message.error(errorMessage(error))
  } finally {
    loading.value = false
  }
}

onMounted(loadOverview)
</script>

<template>
  <div class="dashboard-page">
    <div class="dashboard-page__header">
      <Button :loading="loading" :disabled="!canQuery" @click="loadOverview">
        <ReloadOutlined />
        {{ t('dashboard.refresh') }}
      </Button>
    </div>

    <div class="dashboard-page__cards">
      <Card class="dashboard-page__card">
        <Statistic :title="t('dashboard.userCount')" :value="overview?.userCount ?? '-'" />
      </Card>
      <Card class="dashboard-page__card">
        <Statistic
          :title="t('dashboard.enabledUserCount')"
          :value="overview?.enabledUserCount ?? '-'"
        />
      </Card>
      <Card class="dashboard-page__card">
        <Statistic :title="t('dashboard.roleCount')" :value="overview?.roleCount ?? '-'" />
      </Card>
      <Card class="dashboard-page__card">
        <Statistic :title="t('dashboard.deptCount')" :value="overview?.deptCount ?? '-'" />
      </Card>
      <Card class="dashboard-page__card">
        <Statistic :title="t('dashboard.fileCount')" :value="overview?.fileCount ?? '-'" />
      </Card>
      <Card class="dashboard-page__card">
        <Statistic
          :title="t('dashboard.todayOperationCount')"
          :value="overview?.todayOperationCount ?? '-'"
        />
      </Card>
      <Card class="dashboard-page__card">
        <Statistic
          :title="t('dashboard.todayFailedOperationCount')"
          :value="overview?.todayFailedOperationCount ?? '-'"
          :value-style="{ color: '#cf1322' }"
        />
      </Card>
      <Card class="dashboard-page__card">
        <Statistic
          :title="t('dashboard.successRate')"
          :value="successRate"
          suffix="%"
          :value-style="successRate === '-' ? undefined : { color: '#389e0d' }"
        />
      </Card>
    </div>

    <div v-if="overview" class="dashboard-page__period">
      {{ t('dashboard.periodLabel') }}：{{ formatDateTime(overview.periodStart) }} ~
      {{ formatDateTime(overview.periodEnd) }}
    </div>
  </div>
</template>

<style scoped lang="scss">
.dashboard-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dashboard-page__header {
  display: flex;
  justify-content: flex-end;
}

.dashboard-page__cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

.dashboard-page__period {
  font-size: 13px;
  color: #6b7280;
}
</style>
