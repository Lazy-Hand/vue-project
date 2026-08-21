<script setup lang="ts">
import { computed } from 'vue'
import { FileTextOutlined } from '@antdv-next/icons'

import { getBusinessEntry } from '../businessRegistry'
import BusinessDetailPlaceholder from './BusinessDetailPlaceholder.vue'

interface Props {
  businessType?: string | null
  businessId?: string | null
  formData?: Record<string, unknown> | null
}

const props = defineProps<Props>()

const entry = computed(() => getBusinessEntry(props.businessType))
const hasRegisteredComponent = computed(() => Boolean(entry.value?.component))
</script>

<template>
  <!-- 已注册只读组件的单据：按 businessId 渲染真实详情 -->
  <component
    :is="entry!.component"
    v-if="hasRegisteredComponent && businessId"
    :business-id="businessId"
    :form-data="formData ?? null"
    class="mb-5"
  />

  <!-- 有业务指针但未注册组件：占位提示（含提交快照/表单数据透出） -->
  <BusinessDetailPlaceholder
    v-else-if="businessType && businessId"
    :business-type="businessType"
    :business-id="businessId"
    :form-data="formData ?? null"
    class="mb-5"
  />

  <!-- 无业务指针但有表单数据：透出填报内容 -->
  <div
    v-else-if="formData && typeof formData === 'object'"
    class="mb-5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl"
  >
    <div class="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-2.5">
      <FileTextOutlined class="text-blue-600" />
      <span>表单填报数据</span>
    </div>
    <div class="grid grid-cols-2 gap-2 text-xs">
      <div
        v-for="(val, key) in formData"
        :key="key"
        class="flex flex-col bg-white p-2 rounded-lg border border-slate-100"
      >
        <span class="text-slate-400 font-mono text-2xs">{{ key }}</span>
        <span class="font-medium text-slate-700 mt-0.5 truncate">{{ String(val) }}</span>
      </div>
    </div>
  </div>
</template>
