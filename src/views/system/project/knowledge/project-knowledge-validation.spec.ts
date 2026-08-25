import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ProjectRequirement } from '@/types/project-knowledge'

const apiMocks = vi.hoisted(() => {
  const requestMock = () => vi.fn<(..._args: unknown[]) => Promise<unknown>>()
  return {
    createProjectRequirement: requestMock(),
    deleteProjectRequirement: requestMock(),
    fetchProjectRequirements: requestMock(),
    updateProjectRequirement: requestMock(),
    createProjectRequirementEvidence: requestMock(),
    deleteProjectRequirementEvidence: requestMock(),
    fetchProjectKnowledgeMaterials: requestMock(),
    fetchProjectRequirementEvidence: requestMock(),
    fetchProjectRequirementTraces: requestMock(),
    fetchProjectResearchRecords: requestMock(),
    updateProjectRequirementEvidence: requestMock(),
    createProjectRequirementTrace: requestMock(),
    deleteProjectRequirementTrace: requestMock(),
    updateProjectRequirementTrace: requestMock(),
  }
})

const messageMocks = vi.hoisted(() => ({
  warning: vi.fn<(_content: string) => void>(),
  success: vi.fn<(_content: string) => void>(),
  error: vi.fn<(_content: string) => void>(),
}))

vi.mock('@/api/project-knowledge', () => apiMocks)
vi.mock('antdv-next', async () => {
  const actual = await vi.importActual<typeof import('antdv-next')>('antdv-next')
  return {
    ...actual,
    message: {
      ...actual.message,
      warning: messageMocks.warning,
      success: messageMocks.success,
      error: messageMocks.error,
    },
  }
})

import { i18n } from '@/i18n'
import ProjectKnowledgeRequirementsTab from './ProjectKnowledgeRequirementsTab.vue'
import ProjectKnowledgeTracesTab from './ProjectKnowledgeTracesTab.vue'
import ProjectRequirementDetailDrawer from './ProjectRequirementDetailDrawer.vue'

interface FormField {
  key: string
  required?: boolean
}

const requirement: ProjectRequirement = {
  id: 'requirement-1',
  projectId: 'project-1',
  code: 'REQ-001',
  title: 'Export records',
  type: 'FUNCTIONAL',
  priority: 'HIGH',
  status: 'DRAFT',
  description: null,
  content: 'Users can export records.',
  acceptanceCriteria: null,
  origin: 'MANUAL',
  aiRunId: null,
  createdAt: '2026-08-24T00:00:00.000Z',
  updatedAt: '2026-08-24T00:00:00.000Z',
}

const KnowledgeFormDialogStub = defineComponent({
  name: 'KnowledgeFormDialog',
  props: {
    open: Boolean,
    title: String,
    fields: { type: Array<FormField>, default: () => [] },
    modelValue: { type: Object, default: () => ({}) },
    submitting: Boolean,
  },
  emits: ['update:open', 'submit'],
  template: '<div class="knowledge-form-dialog-stub" />',
})

const DrawerStub = defineComponent({
  name: 'Drawer',
  props: { open: Boolean },
  template: '<div v-if="open"><slot /></div>',
})

const sharedStubs = {
  KnowledgeFormDialog: KnowledgeFormDialogStub,
  ProjectRequirementDetailDrawer: true,
  Drawer: DrawerStub,
  'a-drawer': DrawerStub,
  Empty: true,
  Tag: true,
  Tabs: { template: '<div><slot /></div>' },
  TabPane: { template: '<div><slot /></div>' },
}

function fieldsOf(wrapper: ReturnType<typeof mount>, index = 0): FormField[] {
  return wrapper.findAllComponents(KnowledgeFormDialogStub)[index]!.props('fields') as FormField[]
}

describe('project knowledge submission validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    i18n.global.locale.value = 'zh-CN'
    apiMocks.fetchProjectRequirements.mockResolvedValue([])
    apiMocks.fetchProjectRequirementEvidence.mockResolvedValue([])
    apiMocks.fetchProjectRequirementTraces.mockResolvedValue([])
    apiMocks.fetchProjectKnowledgeMaterials.mockResolvedValue([])
    apiMocks.fetchProjectResearchRecords.mockResolvedValue([])
    apiMocks.createProjectRequirement.mockResolvedValue(requirement)
    apiMocks.createProjectRequirementEvidence.mockResolvedValue({ id: 'evidence-1' })
    apiMocks.createProjectRequirementTrace.mockResolvedValue({ id: 'trace-1' })
  })

  it('requires requirement description or content before creating', async () => {
    const wrapper = mount(ProjectKnowledgeRequirementsTab, {
      props: { projectId: 'project-1', canManage: true },
      global: { plugins: [i18n], stubs: sharedStubs },
    })
    await flushPromises()

    const dialog = wrapper.findComponent(KnowledgeFormDialogStub)
    dialog.vm.$emit('submit', {
      code: 'REQ-002',
      title: 'Archive exports',
      type: 'FUNCTIONAL',
      status: 'DRAFT',
      priority: 'HIGH',
      description: '  ',
      content: '',
      acceptanceCriteria: '',
    })
    await flushPromises()

    expect(apiMocks.createProjectRequirement).not.toHaveBeenCalled()
    expect(messageMocks.warning).toHaveBeenCalledWith('请至少填写需求描述或需求正文')

    dialog.vm.$emit('submit', {
      code: 'REQ-002',
      title: 'Archive exports',
      type: 'FUNCTIONAL',
      status: 'DRAFT',
      priority: 'HIGH',
      description: 'Describe the archive boundary.',
      content: '',
      acceptanceCriteria: '',
    })
    await flushPromises()

    expect(apiMocks.createProjectRequirement).toHaveBeenCalledWith(
      'project-1',
      expect.objectContaining({
        description: 'Describe the archive boundary.',
        content: null,
      }),
    )
  })

  it('requires evidence quote or content in addition to a source', async () => {
    const wrapper = mount(ProjectRequirementDetailDrawer, {
      props: { open: true, projectId: 'project-1', requirement, canManage: true },
      global: { plugins: [i18n], stubs: sharedStubs },
    })
    await flushPromises()

    const evidenceDialog = wrapper.findAllComponents(KnowledgeFormDialogStub)[0]!
    evidenceDialog.vm.$emit('submit', {
      materialId: 'material-1',
      researchRecordId: '',
      quote: ' ',
      content: '',
      locator: '',
    })
    await flushPromises()

    expect(apiMocks.createProjectRequirementEvidence).not.toHaveBeenCalled()
    expect(messageMocks.warning).toHaveBeenCalledWith('请至少填写引用或证据内容')

    evidenceDialog.vm.$emit('submit', {
      materialId: 'material-1',
      researchRecordId: '',
      quote: 'Export is needed before launch.',
      content: '',
      locator: '',
    })
    await flushPromises()

    expect(apiMocks.createProjectRequirementEvidence).toHaveBeenCalledWith(
      'project-1',
      'requirement-1',
      expect.objectContaining({
        materialId: 'material-1',
        quote: 'Export is needed before launch.',
        content: null,
      }),
    )
  })

  it('requires targetName in the top-level trace form and submits a string', async () => {
    const wrapper = mount(ProjectKnowledgeTracesTab, {
      props: { projectId: 'project-1', canManage: true },
      global: { plugins: [i18n], stubs: sharedStubs },
    })
    await flushPromises()

    expect(fieldsOf(wrapper).find((field) => field.key === 'targetName')?.required).toBe(true)
    const dialog = wrapper.findComponent(KnowledgeFormDialogStub)
    dialog.vm.$emit('submit', {
      requirementId: 'requirement-1',
      targetType: 'TASK',
      targetKey: 'TASK-1',
      targetName: ' ',
      targetUrl: '',
      relationType: 'IMPLEMENTS',
    })
    await flushPromises()

    expect(apiMocks.createProjectRequirementTrace).not.toHaveBeenCalled()
    expect(messageMocks.warning).toHaveBeenCalledWith('请输入目标名称')

    dialog.vm.$emit('submit', {
      requirementId: 'requirement-1',
      targetType: 'TASK',
      targetKey: 'TASK-1',
      targetName: ' Implement export ',
      targetUrl: '',
      relationType: 'IMPLEMENTS',
    })
    await flushPromises()

    expect(apiMocks.createProjectRequirementTrace).toHaveBeenCalledWith(
      'project-1',
      'requirement-1',
      expect.objectContaining({ targetName: 'Implement export' }),
    )
  })

  it('requires targetName in the requirement-detail trace form', async () => {
    const wrapper = mount(ProjectRequirementDetailDrawer, {
      props: { open: true, projectId: 'project-1', requirement, canManage: true },
      global: { plugins: [i18n], stubs: sharedStubs },
    })
    await flushPromises()

    expect(fieldsOf(wrapper, 1).find((field) => field.key === 'targetName')?.required).toBe(true)
    const traceDialog = wrapper.findAllComponents(KnowledgeFormDialogStub)[1]!
    traceDialog.vm.$emit('submit', {
      targetType: 'TEST_CASE',
      targetKey: 'TEST-1',
      targetName: '',
      targetUrl: '',
      relationType: 'VERIFIES',
    })
    await flushPromises()

    expect(apiMocks.createProjectRequirementTrace).not.toHaveBeenCalled()
    expect(messageMocks.warning).toHaveBeenCalledWith('请输入目标名称')
  })
})
