<script setup lang="ts">
import { Descriptions, DescriptionsItem, Tag } from 'antdv-next'

defineProps<{
  businessType: string
  businessId: string
  formData?: Record<string, unknown> | null
}>()
</script>

<template>
  <div class="rounded-xl border border-amber-200 bg-amber-50 p-4">
    <div class="text-sm font-semibold text-amber-800">关联单据</div>
    <Descriptions :column="2" bordered size="small" class="mt-3 bg-white">
      <DescriptionsItem label="单据类型">
        <Tag>{{ businessType }}</Tag>
      </DescriptionsItem>
      <DescriptionsItem label="单据 ID">
        <span class="font-mono">{{ businessId }}</span>
      </DescriptionsItem>
    </Descriptions>
    <div
      v-if="formData && typeof formData === 'object' && Object.keys(formData).length"
      class="mt-3 text-xs text-amber-700"
    >
      该类型尚未注册只读详情组件（见
      <span class="font-mono">views/approval/businessRegistry.ts</span
      >），暂展示提交快照/表单数据作为占位。 新单据接入只需注册一行即可渲染真实详情。
    </div>
    <div v-else class="mt-3 text-xs text-slate-500">
      单据详情由业务模块提供，此处按 businessType 动态分发展示。
    </div>
  </div>
</template>
