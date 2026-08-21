import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import * as clientApi from '@/api/client'
import * as projectApi from '@/api/project'
import * as userApi from '@/api/user'
import ProjectDetailReadonly from './ProjectDetailReadonly.vue'

vi.mock('@/api/client', () => ({
  fetchClients: vi.fn<(..._args: never[]) => unknown>(),
}))

vi.mock('@/api/project', () => ({
  fetchProjectDetail: vi.fn<(..._args: never[]) => unknown>(),
}))

vi.mock('@/api/user', () => ({
  fetchUserList: vi.fn<(..._args: never[]) => unknown>(),
}))

describe('ProjectDetailReadonly', () => {
  beforeEach(() => {
    window.matchMedia ??= (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    })
    vi.mocked(clientApi.fetchClients).mockRejectedValue(new Error('live client data disabled'))
    vi.mocked(projectApi.fetchProjectDetail).mockRejectedValue(
      new Error('live project data disabled'),
    )
    vi.mocked(userApi.fetchUserList).mockRejectedValue(new Error('live user data disabled'))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders the submitted snapshot without requesting live project data', async () => {
    const wrapper = mount(ProjectDetailReadonly, {
      props: {
        businessId: 'project-1',
        formData: {
          snapshotVersion: 1,
          approvalType: 'INITIATION',
          submittedAt: '2026-08-21T00:00:00.000Z',
          project: {
            id: 'project-1',
            code: 'PRJ-001',
            name: 'Snapshot project',
            clientId: 'client-1',
            managerId: 'manager-1',
            status: 'IN_PROGRESS',
            description: null,
            initiationApprovalStatus: 'APPROVED',
            closureApprovalStatus: null,
            contractAmount: '100',
            budgetedCost: '60',
            actualCost: '40',
            settlementStatus: 'UNSETTLED',
            startDate: null,
            endDate: null,
            actualEndDate: null,
            deptId: null,
            createdAt: '2026-08-20T00:00:00.000Z',
            updatedAt: '2026-08-21T00:00:00.000Z',
            client: { id: 'client-1', name: 'Snapshot client' },
            manager: {
              id: 'manager-1',
              username: 'snapshot-manager',
              nickname: 'Snapshot manager',
            },
            members: [
              {
                id: 'member-1',
                projectId: 'project-1',
                userId: 'current-user',
                role: 'DEV',
                joinedAt: '2026-08-20T00:00:00.000Z',
              },
            ],
            memberHistory: [
              {
                id: 'history-1',
                projectId: 'project-1',
                userId: 'history-user',
                role: 'TEST',
                joinedAt: '2026-08-01T00:00:00.000Z',
                leftAt: '2026-08-10T00:00:00.000Z',
              },
            ],
            stages: [
              {
                id: 'stage-1',
                projectId: 'project-1',
                name: 'Verification stage',
                sort: 1,
                status: 'COMPLETED',
                plannedStartAt: '2026-08-01T00:00:00.000Z',
                plannedEndAt: '2026-08-05T00:00:00.000Z',
                actualStartAt: '2026-08-02T00:00:00.000Z',
                actualEndAt: '2026-08-06T00:00:00.000Z',
                description: null,
                createdAt: '2026-08-01T00:00:00.000Z',
                updatedAt: '2026-08-06T00:00:00.000Z',
              },
            ],
            deliverables: [
              {
                id: 'deliverable-1',
                projectId: 'project-1',
                stageId: 'stage-1',
                name: 'Final report',
                fileId: 'file-2',
                file: {
                  id: 'file-2',
                  originalName: 'actual-deliverable.pdf',
                  path: 'uploads/actual-deliverable.pdf',
                },
                version: '1.0',
                status: 'SUBMITTED',
                description: null,
                createdAt: '2026-08-06T00:00:00.000Z',
                updatedAt: '2026-08-06T00:00:00.000Z',
              },
            ],
            attachments: [
              {
                id: 'file-1',
                originalName: 'snapshot-attachment.pdf',
                path: 'uploads/snapshot-attachment.pdf',
              },
            ],
          },
        },
      },
      global: { plugins: [i18n] },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('Snapshot project')
    expect(wrapper.text()).toContain('history-user')
    expect(wrapper.text()).toContain('actual-deliverable.pdf')
    expect(projectApi.fetchProjectDetail).not.toHaveBeenCalled()
    expect(clientApi.fetchClients).not.toHaveBeenCalled()
    expect(userApi.fetchUserList).not.toHaveBeenCalled()
  })

  it('uses the local fallback for an unsupported snapshot version', async () => {
    const wrapper = mount(ProjectDetailReadonly, {
      props: {
        businessId: 'project-1',
        formData: { snapshotVersion: 2 },
      },
      global: { plugins: [i18n] },
    })

    await flushPromises()

    expect(wrapper.text()).toContain(String(i18n.global.t('project.snapshotInvalid')))
    expect(projectApi.fetchProjectDetail).not.toHaveBeenCalled()
    expect(clientApi.fetchClients).not.toHaveBeenCalled()
    expect(userApi.fetchUserList).not.toHaveBeenCalled()
  })
})
