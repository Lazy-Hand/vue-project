export type NoticeStatus = 'DRAFT' | 'PUBLISHED'

/** 公告发布受众范围：全员 / 指定用户 / 按角色 / 按岗位 / 按部门（含下级部门） */
export type NoticeTargetScope = 'ALL' | 'USER' | 'ROLE' | 'POST' | 'DEPT'

/** 发布公告时的受众选择；targetScope 非 ALL 时需提供对应的 id 列表 */
export interface NoticeTargetPayload {
  targetScope?: NoticeTargetScope
  userIds?: string[]
  roleIds?: string[]
  postIds?: string[]
  deptIds?: string[]
}

export interface Notice {
  /** 公告 ID；BigInt 以字符串返回 */
  id: string
  /** 公告标题 */
  title: string
  /** 公告正文 */
  content: string
  /** 公告状态 */
  status: NoticeStatus
  /** 发布受众范围 */
  targetScope: NoticeTargetScope
  /** 发布时间；草稿为空 */
  publishedAt: string | null
  /** 创建时间 */
  createdAt: string
  /** 更新时间 */
  updatedAt: string
}

export interface NoticeQuery {
  page?: number
  pageSize?: number
  /** 关键字，模糊匹配标题或正文 */
  keyword?: string
  /** 公告状态；不传则查询全部状态 */
  status?: NoticeStatus
}

export interface NoticePayload {
  title: string
  content: string
}

export type UpdateNoticePayload = Partial<NoticePayload>

/** 已发布公告 + 当前用户已读状态（用户端通知列表） */
export interface PublishedNotice extends Notice {
  /** 当前用户是否已读 */
  read: boolean
}

/** 公告数量统计结果（未读数 / 本次标记已读条数） */
export interface NoticeCountResult {
  count: number
}

/** 公告 SSE 事件负载：后端 `event: notice` 下发的统一 JSON，按 `type` 判别。 */
export type NoticeSseMessage =
  | { type: 'connected' }
  | { type: 'heartbeat' }
  | {
      type: 'notice:published'
      id: string
      title: string
      publishedAt: string | null
    }
  /** 单条公告已读：id 为该公告，unreadCount 为我方最新未读数 */
  | { type: 'notice:read'; id: string; unreadCount: number }
  /** 全部公告已读：unreadCount 为我方最新未读数 */
  | { type: 'notice:read-all'; unreadCount: number }
