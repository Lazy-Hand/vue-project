<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Modal, Steps, message } from 'antdv-next'
import { CheckCircleOutlined, NodeIndexOutlined, SaveOutlined } from '@antdv-next/icons'

import {
  createApprovalDefinition,
  publishApprovalDefinition,
  updateApprovalDefinition,
} from '@/api/approval'
import type {
  AdvancedConfig,
  ApprovalDefinition,
  ApprovalEdgeInput,
  ApprovalNodeInput,
  CreateApprovalDefinitionPayload,
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

// 步骤 3：流程节点设计（真实节点 + 边模型）
const flowNodes = ref<ApprovalNodeInput[]>([])
const flowEdges = ref<ApprovalEdgeInput[]>([])

// 步骤 4：高级设置
const advancedState = ref<AdvancedConfig>({})

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
          assigneeConfig: n.assigneeConfig ?? undefined,
          conditionConfig: n.conditionConfig ?? undefined,
          formPermissions: n.formPermissions ?? undefined,
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

    // Edges：优先回填已保存的边（d.edges 或 d.flowConfig.edges）；旧数据无边时优先按 parallelGroup 还原并行拓扑，否则推导线性链
    const keys = flowNodes.value.map((n, idx) => n.nodeKey ?? `node_${idx + 1}`)
    const keySet = new Set(keys)
    const rawEdges =
      (Array.isArray(d.edges) && d.edges.length > 0
        ? d.edges
        : Array.isArray((d.flowConfig as { edges?: ApprovalEdgeInput[] } | null)?.edges)
          ? (d.flowConfig as { edges?: ApprovalEdgeInput[] }).edges
          : []) || []

    if (Array.isArray(rawEdges) && rawEdges.length > 0) {
      flowEdges.value = (rawEdges as ApprovalEdgeInput[])
        .filter(
          (e) =>
            !!e.fromNodeKey &&
            keySet.has(e.fromNodeKey) &&
            (!e.toNodeKey || keySet.has(e.toNodeKey)),
        )
        .map((e) => ({
          fromNodeKey: e.fromNodeKey,
          toNodeKey: e.toNodeKey || null,
          conditionConfig: e.conditionConfig,
        }))
    } else {
      // 智能分层还原拓扑（优先显式 parallelGroup，其次聚合相邻连续的 AND_SIGN/OR_SIGN 节点）
      const layers: string[][] = []
      let currentLayer: { type: string; group?: string; keys: string[] } | null = null

      for (let i = 0; i < flowNodes.value.length; i++) {
        const node = flowNodes.value[i]!
        const nodeKey = node.nodeKey ?? `node_${i + 1}`
        const group = node.parallelGroup
        const type = node.type ?? 'SEQ'

        if (group) {
          if (currentLayer && currentLayer.group === group) {
            currentLayer.keys.push(nodeKey)
          } else {
            if (currentLayer) layers.push(currentLayer.keys)
            currentLayer = { type, group, keys: [nodeKey] }
          }
        } else if (type === 'AND_SIGN' || type === 'OR_SIGN') {
          // 相邻同类型会签或或签节点自动聚合为同一并行层
          if (currentLayer && !currentLayer.group && currentLayer.type === type) {
            currentLayer.keys.push(nodeKey)
          } else {
            if (currentLayer) layers.push(currentLayer.keys)
            currentLayer = { type, keys: [nodeKey] }
          }
        } else {
          if (currentLayer) layers.push(currentLayer.keys)
          currentLayer = { type, keys: [nodeKey] }
        }
      }
      if (currentLayer) layers.push(currentLayer.keys)

      const derivedEdges: ApprovalEdgeInput[] = []
      for (let l = 0; l < layers.length - 1; l++) {
        const currentLayerKeys = layers[l]!
        const nextLayerKeys = layers[l + 1]!
        for (const fromKey of currentLayerKeys) {
          for (const toKey of nextLayerKeys) {
            derivedEdges.push({ fromNodeKey: fromKey, toNodeKey: toKey })
          }
        }
      }
      flowEdges.value = derivedEdges
    }

    // 高级配置目前只展示规划提示，但回填时只保留后端运行时支持的字段。
    const rawAdvanced =
      d.advancedConfig && typeof d.advancedConfig === 'object' && !Array.isArray(d.advancedConfig)
        ? (d.advancedConfig as Record<string, unknown>)
        : {}
    advancedState.value = {
      ...(typeof rawAdvanced.titleTemplate === 'string'
        ? { titleTemplate: rawAdvanced.titleTemplate }
        : {}),
      ...(rawAdvanced.dedup === 'NONE' ||
      rawAdvanced.dedup === 'NODE' ||
      rawAdvanced.dedup === 'FLOW'
        ? { dedup: rawAdvanced.dedup }
        : {}),
      ...(rawAdvanced.emptyAssigneePolicy === 'FAIL' ||
      rawAdvanced.emptyAssigneePolicy === 'SKIP' ||
      rawAdvanced.emptyAssigneePolicy === 'TO_ADMIN' ||
      rawAdvanced.emptyAssigneePolicy === 'BACKUP'
        ? { emptyAssigneePolicy: rawAdvanced.emptyAssigneePolicy }
        : {}),
      ...(typeof rawAdvanced.backupAssigneeValue === 'string'
        ? { backupAssigneeValue: rawAdvanced.backupAssigneeValue }
        : {}),
      ...(typeof rawAdvanced.allowCancel === 'boolean'
        ? { allowCancel: rawAdvanced.allowCancel }
        : {}),
      ...(typeof rawAdvanced.allowComment === 'boolean'
        ? { allowComment: rawAdvanced.allowComment }
        : {}),
      ...(typeof rawAdvanced.requireCommentOnReject === 'boolean'
        ? { requireCommentOnReject: rawAdvanced.requireCommentOnReject }
        : {}),
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
    flowEdges.value = []
    advancedState.value = {}
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

/** 保存前轻量图校验：唯一入口 + 全部节点可达（完整编译由后端发布时执行） */
function validateFlowGraph(): boolean {
  const keys = flowNodes.value.map((n, idx) => n.nodeKey?.trim() || `node_${idx + 1}`)
  const keySet = new Set(keys)
  const edges = flowEdges.value.filter(
    (e) =>
      !!e.fromNodeKey && keySet.has(e.fromNodeKey) && (!e.toNodeKey || keySet.has(e.toNodeKey)),
  )
  if (edges.length === 0) {
    if (keys.length === 1) return true
    void message.warning(t('approval.definition.unreachableNodes'))
    return false
  }

  const incoming = new Map<string, number>(keys.map((k) => [k, 0]))
  const adjacency = new Map<string, string[]>(keys.map((k) => [k, []]))
  const seen = new Set<string>()
  for (const e of edges) {
    const dedupe = `${e.fromNodeKey}->${e.toNodeKey ?? ''}`
    if (seen.has(dedupe)) continue
    seen.add(dedupe)
    if (e.toNodeKey) {
      incoming.set(e.toNodeKey, (incoming.get(e.toNodeKey) ?? 0) + 1)
      adjacency.get(e.fromNodeKey)!.push(e.toNodeKey)
    }
  }

  const entries = keys.filter((k) => (incoming.get(k) ?? 0) === 0)
  if (entries.length !== 1) {
    void message.warning(t('approval.definition.entryRequired'))
    return false
  }

  const entry = entries[0]!
  const visited = new Set([entry])
  const queue = [entry]
  while (queue.length > 0) {
    const cur = queue.shift()!
    for (const next of adjacency.get(cur)!) {
      if (!visited.has(next)) {
        visited.add(next)
        queue.push(next)
      }
    }
  }
  if (keys.some((k) => !visited.has(k))) {
    void message.warning(t('approval.definition.unreachableNodes'))
    return false
  }
  return true
}

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
    if (!validateFlowGraph()) return false
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
  if (!validateFlowGraph()) {
    currentStep.value = 2
    return
  }

  submitting.value = true
  try {
    const edges: ApprovalEdgeInput[] = flowEdges.value.map((e) => ({
      fromNodeKey: e.fromNodeKey,
      toNodeKey: e.toNodeKey || undefined,
      conditionConfig: e.conditionConfig,
    }))
    const payload: CreateApprovalDefinitionPayload = {
      code: basicState.value.code.trim(),
      name: basicState.value.name.trim(),
      category: basicState.value.category.trim() || undefined,
      icon: basicState.value.icon || 'FileTextOutlined',
      color: basicState.value.color || '#1677ff',
      remark: basicState.value.remark.trim() || undefined,
      enabled: publish ? basicState.value.enabled : (props.definition?.enabled ?? false),
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
          assigneeConfig: n.assigneeConfig,
          conditionConfig: n.conditionConfig,
          formPermissions: n.formPermissions,
          allowTransfer: n.allowTransfer,
          allowAddSign: n.allowAddSign,
          allowReject: n.allowReject,
          rejectTarget: n.rejectTarget,
        })),
        edges,
      },
      advancedConfig: advancedState.value,
      nodes: flowNodes.value.map((n, idx) => ({
        nodeKey: n.nodeKey ?? `node_${idx + 1}`,
        name: n.name.trim(),
        type: n.type ?? 'SEQ',
        assigneeType: n.assigneeType,
        assigneeValue: n.assigneeValue?.trim() || undefined,
        assigneeConfig: n.parallelGroup
          ? { parallelGroup: n.parallelGroup, branchIndex: n.branchIndex }
          : n.assigneeConfig,
        conditionConfig: n.conditionConfig,
        formPermissions: n.formPermissions,
        allowTransfer: n.allowTransfer,
        allowAddSign: n.allowAddSign,
        allowReject: n.allowReject,
        rejectTarget: n.rejectTarget,
      })),
      edges,
    }

    let definitionId: string
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
        edges: payload.edges,
      }
      const updated = await updateApprovalDefinition(props.definition.id, updatePayload)
      definitionId = updated.id
      void message.success(t('approval.definition.updateSuccess'))
    } else {
      const created = await createApprovalDefinition(payload)
      definitionId = created.id
      void message.success(t('approval.definition.createSuccess'))
    }

    if (publish) {
      await publishApprovalDefinition(definitionId)
      void message.success(t('approval.definition.publishSuccess'))
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
            <div class="designer-modal-title text-base font-bold">
              {{
                isEdit ? t('approval.definition.editTitle') : t('approval.definition.createTitle')
              }}
            </div>
            <div class="designer-modal-subtitle text-2xs">
              {{ t('approval.definition.subtitle') }}
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 顶部步骤指示器 -->
    <div class="designer-steps-wrap mb-4">
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
          :edges="flowEdges"
          :form-fields="formSchemaState.fields"
          @update:nodes="(val) => (flowNodes = val)"
          @update:edges="(val) => (flowEdges = val)"
        />
      </div>

      <div v-show="currentStep === 3">
        <AdvancedSettingsTab v-model="advancedState" />
      </div>
    </div>

    <!-- 底部操作栏 -->
    <div class="designer-footer-wrap mt-4">
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

.designer-modal-title {
  color: #0f172a;
}

.designer-modal-subtitle {
  color: #94a3b8;
}

.designer-steps-wrap {
  padding: 12px 24px;
  background-color: #f8fafc;
  border-top: 1px solid #e2e8f0;
  border-bottom: 1px solid #e2e8f0;
  margin: 0 -24px 16px;
  transition: all 0.2s ease;
}

.designer-footer-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px 0;
  border-top: 1px solid #e2e8f0;
  margin: 16px -24px 0;
  background-color: #ffffff;
  transition: all 0.2s ease;
}

/* ==========================================================================
   暗黑模式 (Dark Mode)
   ========================================================================== */
html.dark {
  .designer-modal-title {
    color: #ffffff;
  }

  .designer-modal-subtitle {
    color: #8b909a;
  }

  .designer-steps-wrap {
    background-color: #18191e;
    border-top-color: #2a2c33;
    border-bottom-color: #2a2c33;
  }

  .designer-footer-wrap {
    background-color: #1c1d22;
    border-top-color: #2a2c33;
  }
}
</style>
