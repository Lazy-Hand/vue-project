<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Modal, Steps, message } from 'antdv-next'
import {
  AppstoreOutlined,
  CheckCircleOutlined,
  ControlOutlined,
  FormOutlined,
  NodeIndexOutlined,
  SaveOutlined,
} from '@antdv-next/icons'

import { createApprovalDefinition, updateApprovalDefinition } from '@/api/approval'
import type {
  AdvancedConfig,
  ApprovalDefinition,
  ApprovalNodeInput,
  ApprovalNodeType,
  CreateApprovalDefinitionPayload,
  FormFieldSchema,
  FormSchemaConfig,
  UpdateApprovalDefinitionPayload,
} from '@/types/approval'
import { ApiRequestError } from '@/utils/request'

import AdvancedSettingsTab from './tabs/AdvancedSettingsTab.vue'
import BasicSettingsTab, { type BasicFormState } from './tabs/BasicSettingsTab.vue'
import FlowDesignerTab from './tabs/FlowDesignerTab.vue'
import FormDesignerTab from './tabs/FormDesignerTab.vue'

interface Props {
  open: boolean
  definition: ApprovalDefinition | null
  categories?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  categories: () => [],
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  success: []
}>()

const { t } = useI18n()
const currentStep = ref(0)
const submitting = ref(false)

const isEdit = computed(() => Boolean(props.definition))

// 步骤 1：基础设置
const basicState = ref<BasicFormState>({
  code: '',
  name: '',
  category: '',
  icon: 'FileTextOutlined',
  color: '#1677ff',
  remark: '',
  enabled: true,
})

// 步骤 2：表单设计
const formSchemaState = ref<FormSchemaConfig>({
  fields: [],
})

// 步骤 3：流程节点设计
const flowNodes = ref<ApprovalNodeInput[]>([])

// 步骤 4：高级设置
const advancedState = ref<AdvancedConfig>({
  titleRule: '{{initiator}} 发起的 {{name}} - {{date}}',
  autoDeduplication: true,
  allowRevoke: true,
})

function createDefaultNode(): ApprovalNodeInput {
  return {
    nodeKey: 'approver_1',
    name: '直接主管审批',
    type: 'SEQ',
    assigneeType: 'DEPT_LEADER',
    assigneeValue: '',
    allowTransfer: true,
    allowAddSign: false,
    allowReject: true,
    rejectTarget: 'INITIATOR',
  }
}

function initData(): void {
  currentStep.value = 0
  if (props.definition) {
    const d = props.definition
    basicState.value = {
      code: d.code,
      name: d.name,
      category: d.category ?? '',
      icon: d.icon ?? 'FileTextOutlined',
      color: d.color ?? '#1677ff',
      remark: d.remark ?? '',
      enabled: d.enabled,
    }

    // Form Schema
    if (
      d.formSchema &&
      'fields' in d.formSchema &&
      Array.isArray((d.formSchema as FormSchemaConfig).fields)
    ) {
      formSchemaState.value = { fields: [...(d.formSchema as FormSchemaConfig).fields] }
    } else {
      formSchemaState.value = { fields: [] }
    }

    // Nodes
    if (d.nodes && d.nodes.length > 0) {
      flowNodes.value = d.nodes.map((n, idx) => {
        const cfg =
          (n.assigneeConfig as { parallelGroup?: string; branchIndex?: number } | null) || {}
        return {
          id: n.id,
          nodeKey: n.nodeKey ?? `node_${idx + 1}`,
          name: n.name,
          type: n.type,
          assigneeType: n.assigneeType,
          assigneeValue: n.assigneeValue ?? '',
          parallelGroup: cfg.parallelGroup,
          branchIndex: cfg.branchIndex,
          allowTransfer: n.allowTransfer,
          allowAddSign: n.allowAddSign,
          allowReject: n.allowReject,
          rejectTarget: n.rejectTarget ?? 'INITIATOR',
        }
      })
    } else {
      flowNodes.value = [createDefaultNode()]
    }

    // Advanced Config
    if (d.advancedConfig) {
      const adv = d.advancedConfig as AdvancedConfig
      advancedState.value = {
        titleRule: adv.titleRule ?? '{{initiator}} 发起的 {{name}} - {{date}}',
        autoDeduplication: adv.autoDeduplication ?? true,
        allowRevoke: adv.allowRevoke ?? true,
      }
    } else {
      advancedState.value = {
        titleRule: '{{initiator}} 发起的 {{name}} - {{date}}',
        autoDeduplication: true,
        allowRevoke: true,
      }
    }
  } else {
    basicState.value = {
      code: `workflow_${Date.now().toString().slice(-4)}`,
      name: '',
      category: '',
      icon: 'FileTextOutlined',
      color: '#1677ff',
      remark: '',
      enabled: true,
    }
    formSchemaState.value = {
      fields: [
        {
          id: 'reason',
          type: 'textarea',
          label: '申请事由',
          required: true,
          placeholder: '请输入申请事由',
        },
      ],
    }
    flowNodes.value = [createDefaultNode()]
    advancedState.value = {
      titleRule: '{{initiator}} 发起的 {{name}} - {{date}}',
      autoDeduplication: true,
      allowRevoke: true,
    }
  }
}

watch(
  () => props.open,
  (val) => {
    if (val) initData()
  },
)

const stepItems = computed(() => [
  { title: t('approval.definition.stepBasic') },
  { title: t('approval.definition.stepForm') },
  { title: t('approval.definition.stepFlow') },
  { title: t('approval.definition.stepAdvanced') },
])

function validateBeforeNext(): boolean {
  if (currentStep.value === 0) {
    if (!basicState.value.name.trim()) {
      void message.warning(t('approval.definition.nameRequired'))
      return false
    }
    if (!basicState.value.code.trim()) {
      void message.warning(t('approval.definition.codeRequired'))
      return false
    }
  } else if (currentStep.value === 2) {
    if (flowNodes.value.length === 0) {
      void message.warning(t('approval.definition.nodesRequired'))
      return false
    }
    for (const node of flowNodes.value) {
      if (!node.name.trim()) {
        void message.warning(t('approval.definition.nodeNameRequired'))
        return false
      }
    }
  }
  return true
}

function handleNext(): void {
  if (!validateBeforeNext()) return
  if (currentStep.value < 3) {
    currentStep.value += 1
  }
}

function handlePrev(): void {
  if (currentStep.value > 0) {
    currentStep.value -= 1
  }
}

async function handleSave(publish = true): Promise<void> {
  if (!basicState.value.name.trim()) {
    currentStep.value = 0
    void message.warning(t('approval.definition.nameRequired'))
    return
  }
  if (!basicState.value.code.trim()) {
    currentStep.value = 0
    void message.warning(t('approval.definition.codeRequired'))
    return
  }
  if (flowNodes.value.length === 0) {
    currentStep.value = 2
    void message.warning(t('approval.definition.nodesRequired'))
    return
  }

  submitting.value = true
  try {
    const payload: CreateApprovalDefinitionPayload = {
      code: basicState.value.code.trim(),
      name: basicState.value.name.trim(),
      category: basicState.value.category.trim() || undefined,
      icon: basicState.value.icon || 'FileTextOutlined',
      color: basicState.value.color || '#1677ff',
      remark: basicState.value.remark.trim() || undefined,
      enabled: publish ? basicState.value.enabled : false,
      formSchema: {
        fields: formSchemaState.value.fields,
      },
      flowConfig: {
        nodes: flowNodes.value.map((n, i) => ({
          nodeKey: n.nodeKey ?? `node_${i + 1}`,
          name: n.name,
          type: n.type ?? 'SEQ',
          assigneeType: n.assigneeType,
          assigneeValue: n.assigneeValue,
          allowTransfer: n.allowTransfer,
          allowAddSign: n.allowAddSign,
          allowReject: n.allowReject,
          rejectTarget: n.rejectTarget,
        })),
      },
      advancedConfig: {
        titleRule: advancedState.value.titleRule,
        autoDeduplication: advancedState.value.autoDeduplication,
        allowRevoke: advancedState.value.allowRevoke,
      },
      nodes: flowNodes.value.map((n, idx) => ({
        nodeKey: n.nodeKey ?? `node_${idx + 1}`,
        name: n.name.trim(),
        type: n.type ?? 'SEQ',
        assigneeType: n.assigneeType,
        assigneeValue: n.assigneeValue?.trim() || undefined,
        assigneeConfig: n.parallelGroup
          ? { parallelGroup: n.parallelGroup, branchIndex: n.branchIndex }
          : undefined,
        allowTransfer: n.allowTransfer,
        allowAddSign: n.allowAddSign,
        allowReject: n.allowReject,
        rejectTarget: n.rejectTarget,
      })),
    }

    if (isEdit.value && props.definition) {
      const updatePayload: UpdateApprovalDefinitionPayload = {
        name: payload.name,
        category: payload.category,
        icon: payload.icon,
        color: payload.color,
        remark: payload.remark,
        enabled: payload.enabled,
        formSchema: payload.formSchema,
        flowConfig: payload.flowConfig,
        advancedConfig: payload.advancedConfig,
        nodes: payload.nodes,
      }
      await updateApprovalDefinition(props.definition.id, updatePayload)
      void message.success(t('approval.definition.updateSuccess'))
    } else {
      await createApprovalDefinition(payload)
      void message.success(t('approval.definition.createSuccess'))
    }

    emit('update:open', false)
    emit('success')
  } catch (error) {
    const msg =
      error instanceof ApiRequestError
        ? error.message
        : error instanceof Error
          ? error.message
          : t('approval.requestFailed')
    void message.error(msg)
  } finally {
    submitting.value = false
  }
}

function handleClose(): void {
  emit('update:open', false)
}
</script>

<template>
  <Modal
    :open="open"
    width="1120px"
    destroy-on-hidden
    :footer="null"
    :get-container="false"
    class="workflow-designer-modal"
    @cancel="handleClose"
  >
    <template #title>
      <div class="flex items-center justify-between pr-8">
        <div class="flex items-center gap-2">
          <div
            class="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center text-base"
          >
            <NodeIndexOutlined />
          </div>
          <div>
            <div class="text-base font-bold text-slate-800">
              {{
                isEdit ? t('approval.definition.editTitle') : t('approval.definition.createTitle')
              }}
            </div>
            <div class="text-2xs text-slate-400">
              {{ t('approval.definition.subtitle') }}
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 顶部步骤指示器 -->
    <div class="py-3 px-6 bg-slate-50 border-y border-slate-200 -mx-6 mb-4">
      <Steps
        :current="currentStep"
        size="small"
        :items="stepItems"
        @change="(idx) => (currentStep = idx)"
      />
    </div>

    <!-- 步骤内容区 -->
    <div class="min-h-[580px]">
      <div v-show="currentStep === 0">
        <BasicSettingsTab v-model="basicState" :is-edit="isEdit" :categories="categories" />
      </div>

      <div v-show="currentStep === 1">
        <FormDesignerTab v-model="formSchemaState" />
      </div>

      <div v-show="currentStep === 2">
        <FlowDesignerTab
          :nodes="flowNodes"
          :form-fields="formSchemaState.fields"
          @update:nodes="(val) => (flowNodes = val)"
        />
      </div>

      <div v-show="currentStep === 3">
        <AdvancedSettingsTab v-model="advancedState" />
      </div>
    </div>

    <!-- 底部操作栏 -->
    <div
      class="flex items-center justify-between pt-4 border-t border-slate-200 mt-4 -mx-6 px-6 bg-white"
    >
      <Button :disabled="submitting" @click="handleClose">
        {{ t('common.cancel') }}
      </Button>

      <div class="flex items-center gap-2">
        <Button v-if="currentStep > 0" :disabled="submitting" @click="handlePrev">
          {{ t('approval.definition.prevStep') }}
        </Button>

        <Button v-if="currentStep < 3" type="primary" :disabled="submitting" @click="handleNext">
          {{ t('approval.definition.nextStep') }}
        </Button>

        <Button :disabled="submitting" @click="handleSave(false)">
          <SaveOutlined />
          {{ t('approval.definition.saveDraft') }}
        </Button>

        <Button
          type="primary"
          :loading="submitting"
          class="bg-emerald-600 hover:bg-emerald-500 border-emerald-600"
          @click="handleSave(true)"
        >
          <CheckCircleOutlined />
          {{ t('approval.definition.publishAndSave') }}
        </Button>
      </div>
    </div>
  </Modal>
</template>

<style scoped lang="scss">
.workflow-designer-modal {
  :deep(.ant-modal-body) {
    padding-top: 12px;
  }
}
</style>
