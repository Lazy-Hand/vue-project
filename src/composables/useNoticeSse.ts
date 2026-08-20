import { watch, onScopeDispose } from 'vue'

import { refreshAuth } from '@/api/auth'
import { pinia } from '@/stores'
import { useAuthStore } from '@/stores/auth'
import type { NoticeSseMessage } from '@/types/notice'
import { API_BASE_URL } from '@/utils/request'

export interface NoticeSseHandlers {
  /** 新公告发布（对所有用户广播） */
  onPublished?: (message: Extract<NoticeSseMessage, { type: 'notice:published' }>) => void
  /** 我方单条公告已读（跨标签页/设备同步） */
  onRead?: (message: Extract<NoticeSseMessage, { type: 'notice:read' }>) => void
  /** 我方全部公告已读（跨标签页/设备同步） */
  onReadAll?: (message: Extract<NoticeSseMessage, { type: 'notice:read-all' }>) => void
  /** 新待办（定向推送给候选人） */
  onApprovalTodo?: (message: Extract<NoticeSseMessage, { type: 'approval:todo' }>) => void
  /** 待办刷新（处理后同步待办/已办） */
  onApprovalTodoRefresh?: (
    message: Extract<NoticeSseMessage, { type: 'approval:todo-refresh' }>,
  ) => void
}

const RECONNECT_BASE_DELAY_MS = 1_000
const RECONNECT_MAX_DELAY_MS = 30_000

function isNoticeSseMessage(value: unknown): value is NoticeSseMessage {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>

  switch (record.type) {
    case 'connected':
    case 'heartbeat':
      return true
    case 'notice:published':
      return typeof record.id === 'string' && typeof record.title === 'string'
    case 'notice:read':
      return typeof record.id === 'string' && typeof record.unreadCount === 'number'
    case 'notice:read-all':
      return typeof record.unreadCount === 'number'
    case 'approval:todo':
      return (
        typeof record.instanceId === 'string' &&
        typeof record.title === 'string' &&
        typeof record.definitionId === 'string'
      )
    case 'approval:todo-refresh':
      return typeof record.instanceId === 'string'
    default:
      return false
  }
}

/**
 * 订阅公告实时事件流（`GET /notice/events?access_token=`）。
 *
 * 浏览器 EventSource 无法携带请求头，访问令牌经查询参数传递；连接建立、心跳保活、
 * 令牌过期后的 cookie 刷新与断线退避重连都在此内部处理。`notice:published` 广播给
 * 所有在线用户，`notice:read` / `notice:read-all` 仅推送给当前用户（多端已读同步）。
 *
 * 以 `onScopeDispose` 收尾，组件卸载或 `effectScope` 停止时自动断开连接。
 */
export function useNoticeSse(handlers: NoticeSseHandlers = {}): void {
  const authStore = useAuthStore(pinia)
  let eventSource: EventSource | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let reconnectAttempts = 0

  function disposeSource(): void {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    eventSource?.close()
    eventSource = null
  }

  function dispatchEvent(payload: unknown): void {
    if (!isNoticeSseMessage(payload)) return

    switch (payload.type) {
      case 'notice:published':
        handlers.onPublished?.(payload)
        break
      case 'notice:read':
        handlers.onRead?.(payload)
        break
      case 'notice:read-all':
        handlers.onReadAll?.(payload)
        break
      case 'approval:todo':
        handlers.onApprovalTodo?.(payload)
        break
      case 'approval:todo-refresh':
        handlers.onApprovalTodoRefresh?.(payload)
        break
      default:
        // connected / heartbeat 仅用于握手与保活
        break
    }
  }

  function connect(): void {
    const token = authStore.accessToken
    if (!token) return

    const url = `${API_BASE_URL}/notice/events?access_token=${encodeURIComponent(token)}`
    // 幂等：同一令牌已连接时不重建（令牌变化由下方 watch 以新 URL 触发重建）
    if (eventSource?.url === url) return

    disposeSource()
    const source = new EventSource(url)
    source.addEventListener('notice', (event) => {
      try {
        dispatchEvent(JSON.parse((event as MessageEvent).data))
      } catch {
        // 忽略无法解析的消息
      }
    })
    source.onopen = () => {
      reconnectAttempts = 0
    }
    source.onerror = () => {
      // 关闭内建自动重连，改用带退避与令牌刷新的手动重连
      if (eventSource === source) {
        eventSource = null
      }
      source.close()
      scheduleReconnect()
    }
    eventSource = source
  }

  function scheduleReconnect(): void {
    if (!authStore.accessToken || reconnectTimer) return

    const delay = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** reconnectAttempts, RECONNECT_MAX_DELAY_MS)
    reconnectAttempts += 1
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      void refreshThenConnect()
    }, delay)
  }

  async function refreshThenConnect(): Promise<void> {
    try {
      if (authStore.isAccessTokenExpired()) {
        await refreshAuth()
      }
      connect()
    } catch {
      // 刷新失败（如 refresh token 已过期）：保持断开，等待 store 令牌变化或重新登录
    }
  }

  watch(
    () => authStore.accessToken,
    (token) => {
      if (token) {
        connect()
      } else {
        disposeSource()
      }
    },
    { immediate: true },
  )

  onScopeDispose(disposeSource)
}
