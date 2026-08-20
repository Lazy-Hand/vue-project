<script setup lang="ts">
import { Descriptions, DescriptionsItem, Tag } from 'antdv-next'

defineProps<{
  businessId: string
  formData?: Record<string, unknown> | null
}>()
</script>

<template>
  <div class="rounded-xl border border-slate-200 bg-white p-4">
    <div class="text-sm font-bold text-slate-800">入库单详情（只读示例）</div>
    <div class="mt-1 text-xs text-slate-500">
      审批详情按 businessType=INBOUND_ORDER 动态渲染真实单据，表单设计留空。
    </div>
    <Descriptions :column="2" bordered size="small" class="mt-3">
      <DescriptionsItem label="单据 ID">
        <span class="font-mono">{{ businessId }}</span>
      </DescriptionsItem>
      <DescriptionsItem label="状态">
        <Tag color="processing">待审批</Tag>
      </DescriptionsItem>
    </Descriptions>
    <div
      v-if="formData && typeof formData === 'object' && Object.keys(formData).length"
      class="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600"
    >
      快照/表单透出：{{ JSON.stringify(formData, null, 2) }}
    </div>
    <div v-else class="mt-3 text-xs text-slate-400">
      接入真实 InboundOrder 模块后，替换为按 businessId 拉取的详情即可。
    </div>
  </div>
</template>
