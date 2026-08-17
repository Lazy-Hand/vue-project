export interface DashboardOverview {
  /** 未删除用户数 */
  userCount: number
  /** 未删除且已启用的用户数 */
  enabledUserCount: number
  /** 未删除角色数 */
  roleCount: number
  /** 未删除部门数 */
  deptCount: number
  /** 未删除文件数 */
  fileCount: number
  /** UTC 今日操作数（包含 periodStart，不包含 periodEnd） */
  todayOperationCount: number
  /** UTC 今日失败操作数（包含 periodStart，不包含 periodEnd） */
  todayFailedOperationCount: number
  /** 统计周期开始时间（UTC，包含） */
  periodStart: string
  /** 统计周期结束时间（UTC，不包含） */
  periodEnd: string
}
