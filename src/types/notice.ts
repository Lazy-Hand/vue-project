export type NoticeStatus = 'DRAFT' | 'PUBLISHED'

export interface Notice {
  /** 公告 ID；BigInt 以字符串返回 */
  id: string
  /** 公告标题 */
  title: string
  /** 公告正文 */
  content: string
  /** 公告状态 */
  status: NoticeStatus
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
