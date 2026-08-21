import type { Component } from 'vue'

import ProjectDetailReadonly from './components/ProjectDetailReadonly.vue'

/**
 * 单据类型 -> 只读详情的注册表。
 * approval 模块不直接依赖业务模块，新增单据只需在此注册一行：
 *   'PROJECT': { label: '项目管理', component: ProjectDetailReadonly }
 * 或携带 fetch：按 businessId 拉取详情再渲染。
 * 渲染宿主机（components/BusinessDetailHost.vue）按 businessType 命中注册项后，
 * 将 businessId / formData 透传给对应组件；未注册的类型回落到占位组件兜底。
 */
export interface BusinessRegistryEntry {
  label: string
  component?: Component
  fetch?: (businessId: string) => Promise<Record<string, unknown>>
}

export const businessDetailRegistry: Record<string, BusinessRegistryEntry> = {
  project: {
    label: 'project',
    component: ProjectDetailReadonly,
  },
}

export function getBusinessEntry(
  businessType: string | null | undefined,
): BusinessRegistryEntry | undefined {
  if (!businessType) return undefined
  return businessDetailRegistry[businessType]
}
