import type { PaginationQuery } from './common'

export type JobStatus = 'ENABLED' | 'DISABLED' | 'COMPLETED'
export type MisfirePolicy = 'DEFAULT' | 'IGNORE' | 'FIRE_ONCE'
export type JobLogStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED'

export interface Job {
  id: string
  jobName: string
  jobGroup: string
  invokeTarget: string
  cronExpression: string | null
  /** 一次性执行时间（与 cronExpression 二选一） */
  runAt: string | null
  misfirePolicy: MisfirePolicy
  concurrent: boolean
  status: JobStatus
  args: string | null
  remark: string | null
  createdAt: string
  updatedAt: string
}

export interface JobQuery extends PaginationQuery {
  jobName?: string
  jobGroup?: string
  status?: JobStatus
}

export interface CreateJobPayload {
  jobName: string
  jobGroup?: string
  invokeTarget: string
  cronExpression?: string
  runAt?: string
  misfirePolicy?: MisfirePolicy
  concurrent?: boolean
  status?: JobStatus
  args?: string
  remark?: string
}

export interface UpdateJobPayload {
  jobName?: string
  jobGroup?: string
  invokeTarget?: string
  cronExpression?: string
  runAt?: string | null
  misfirePolicy?: MisfirePolicy
  concurrent?: boolean
  status?: JobStatus
  args?: string
  remark?: string
}

export interface ChangeJobStatusPayload {
  status: JobStatus
}

export interface JobHandlerOption {
  name: string
  label: string
  description: string
  defaultArgs?: string
}

export interface JobLog {
  id: string
  jobId: string | null
  jobName: string
  jobGroup: string | null
  invokeTarget: string | null
  args: string | null
  status: JobLogStatus
  message: string | null
  exceptionInfo: string | null
  durationMs: number | null
  triggeredBy: string | null
  createdAt: string
}

export interface JobLogQuery extends PaginationQuery {
  jobId?: string
  jobName?: string
  jobGroup?: string
  status?: JobLogStatus
  startTime?: string
  endTime?: string
}

export interface CleanJobLogResult {
  count: number
}
