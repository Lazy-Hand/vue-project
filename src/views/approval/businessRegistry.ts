import type { Component } from 'vue'

/**
 * 单据类型 -> 只读详情的注册表。
 * approval 模块不直接依赖业务模块，新增单据只需在此注册一行：
 *   'INBOUND_ORDER': { label: '入库单', component: InboundOrderDetailReadonly }
 * 或携带 fetch：按 businessId 拉取详情再渲染。
 */
export interface BusinessRegistryEntry {
  label: string
  component?: Component
  fetch?: (businessId: string) => Promise<Record<string, unknown>>
}

export const businessDetailRegistry: Record<string, BusinessRegistryEntry> = {
  INBOUND_ORDER: {
    label: '入库单',
  },
  // 示例：注册入库单只读详情组件后，审批详情即按 component 渲染
  // 'INBOUND_ORDER:DETAIL': { label: '入库单', component: InboundOrderDetailReadonly }
}

export function getBusinessEntry(
  businessType: string | null | undefined,
): BusinessRegistryEntry | undefined {
  if (!businessType) return undefined
  return businessDetailRegistry[businessType]
}
