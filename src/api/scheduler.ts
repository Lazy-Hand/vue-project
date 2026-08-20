import type { PaginatedResult } from '@/types/common'
import type {
  ChangeJobStatusPayload,
  CleanJobLogResult,
  CreateJobPayload,
  Job,
  JobHandlerOption,
  JobLog,
  JobLogQuery,
  JobQuery,
  JobStatus,
  UpdateJobPayload,
} from '@/types/scheduler'
import { request } from '@/utils/request'

function appendQueryParam(
  params: Record<string, string | number | boolean>,
  key: string,
  value: string | number | boolean | undefined,
): void {
  if (value !== undefined && value !== '') params[key] = value
}

// ================= 定时任务管理 =================

/** 获取系统可用的任务处理器列表 */
export function fetchJobHandlerOptions(): Promise<JobHandlerOption[]> {
  return request.Get<JobHandlerOption[]>('/scheduler/tasks/handlers', {
    cacheFor: 0,
  })
}

/** 分页查询定时任务列表 */
export function fetchJobList(query: JobQuery = {}): Promise<PaginatedResult<Job>> {
  const params: Record<string, string | number | boolean> = {
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 10,
  }
  appendQueryParam(params, 'jobName', query.jobName)
  appendQueryParam(params, 'jobGroup', query.jobGroup)
  appendQueryParam(params, 'status', query.status)

  return request.Get<PaginatedResult<Job>>('/scheduler/tasks', {
    params,
    cacheFor: 0,
  })
}

/** 获取单个定时任务详情 */
export function fetchJobDetail(id: string): Promise<Job> {
  return request.Get<Job>(`/scheduler/tasks/${id}`, { cacheFor: 0 })
}

/** 创建定时任务 */
export function createJob(payload: CreateJobPayload): Promise<Job> {
  return request.Post<Job>('/scheduler/tasks', payload, { cacheFor: 0 })
}

/** 更新定时任务 */
export function updateJob(id: string, payload: UpdateJobPayload): Promise<Job> {
  return request.Put<Job>(`/scheduler/tasks/${id}`, payload, { cacheFor: 0 })
}

/** 启停定时任务状态 */
export function changeJobStatus(id: string, status: JobStatus): Promise<Job> {
  return request.Patch<Job, ChangeJobStatusPayload>(
    `/scheduler/tasks/${id}/status`,
    { status },
    { cacheFor: 0 },
  )
}

/** 手动立即执行一次任务 */
export function runJobOnce(id: string): Promise<{ success: boolean }> {
  return request.Post<{ success: boolean }>(`/scheduler/tasks/${id}/run`, {}, { cacheFor: 0 })
}

/** 删除定时任务 */
export function deleteJob(id: string): Promise<{ success: boolean }> {
  return request.Delete<{ success: boolean }>(`/scheduler/tasks/${id}`, {}, { cacheFor: 0 })
}

// ================= 调度日志管理 =================

/** 分页查询调度执行日志 */
export function fetchJobLogList(query: JobLogQuery = {}): Promise<PaginatedResult<JobLog>> {
  const params: Record<string, string | number | boolean> = {
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 10,
  }
  appendQueryParam(params, 'jobId', query.jobId)
  appendQueryParam(params, 'jobName', query.jobName)
  appendQueryParam(params, 'jobGroup', query.jobGroup)
  appendQueryParam(params, 'status', query.status)
  appendQueryParam(params, 'startTime', query.startTime)
  appendQueryParam(params, 'endTime', query.endTime)

  return request.Get<PaginatedResult<JobLog>>('/scheduler/logs', {
    params,
    cacheFor: 0,
  })
}

/** 获取单条调度日志详情 */
export function fetchJobLogDetail(id: string): Promise<JobLog> {
  return request.Get<JobLog>(`/scheduler/logs/${id}`, { cacheFor: 0 })
}

/** 清理历史调度日志 */
export function cleanJobLogs(before?: string): Promise<CleanJobLogResult> {
  const params = before ? { before } : undefined
  return request.Delete<CleanJobLogResult>('/scheduler/logs/clean', {}, { params, cacheFor: 0 })
}

/** 删除单条调度日志 */
export function deleteJobLog(id: string): Promise<{ success: boolean }> {
  return request.Delete<{ success: boolean }>(`/scheduler/logs/${id}`, {}, { cacheFor: 0 })
}
