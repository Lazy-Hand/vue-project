import { effectScope, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { refreshAuth } from '@/api/auth'
import { pinia } from '@/stores'
import { useAuthStore } from '@/stores/auth'
import type { AuthTokenData } from '@/types/auth'
import type { NoticeSseMessage } from '@/types/notice'
import { useNoticeSse } from './useNoticeSse'

vi.mock('@/api/auth', () => ({
  refreshAuth: vi.fn<() => Promise<AuthTokenData>>(),
}))

const mockedRefreshAuth = vi.mocked(refreshAuth)

class FakeEventSource {
  static instances: FakeEventSource[] = []
  readonly url: string
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  private listeners = new Map<string, Set<(event: { data: string }) => void>>()

  constructor(url: string) {
    this.url = url
    FakeEventSource.instances.push(this)
  }

  addEventListener(type: string, listener: (event: { data: string }) => void): void {
    let set = this.listeners.get(type)
    if (!set) {
      set = new Set()
      this.listeners.set(type, set)
    }
    set.add(listener)
  }

  dispatch(type: string, raw: string): void {
    this.listeners.get(type)?.forEach((listener) => listener({ data: raw }))
  }

  close(): void {
    const index = FakeEventSource.instances.indexOf(this)
    if (index >= 0) {
      FakeEventSource.instances.splice(index, 1)
    }
  }
}

const authStore = useAuthStore(pinia)

function tokenData(accessToken: string, expiresIn = 7200): AuthTokenData {
  return {
    accessToken,
    tokenType: 'Bearer',
    expiresIn,
    user: {
      id: '1',
      username: 'admin',
      nickname: '管理员',
      email: null,
      phone: null,
      avatar: null,
      enabled: true,
    },
  }
}

function noticeMessage(type: NoticeSseMessage['type']): string {
  switch (type) {
    case 'notice:published':
      return JSON.stringify({ type, id: '1', title: '公告', publishedAt: null })
    case 'notice:read':
      return JSON.stringify({ type, id: '1', unreadCount: 3 })
    case 'notice:read-all':
      return JSON.stringify({ type, unreadCount: 0 })
    default:
      return JSON.stringify({ type })
  }
}

describe('useNoticeSse', () => {
  beforeEach(() => {
    authStore.clearSession()
    authStore.setSession(tokenData('first-token'))
    FakeEventSource.instances.length = 0
    mockedRefreshAuth.mockClear()
    vi.useFakeTimers()
    vi.stubGlobal('EventSource', FakeEventSource)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  function subscribe(handlers: { onPublished?: () => void } = {}) {
    const scope = effectScope()
    scope.run(() => useNoticeSse(handlers))
    return scope
  }

  it('connects with the current access token', () => {
    const scope = subscribe()

    expect(FakeEventSource.instances).toHaveLength(1)
    expect(FakeEventSource.instances[0]!.url).toContain('/notice/events?access_token=first-token')

    scope.stop()
    expect(FakeEventSource.instances).toHaveLength(0)
  })

  it('dispatches published, read and read-all events to their handlers', () => {
    const onPublished = vi.fn<() => void>()
    const onRead = vi.fn<() => void>()
    const onReadAll = vi.fn<() => void>()
    const scope = effectScope()
    scope.run(() => useNoticeSse({ onPublished, onRead, onReadAll }))

    const source = FakeEventSource.instances[0]!
    source.dispatch('notice', noticeMessage('notice:published'))
    source.dispatch('notice', noticeMessage('notice:read'))
    source.dispatch('notice', noticeMessage('notice:read-all'))

    expect(onPublished).toHaveBeenCalledWith({
      type: 'notice:published',
      id: '1',
      title: '公告',
      publishedAt: null,
    })
    expect(onRead).toHaveBeenCalledWith({ type: 'notice:read', id: '1', unreadCount: 3 })
    expect(onReadAll).toHaveBeenCalledWith({ type: 'notice:read-all', unreadCount: 0 })

    scope.stop()
  })

  it('ignores malformed, unknown and keep-alive messages', async () => {
    const onPublished = vi.fn<() => void>()
    const onRead = vi.fn<() => void>()
    const onReadAll = vi.fn<() => void>()
    const scope = effectScope()
    scope.run(() => useNoticeSse({ onPublished, onRead, onReadAll }))

    const source = FakeEventSource.instances[0]!
    source.dispatch('notice', 'not-json')
    source.dispatch('notice', JSON.stringify({ type: 'notice:published' }))
    source.dispatch('notice', JSON.stringify({ type: 'unknown', id: '1' }))
    source.dispatch('notice', noticeMessage('connected'))
    source.dispatch('notice', noticeMessage('heartbeat'))

    await nextTick()
    expect(onPublished).not.toHaveBeenCalled()
    expect(onRead).not.toHaveBeenCalled()
    expect(onReadAll).not.toHaveBeenCalled()

    scope.stop()
  })

  it('resubscribes with a backoff after a connection error', () => {
    const scope = subscribe()

    FakeEventSource.instances[0]!.onerror?.()
    expect(FakeEventSource.instances).toHaveLength(0)

    vi.advanceTimersByTime(1_000)
    expect(FakeEventSource.instances).toHaveLength(1)
    expect(FakeEventSource.instances[0]!.url).toContain('access_token=first-token')

    scope.stop()
  })

  it('refreshes the token before reconnecting once it has expired', async () => {
    authStore.clearSession()
    authStore.setSession(tokenData('expired-token', 0))
    mockedRefreshAuth.mockImplementationOnce(async (): Promise<AuthTokenData> => {
      const next = tokenData('refreshed-token')
      authStore.setSession(next)
      return next
    })
    const scope = subscribe()

    FakeEventSource.instances[0]!.onerror?.()
    vi.advanceTimersByTime(1_000)
    // 让 refreshAuth 的异步续体与 watch 冲刷完成
    await nextTick()
    await nextTick()

    expect(mockedRefreshAuth).toHaveBeenCalledTimes(1)
    const source = FakeEventSource.instances.at(-1)
    expect(source?.url).toContain('access_token=refreshed-token')

    scope.stop()
  })

  it('reconnects with the new token when the token changes', async () => {
    const scope = subscribe()
    expect(FakeEventSource.instances[0]!.url).toContain('access_token=first-token')

    authStore.setSession(tokenData('second-token'))
    await nextTick()

    expect(FakeEventSource.instances).toHaveLength(1)
    expect(FakeEventSource.instances[0]!.url).toContain('access_token=second-token')

    scope.stop()
  })
})
