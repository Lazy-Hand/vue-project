import { beforeEach, describe, expect, it, vi } from 'vitest'

const requestMethods = vi.hoisted(() => ({
  get: vi.fn<(..._args: never[]) => unknown>(),
  post: vi.fn<(..._args: never[]) => unknown>(),
  patch: vi.fn<(..._args: never[]) => unknown>(),
  delete: vi.fn<(..._args: never[]) => unknown>(),
}))

vi.mock('@/utils/request', () => ({
  request: {
    Get: requestMethods.get,
    Post: requestMethods.post,
    Patch: requestMethods.patch,
    Delete: requestMethods.delete,
  },
}))

import {
  createProjectKnowledgeMaterial,
  createProjectKnowledgeQuestion,
  createProjectPrdDocumentVersion,
  createProjectRequirementEvidence,
  createProjectRequirementTrace,
  createProjectResearchRecord,
  deleteProjectPrdDocumentVersion,
  fetchProjectPrdDocumentVersions,
} from '@/api/project-knowledge'

describe('project knowledge API contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses the project knowledge prefix and the frozen material fields', async () => {
    requestMethods.post.mockResolvedValue({ id: 'material-1' })

    await createProjectKnowledgeMaterial('project/1', {
      title: 'Interview notes',
      type: 'INTERVIEW_NOTE',
      sourceUrl: 'https://example.com/interview',
      origin: 'MANUAL',
    })

    expect(requestMethods.post).toHaveBeenCalledWith(
      '/project/project%2F1/knowledge/materials',
      {
        title: 'Interview notes',
        type: 'INTERVIEW_NOTE',
        sourceUrl: 'https://example.com/interview',
        origin: 'MANUAL',
      },
      { cacheFor: 0 },
    )
  })

  it('keeps required research content, evidence foreign keys and trace keys', async () => {
    requestMethods.post.mockResolvedValue({ id: 'child-1' })

    await createProjectResearchRecord('project-1', {
      title: 'Customer call',
      content: 'Customer wants an export workflow.',
      origin: 'MANUAL',
    })
    await createProjectRequirementEvidence('project-1', 'requirement/1', {
      materialId: 'material-1',
      quote: 'Export is needed before launch.',
      origin: 'MANUAL',
    })
    await createProjectRequirementTrace('project-1', 'requirement-1', {
      targetType: 'TASK',
      targetKey: 'task-1',
      targetName: 'Implement export task',
      relationType: 'IMPLEMENTS',
      origin: 'MANUAL',
    })

    expect(requestMethods.post).toHaveBeenNthCalledWith(
      1,
      '/project/project-1/knowledge/research-records',
      {
        title: 'Customer call',
        content: 'Customer wants an export workflow.',
        origin: 'MANUAL',
      },
      { cacheFor: 0 },
    )
    expect(requestMethods.post).toHaveBeenNthCalledWith(
      2,
      '/project/project-1/knowledge/requirements/requirement%2F1/evidence',
      {
        materialId: 'material-1',
        quote: 'Export is needed before launch.',
        origin: 'MANUAL',
      },
      { cacheFor: 0 },
    )
    expect(requestMethods.post).toHaveBeenNthCalledWith(
      3,
      '/project/project-1/knowledge/requirements/requirement-1/traces',
      {
        targetType: 'TASK',
        targetKey: 'task-1',
        targetName: 'Implement export task',
        relationType: 'IMPLEMENTS',
        origin: 'MANUAL',
      },
      { cacheFor: 0 },
    )
  })

  it('requires question priority and leaves version numbering to the backend', async () => {
    requestMethods.post.mockResolvedValue({ id: 'record-1' })
    requestMethods.get.mockResolvedValue([])
    requestMethods.delete.mockResolvedValue(undefined)

    await createProjectKnowledgeQuestion('project-1', {
      question: 'Which export format is required?',
      priority: 'HIGH',
      status: 'OPEN',
      origin: 'MANUAL',
    })
    await createProjectPrdDocumentVersion('project-1', 'prd-1', {
      content: '# Export',
      changeSummary: 'Initial draft',
      status: 'DRAFT',
      origin: 'MANUAL',
    })
    await fetchProjectPrdDocumentVersions('project-1', 'prd-1')
    await deleteProjectPrdDocumentVersion('project-1', 'prd-1', 'version-1')

    expect(requestMethods.post).toHaveBeenNthCalledWith(
      1,
      '/project/project-1/knowledge/questions',
      {
        question: 'Which export format is required?',
        priority: 'HIGH',
        status: 'OPEN',
        origin: 'MANUAL',
      },
      { cacheFor: 0 },
    )
    expect(requestMethods.post).toHaveBeenNthCalledWith(
      2,
      '/project/project-1/knowledge/prd-documents/prd-1/versions',
      {
        content: '# Export',
        changeSummary: 'Initial draft',
        status: 'DRAFT',
        origin: 'MANUAL',
      },
      { cacheFor: 0 },
    )
    expect(requestMethods.get).toHaveBeenCalledWith(
      '/project/project-1/knowledge/prd-documents/prd-1/versions',
      { cacheFor: 0 },
    )
    expect(requestMethods.delete).toHaveBeenCalledWith(
      '/project/project-1/knowledge/prd-documents/prd-1/versions/version-1',
      {},
      { cacheFor: 0 },
    )
  })
})
