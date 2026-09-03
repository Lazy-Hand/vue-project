<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Badge, Button, Empty, Modal, Popover, Spin, Tabs, Tag, message } from 'antdv-next'
import { BellOutlined } from '@antdv-next/icons'

import { fetchTodoList } from '@/api/approval'
import {
  fetchPublishedNotices,
  fetchUnreadNoticeCount,
  markAllNoticesRead,
  markNoticeRead,
} from '@/api/notice'
import { useNoticeSse } from '@/composables/useNoticeSse'
import type { PublishedNotice } from '@/types/notice'
import { ApiRequestError } from '@/utils/request'

const router = useRouter()
const { locale, t } = useI18n()

const activeTab = ref<'notice' | 'todo'>('notice')
const panelOpen = ref(false)
const loading = ref(false)
const notices = ref<PublishedNotice[]>([])
const unreadCount = ref(0)
const detailVisible = ref(false)
const detailNotice = ref<PublishedNotice | null>(null)

const todoLoading = ref(false)
const todoItems = ref<{ id: string; title: string; status: string; createdAt: string }[]>([])
const todoTotal = ref(0)

const hasUnread = computed(() => notices.value.some((item) => !item.read))

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message
  if (error instanceof Error) return error.message
  return t('notice.requestFailed')
}

function formatDateTime(value: string | null): string {
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

async function refreshUnreadCount(): Promise<void> {
  try {
    const result = await fetchUnreadNoticeCount()
    unreadCount.value = result.count
  } catch (error) {
    message.error(errorMessage(error))
  }
}

async function loadNotices(): Promise<void> {
  loading.value = true
  try {
    const result = await fetchPublishedNotices({ page: 1, pageSize: 10 })
    notices.value = result.items
  } catch (error) {
    message.error(errorMessage(error))
  } finally {
    loading.value = false
  }
}

async function loadTodo(): Promise<void> {
  todoLoading.value = true
  try {
    const result = await fetchTodoList({ page: 1, pageSize: 8 })
    todoItems.value = (result.items ?? []).map((item) => ({
      id: item.instance.id,
      title: item.instance.title,
      status: item.instance.status,
      createdAt: item.instance.createdAt,
    }))
    todoTotal.value = result.total
  } catch (error) {
    message.error(errorMessage(error))
  } finally {
    todoLoading.value = false
  }
}

async function handleOpenChange(open: boolean): Promise<void> {
  if (!open) return
  await Promise.all([refreshUnreadCount(), loadNotices(), loadTodo()])
}

function handleTodoClick(id: string): void {
  panelOpen.value = false
  void router.push('/approval/todo')
  void id
}

function handleViewAllTodo(): void {
  panelOpen.value = false
  void router.push('/approval/todo')
}

function handleViewAllNotices(): void {
  panelOpen.value = false
  void router.push('/system/notice')
}

async function handleItemClick(item: PublishedNotice): Promise<void> {
  detailNotice.value = item
  detailVisible.value = true
  if (item.read) return

  try {
    await markNoticeRead(item.id)
    item.read = true
    unreadCount.value = Math.max(0, unreadCount.value - 1)
  } catch (error) {
    message.error(errorMessage(error))
  }
}

async function handleMarkAllRead(): Promise<void> {
  try {
    await markAllNoticesRead()
    notices.value.forEach((item) => {
      item.read = true
    })
    unreadCount.value = 0
    message.success(t('notice.readAllSuccess'))
  } catch (error) {
    message.error(errorMessage(error))
  }
}

useNoticeSse({
  onPublished: () => {
    void refreshUnreadCount()
    if (panelOpen.value) {
      void loadNotices()
    }
  },
  onRead: ({ id, unreadCount: count }) => {
    unreadCount.value = count
    const item = notices.value.find((notice) => notice.id === id)
    if (item) {
      item.read = true
    }
    if (detailNotice.value?.id === id) {
      detailNotice.value.read = true
    }
  },
  onReadAll: ({ unreadCount: count }) => {
    unreadCount.value = count
    notices.value.forEach((notice) => {
      notice.read = true
    })
  },
  onApprovalTodo: () => {
    void loadTodo()
  },
  onApprovalTodoRefresh: () => {
    void loadTodo()
  },
})

onMounted(async () => {
  await Promise.all([refreshUnreadCount(), loadTodo()])
})
</script>

<template>
  <div class="notice-bell">
    <Popover
      v-model:open="panelOpen"
      trigger="click"
      placement="bottomRight"
      destroy-on-hidden
      @open-change="handleOpenChange"
    >
      <Badge
        :count="unreadCount + todoTotal"
        :max="99"
        size="small"
        :offset="[2, 2]"
        :title="t('notice.notifications')"
      >
        <Button type="text" class="notice-bell__trigger" :aria-label="t('notice.notifications')">
          <BellOutlined class="notice-bell__icon" />
        </Button>
      </Badge>

      <template #content>
        <div class="notice-bell__panel">
          <Tabs
            v-model:active-key="activeTab"
            size="small"
            class="notice-bell__tabs"
            :items="[
              { key: 'notice', label: t('notice.notifications') },
              { key: 'todo', label: `${t('approval.instance.todoTitle')} (${todoTotal})` },
            ]"
          />

          <template v-if="activeTab === 'notice'">
            <div class="notice-bell__header">
              <span class="notice-bell__title">{{ t('notice.notifications') }}</span>
              <Button
                v-if="hasUnread"
                type="link"
                size="small"
                class="notice-bell__mark-all"
                @click="handleMarkAllRead"
              >
                {{ t('notice.markAllRead') }}
              </Button>
            </div>

            <Spin :spinning="loading">
              <div v-if="notices.length" class="notice-bell__list">
                <div
                  v-for="item in notices"
                  :key="item.id"
                  class="notice-bell__item"
                  :class="{ 'notice-bell__item--unread': !item.read }"
                  @click="handleItemClick(item)"
                >
                  <span v-if="!item.read" class="notice-bell__dot" />
                  <div class="notice-bell__item-body">
                    <div class="notice-bell__item-title">{{ item.title }}</div>
                    <div class="notice-bell__item-time">{{ formatDateTime(item.publishedAt) }}</div>
                  </div>
                </div>
              </div>
              <div v-else-if="!loading" class="notice-bell__empty">
                <Empty :description="t('notice.empty')" :image="Empty.PRESENTED_IMAGE_SIMPLE" />
              </div>
            </Spin>

            <div class="notice-bell__footer">
              <Button type="link" size="small" @click="handleViewAllNotices">{{
                t('home.viewAllNotices')
              }}</Button>
            </div>
          </template>

          <template v-else>
            <Spin :spinning="todoLoading">
              <div v-if="todoItems.length" class="notice-bell__list">
                <div
                  v-for="item in todoItems"
                  :key="item.id"
                  class="notice-bell__item"
                  @click="handleTodoClick(item.id)"
                >
                  <div class="notice-bell__item-body">
                    <div class="notice-bell__item-title">{{ item.title }}</div>
                    <div class="notice-bell__item-time flex items-center gap-1.5">
                      <Tag color="processing" class="m-0 text-xs leading-none">{{
                        item.status
                      }}</Tag>
                      <span>{{ formatDateTime(item.createdAt) }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else-if="!todoLoading" class="notice-bell__empty">
                <Empty
                  :description="t('approval.instance.noTasks')"
                  :image="Empty.PRESENTED_IMAGE_SIMPLE"
                />
              </div>
            </Spin>
            <div class="notice-bell__footer">
              <Button type="link" size="small" @click="handleViewAllTodo"
                >{{ t('approval.instance.todoTitle') }} →</Button
              >
            </div>
          </template>
        </div>
      </template>
    </Popover>

    <Modal
      v-model:open="detailVisible"
      :title="t('notice.detailTitle')"
      width="640px"
      destroy-on-hidden
      :get-container="false"
      :footer="null"
    >
      <div v-if="detailNotice" class="notice-bell__detail">
        <div class="notice-bell__detail-meta">
          {{ formatDateTime(detailNotice.publishedAt) }}
        </div>
        <pre class="notice-bell__detail-content">{{ detailNotice.content }}</pre>
      </div>
    </Modal>
  </div>
</template>

<style scoped lang="scss">
.notice-bell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 34px;
  line-height: 1;

  :deep(.ant-badge) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 34px;
    line-height: 1;
  }
}

.notice-bell__trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border-radius: 6px;
  color: #4b5563;
  font-size: 16px;
  line-height: 1;
  transition: all 0.2s ease;

  &:hover {
    color: var(--app-color-primary, #409eff);
    background-color: #f3f4f6;
  }
}

.notice-bell__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  line-height: 1;
}

.notice-bell__panel {
  width: 340px;
}

.notice-bell__tabs {
  :deep(.ant-tabs-nav) {
    margin: 0 0 8px 0;
  }
}

.notice-bell__footer {
  display: flex;
  justify-content: center;
  padding-top: 8px;
  border-top: 1px solid #f0f0f0;
  margin-top: 8px;
}

.notice-bell__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0 4px;
}

.notice-bell__title {
  font-size: 14px;
  font-weight: 600;
}

.notice-bell__list {
  display: flex;
  flex-direction: column;
  max-height: 360px;
  overflow: auto;
}

.notice-bell__item {
  display: flex;
  gap: 8px;
  padding: 10px 8px;
  border-radius: 6px;
  cursor: pointer;

  &:hover {
    background: #f5f7fa;
  }
}

.notice-bell__item--unread .notice-bell__item-title {
  font-weight: 600;
}

.notice-bell__dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  margin-top: 6px;
  border-radius: 50%;
  background: #1677ff;
}

.notice-bell__item-body {
  flex: 1;
  min-width: 0;
}

.notice-bell__item-title {
  overflow: hidden;
  font-size: 13px;
  color: #1f2937;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notice-bell__item-time {
  margin-top: 2px;
  font-size: 12px;
  color: #9ca3af;
}

.notice-bell__empty {
  padding: 12px 0;
}

.notice-bell__detail-meta {
  margin-bottom: 8px;
  font-size: 12px;
  color: #9ca3af;
}

.notice-bell__detail-content {
  margin: 0;
  max-height: 360px;
  overflow: auto;
  padding: 8px 12px;
  font-size: 13px;
  line-height: 1.6;
  background: #fafafa;
  border-radius: 6px;
  white-space: pre-wrap;
  word-break: break-all;
}

html.dark {
  .notice-bell__item {
    &:hover {
      background: #262830;
    }
  }

  .notice-bell__item-title {
    color: #f1f5f9;
  }

  .notice-bell__detail-content {
    background: #18191e;
    color: #e2e8f0;
  }

  .notice-bell__footer {
    border-top: 1px solid #2a2c33;
  }

  .notice-bell__trigger {
    color: #94a3b8;

    &:hover {
      color: #ffffff;
      background-color: #262830;
    }
  }
}
</style>
