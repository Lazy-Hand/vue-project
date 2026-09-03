<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Tag } from 'antdv-next'
import type { AdvancedConfig } from '@/types/approval'

interface Props {
  modelValue: AdvancedConfig
}

defineProps<Props>()

const { t } = useI18n()
</script>

<template>
  <div class="advanced-settings-tab max-w-2xl mx-auto py-4">
    <!-- 第一批：标题规则、自动去重、允许撤销等高级设置尚未被执行引擎消费，
         暂时下线编辑入口，避免产生“可配置但不生效”的错觉。 -->
    <div
      class="p-6 bg-slate-50 dark:bg-[#18191e] border border-dashed border-slate-300 dark:border-[#2e3038] rounded-xl text-center"
    >
      <Tag color="default" class="mb-2">{{ t('approval.definition.plannedBadge') }}</Tag>
      <p class="text-sm text-slate-500 dark:text-slate-400">
        {{ t('approval.definition.advancedPlannedTip') }}
      </p>
    </div>
  </div>
</template>
