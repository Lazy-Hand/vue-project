import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { DatePicker } from 'antdv-next'

import { i18n } from '@/i18n'
import type { ProjectStage } from '@/types/project'
import ProjectStageDialog from './ProjectStageDialog.vue'

const EDITING_STAGE: ProjectStage = {
  id: 'stage-1',
  projectId: 'project-1',
  name: '实施阶段',
  sort: 1,
  status: 'IN_PROGRESS',
  plannedStartAt: '2026-08-01T00:00:00.000Z',
  plannedEndAt: '2026-08-31T00:00:00.000Z',
  actualStartAt: '2026-08-02T00:00:00.000Z',
  actualEndAt: '2026-08-30T00:00:00.000Z',
  description: null,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
}

describe('ProjectStageDialog date values', () => {
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

  it('passes Day.js values to date pickers when editing a stage', async () => {
    const wrapper = mount(ProjectStageDialog, {
      props: { modelValue: true, mode: 'edit', editing: EDITING_STAGE },
      global: { plugins: [i18n] },
    })
    await flushPromises()

    const values = wrapper.findAllComponents(DatePicker).map((picker) => picker.props('value'))
    expect(values).toHaveLength(4)
    expect(values.every((value) => value && typeof value.hour === 'function')).toBe(true)
  })
})
