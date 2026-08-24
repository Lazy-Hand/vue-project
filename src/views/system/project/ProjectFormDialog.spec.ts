import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { DatePicker } from 'antdv-next'

import { i18n } from '@/i18n'
import type { Project } from '@/types/project'
import ProjectFormDialog from './ProjectFormDialog.vue'

const EDITING_PROJECT: Project = {
  id: 'project-1',
  code: 'PROJECT-001',
  name: '测试项目',
  clientId: 'client-1',
  description: null,
  status: 'DRAFT',
  initiationApprovalStatus: null,
  initiationApprovalInstanceId: null,
  closureApprovalStatus: null,
  closureApprovalInstanceId: null,
  contractAmount: null,
  budgetedCost: null,
  actualCost: null,
  settlementStatus: 'UNSETTLED',
  startDate: '2026-08-01T00:00:00.000Z',
  endDate: '2026-08-31T00:00:00.000Z',
  actualEndDate: null,
  managerId: null,
  deptId: null,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
}

describe('ProjectFormDialog date values', () => {
  beforeEach(() => {
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

  it('passes Day.js values to date pickers when editing a project', async () => {
    const wrapper = mount(ProjectFormDialog, {
      props: {
        modelValue: true,
        mode: 'edit',
        editing: EDITING_PROJECT,
        clients: [],
        users: [],
        deptTree: [],
      },
      global: { plugins: [i18n] },
    })
    await flushPromises()

    const values = wrapper.findAllComponents(DatePicker).map((picker) => picker.props('value'))
    expect(values).toHaveLength(2)
    expect(values.every((value) => value && typeof value.hour === 'function')).toBe(true)
  })
})
