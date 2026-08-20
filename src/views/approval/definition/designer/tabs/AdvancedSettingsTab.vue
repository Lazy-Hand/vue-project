<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Form, FormItem, Input, Switch, Tag } from 'antdv-next'
import type { AdvancedConfig } from '@/types/approval'

interface Props {
  modelValue: AdvancedConfig
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: AdvancedConfig]
}>()

const { t } = useI18n()

const varInitiator = '{{initiator}}'
const varName = '{{name}}'
const varDate = '{{date}}'

function updateConfig(patch: Partial<AdvancedConfig>): void {
  emit('update:modelValue', { ...props.modelValue, ...patch })
}

function insertVariable(tag: string): void {
  const current = props.modelValue.titleRule || ''
  updateConfig({ titleRule: current + tag })
}
</script>

<template>
  <div class="advanced-settings-tab max-w-2xl mx-auto py-4">
    <Form layout="vertical">
      <!-- 审批标题规则 -->
      <div class="p-4 bg-slate-50 border border-slate-200 rounded-xl mb-4">
        <FormItem :label="t('approval.definition.titleRule')" class="mb-2">
          <Input
            :value="modelValue.titleRule || ''"
            :placeholder="t('approval.definition.titleRulePlaceholder')"
            :maxlength="128"
            @update:value="(val) => updateConfig({ titleRule: String(val) })"
          />
        </FormItem>
        <div class="text-xs text-slate-500 mb-2">
          {{ t('approval.definition.titleRuleTip') }}
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-slate-400">快速插入:</span>
          <Tag class="cursor-pointer hover:border-blue-500" @click="insertVariable(varInitiator)">
            {{ varInitiator }} (申请人)
          </Tag>
          <Tag class="cursor-pointer hover:border-blue-500" @click="insertVariable(varName)">
            {{ varName }} (流程名)
          </Tag>
          <Tag class="cursor-pointer hover:border-blue-500" @click="insertVariable(varDate)">
            {{ varDate }} (当前日期)
          </Tag>
        </div>
      </div>

      <!-- 审批人自动去重 -->
      <div
        class="p-4 bg-slate-50 border border-slate-200 rounded-xl mb-4 flex items-center justify-between"
      >
        <div>
          <div class="text-sm font-semibold text-slate-800">
            {{ t('approval.definition.autoDeduplication') }}
          </div>
          <div class="text-xs text-slate-500 mt-0.5">
            {{ t('approval.definition.autoDeduplicationTip') }}
          </div>
        </div>
        <Switch
          :checked="modelValue.autoDeduplication ?? true"
          @update:checked="(val) => updateConfig({ autoDeduplication: Boolean(val) })"
        />
      </div>

      <!-- 允许发起人撤销 -->
      <div
        class="p-4 bg-slate-50 border border-slate-200 rounded-xl mb-4 flex items-center justify-between"
      >
        <div>
          <div class="text-sm font-semibold text-slate-800">
            {{ t('approval.definition.allowRevoke') }}
          </div>
          <div class="text-xs text-slate-500 mt-0.5">
            {{ t('approval.definition.allowRevokeTip') }}
          </div>
        </div>
        <Switch
          :checked="modelValue.allowRevoke ?? true"
          @update:checked="(val) => updateConfig({ allowRevoke: Boolean(val) })"
        />
      </div>
    </Form>
  </div>
</template>
