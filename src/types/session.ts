export interface OnlineSession {
  /** 会话 ID */
  sessionId: string
  /** 用户 ID；BigInt 以字符串返回 */
  userId: string
  /** 用户名（用户已删除时为 null） */
  username: string | null
  /** 用户昵称 */
  nickname: string | null
  /** 登录 IP */
  ip: string | null
  /** User-Agent */
  userAgent: string | null
  /** 登录时间 */
  loginAt: string | null
  /** 会话过期时间 */
  expiresAt: string | null
}

export interface OnlineSessionQuery {
  page?: number
  pageSize?: number
  /** 关键字，模糊匹配用户名或会话 ID */
  keyword?: string
}
