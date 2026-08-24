import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'

const requestMethods = vi.hoisted(() => ({
  get: vi.fn<(..._args: never[]) => unknown>(),
  post: vi.fn<(..._args: never[]) => unknown>(),
  patch: vi.fn<(..._args: never[]) => unknown>(),
  put: vi.fn<(..._args: never[]) => unknown>(),
  delete: vi.fn<(..._args: never[]) => unknown>(),
}))

vi.mock('@/utils/request', () => ({
  API_BASE_URL: '/api',
  request: {
    Get: requestMethods.get,
    Post: requestMethods.post,
    Patch: requestMethods.patch,
    Put: requestMethods.put,
    Delete: requestMethods.delete,
  },
}))

import { fetchFileList } from '@/api/file'
import { createProjectApproval, createProjectDeliverable, createProjectStage } from '@/api/project'
import {
  buildProjectApprovalPayload,
  getProjectApprovalType,
  type ProjectPayload,
  type UpdateProjectPayload,
} from '@/types/project'

describe('project workflow contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('switches the only approval entry by lifecycle status', () => {
    expect(getProjectApprovalType('DRAFT')).toBe('INITIATION')
    expect(getProjectApprovalType('IN_PROGRESS')).toBe('CLOSURE')
    expect(getProjectApprovalType('PENDING_INITIATION_APPROVAL')).toBeNull()
    expect(getProjectApprovalType('PENDING_CLOSURE_APPROVAL')).toBeNull()
    expect(getProjectApprovalType('COMPLETED')).toBeNull()
    expect(getProjectApprovalType('NOT_A_PROJECT_STATUS')).toBeNull()
  })

  it('keeps closure approval available after initiation approval succeeds', () => {
    const project = {
      status: 'IN_PROGRESS',
      initiationApprovalStatus: 'APPROVED',
      closureApprovalStatus: null,
    }

    expect(getProjectApprovalType(project.status)).toBe('CLOSURE')
  })

  it('submits the approval type without definition selection (B2-03)', async () => {
    requestMethods.post.mockResolvedValue({ approvalInstanceId: 'approval-1' })
    const payload = buildProjectApprovalPayload('INITIATION', '  Project  ')

    await createProjectApproval('project-1', payload)

    expect(payload).toEqual({
      approvalType: 'INITIATION',
      title: 'Project',
    })
    expect(requestMethods.post).toHaveBeenCalledWith('/project/project-1/approval', payload, {
      cacheFor: 0,
    })
  })

  it('uses the required business types and carries upload IDs into requests', async () => {
    requestMethods.get.mockResolvedValue({ items: [], total: 0 })
    requestMethods.post
      .mockResolvedValueOnce({ id: 'deliverable-1' })
      .mockResolvedValueOnce({ id: 'stage-1' })

    await fetchFileList({
      businessType: 'PROJECT_ATTACHMENT',
      businessId: 'project-1',
      page: 1,
      pageSize: 100,
    })
    await createProjectDeliverable('project-1', {
      name: 'Release PDF',
      fileId: 'uploaded-file-1',
    })
    await createProjectStage('project-1', {
      name: 'Delivery',
      actualStartAt: '2026-08-21T00:00:00.000Z',
      actualEndAt: '2026-08-22T00:00:00.000Z',
    })

    expect(requestMethods.get).toHaveBeenCalledWith('/file/list', {
      params: {
        page: 1,
        pageSize: 100,
        businessType: 'PROJECT_ATTACHMENT',
        businessId: 'project-1',
      },
      cacheFor: 0,
    })
    expect(requestMethods.post).toHaveBeenNthCalledWith(
      1,
      '/project/project-1/deliverables',
      { name: 'Release PDF', fileId: 'uploaded-file-1' },
      { cacheFor: 0 },
    )
    expect(requestMethods.post).toHaveBeenNthCalledWith(
      2,
      '/project/project-1/stages',
      {
        name: 'Delivery',
        actualStartAt: '2026-08-21T00:00:00.000Z',
        actualEndAt: '2026-08-22T00:00:00.000Z',
      },
      { cacheFor: 0 },
    )
  })

  it('keeps status out of ordinary updates and uses the semantic cost field', () => {
    expectTypeOf<UpdateProjectPayload>().not.toHaveProperty('status')
    expectTypeOf<ProjectPayload>().toHaveProperty('budgetedCost')
    expectTypeOf<ProjectPayload>().toHaveProperty('actualCost')
  })
})
