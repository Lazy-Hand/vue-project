import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const permissionState = vi.hoisted(() => ({ query: true, manage: true }))
const apiMocks = vi.hoisted(() => {
  const mock = () => vi.fn<() => Promise<unknown>>()
  return {
    fetchProjectKnowledgeMaterials: mock().mockResolvedValue([]),
    fetchProjectResearchRecords: mock().mockResolvedValue([]),
    fetchProjectRequirements: mock().mockResolvedValue([]),
    fetchProjectKnowledgeQuestions: mock().mockResolvedValue([]),
    fetchProjectPrdDocuments: mock().mockResolvedValue([]),
    fetchProjectRequirementTraces: mock().mockResolvedValue([]),
    createProjectKnowledgeMaterial: mock(),
    updateProjectKnowledgeMaterial: mock(),
    deleteProjectKnowledgeMaterial: mock(),
    createProjectResearchRecord: mock(),
    updateProjectResearchRecord: mock(),
    deleteProjectResearchRecord: mock(),
    createProjectRequirement: mock(),
    updateProjectRequirement: mock(),
    deleteProjectRequirement: mock(),
    fetchProjectRequirementEvidence: mock().mockResolvedValue([]),
    createProjectRequirementEvidence: mock(),
    updateProjectRequirementEvidence: mock(),
    deleteProjectRequirementEvidence: mock(),
    createProjectKnowledgeQuestion: mock(),
    updateProjectKnowledgeQuestion: mock(),
    deleteProjectKnowledgeQuestion: mock(),
    createProjectPrdDocument: mock(),
    updateProjectPrdDocument: mock(),
    deleteProjectPrdDocument: mock(),
    fetchProjectPrdDocumentVersions: mock().mockResolvedValue([]),
    createProjectPrdDocumentVersion: mock(),
    updateProjectPrdDocumentVersion: mock(),
    deleteProjectPrdDocumentVersion: mock(),
    createProjectRequirementTrace: mock(),
    updateProjectRequirementTrace: mock(),
    deleteProjectRequirementTrace: mock(),
  }
})

vi.mock('@/api/project-knowledge', () => apiMocks)
vi.mock('@/composables/usePermission', () => ({
  usePermission: () => ({
    hasPermission: (code: string) =>
      code === 'system:project:query' ? permissionState.query : permissionState.manage,
  }),
}))

import { i18n } from '@/i18n'
import ProjectKnowledgeDrawer from './ProjectKnowledgeDrawer.vue'

const DrawerStub = defineComponent({
  props: { open: Boolean },
  template: '<div v-if="open"><slot /></div>',
})

describe('ProjectKnowledgeDrawer', () => {
  beforeEach(() => {
    permissionState.query = true
    permissionState.manage = true
    vi.clearAllMocks()
    i18n.global.locale.value = 'zh-CN'
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
  })

  it('renders the six domains and the evidence-to-delivery chain', async () => {
    const wrapper = mount(ProjectKnowledgeDrawer, {
      props: { open: true, projectId: 'project-1', projectName: 'Export project' },
      global: {
        plugins: [i18n],
        stubs: { Drawer: DrawerStub, 'a-drawer': DrawerStub },
      },
    })
    await flushPromises()

    expect(wrapper.find('.knowledge-nav__menu-shell').exists()).toBe(true)
    expect(wrapper.find('.knowledge-nav__menu-shell').findAll('.knowledge-nav__item')).toHaveLength(
      6,
    )
    expect(wrapper.find('.knowledge-chain').text()).toContain('证据')
    expect(wrapper.find('.knowledge-chain').text()).toContain('需求')
    expect(wrapper.find('.knowledge-chain').text()).toContain('交付物')

    await wrapper.findAll('.knowledge-nav__item')[3]!.trigger('click')
    expect(wrapper.findAll('.knowledge-nav__item')[3]!.classes()).toContain('is-active')
    expect(apiMocks.fetchProjectKnowledgeMaterials).toHaveBeenCalledWith('project-1')
  })

  it('keeps the workbench content behind the project query permission', async () => {
    permissionState.query = false
    const wrapper = mount(ProjectKnowledgeDrawer, {
      props: { open: true, projectId: 'project-1', projectName: 'Export project' },
      global: {
        plugins: [i18n],
        stubs: { Drawer: DrawerStub, 'a-drawer': DrawerStub },
      },
    })
    await flushPromises()

    expect(wrapper.find('.knowledge-access-empty').exists()).toBe(true)
    expect(wrapper.find('.knowledge-nav').exists()).toBe(false)
    expect(apiMocks.fetchProjectKnowledgeMaterials).not.toHaveBeenCalled()
  })
})
