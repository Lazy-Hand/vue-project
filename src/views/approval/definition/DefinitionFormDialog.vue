<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Form, FormItem, Input, Modal, Select, Switch, TextArea, message } from 'antdv-next'
import type { FormInstance } from 'antdv-next'
import { PlusOutlined } from '@antdv-next/icons'

import { createApprovalDefinition, updateApprovalDefinition } from '@/api/approval'
import type {
  ApprovalAssigneeType,
  ApprovalDefinition,
  ApprovalNodeType,
  CreateApprovalDefinitionPayload,
} from '@/types/approval'
import { ApiRequestError } from '@/utils/request'
import ApprovalCanvas from './ApprovalCanvas.vue'

interface Props {
  open: boolean
  definition: ApprovalDefinition | null
}

const props = defineProps<Props>()
const emit = defineEmits<{ 'update:open': [value: boolean]; success: [] }>()

const { t } = useI18n()
const formRef = ref<FormInstance>()
const submitting = ref(false)
const selectedIndex = ref(0)

const isEdit = computed(() => Boolean(props.definition))

interface NodeForm {
  name: string
  type: ApprovalNodeType
  assigneeType: ApprovalAssigneeType
  assigneeValue: string
  allowTransfer: boolean
  allowAddSign: boolean
  allowReject: boolean
}

const formState = reactive<{
  code: string
  name: string
  category: string
  remark: string
  enabled: boolean
  nodes: NodeForm[]
}>({
  code: '',
  name: '',
  category: '',
  remark: '',
  enabled: true,
  nodes: [],
})

function createEmptyNode(): NodeForm {
  return {
    name: '',
    type: 'SEQ',
    assigneeType: 'USER',
    assigneeValue: '',
    allowTransfer: true,
    allowAddSign: false,
    allowReject: true,
  }
}

const nodeTypeOptions = computed(() => [
  { label: t('approval.definition.nodeTypeSeq'), value: 'SEQ' },
  { label: t('approval.definition.nodeTypeAndSign'), value: 'AND_SIGN' },
  { label: t('approval.definition.nodeTypeOrSign'), value: 'OR_SIGN' },
])

const assigneeTypeOptions = computed(() => [
  { label: t('approval.definition.assigneeTypeUser'), value: 'USER' },
  { label: t('approval.definition.assigneeTypeRole'), value: 'ROLE' },
  { label: t('approval.definition.assigneeTypePost'), value: 'POST' },
  { label: t('approval.definition.assigneeTypeDept'), value: 'DEPT' },
  { label: t('approval.definition.assigneeTypeDeptLeader'), value: 'DEPT_LEADER' },
])

const selectedNode = computed<NodeForm | null>(() => formState.nodes[selectedIndex.value] ?? null)

const canvasNodes = computed(() =>
  formState.nodes.map((n, idx) => ({
    label: n.name,
    type: n.type,
    assigneeType: n.assigneeType,
    assigneeValue: n.assigneeValue,
    allowTransfer: n.allowTransfer,
    allowAddSign: n.allowAddSign,
    allowReject: n.allowReject,
    selected: selectedIndex.value === idx,
    index: idx,
    onSelect: (index: number) => {
      selectedIndex.value = index
    },
    onAddAfter: (index: number) => insertAfter(index),
    onRemove: (index: number) => removeNode(index),
  })),
)

function resetForm(): void {
  if (props.definition) {
    formState.code = props.definition.code
    formState.name = props.definition.name
    formState.category = props.definition.category ?? ''
    formState.remark = props.definition.remark ?? ''
    formState.enabled = props.definition.enabled
    const nodes = props.definition.nodes ?? []
    formState.nodes =
      nodes.length > 0
        ? nodes.map((n) => ({
            name: n.name,
            type: n.type as ApprovalNodeType,
            assigneeType: n.assigneeType as ApprovalAssigneeType,
            assigneeValue: n.assigneeValue ?? '',
            allowTransfer: n.allowTransfer,
            allowAddSign: n.allowAddSign,
            allowReject: n.allowReject,
          }))
        : [createEmptyNode()]
  } else {
    formState.code = ''
    formState.name = ''
    formState.category = ''
    formState.remark = ''
    formState.enabled = true
    formState.nodes = [createEmptyNode()]
  }
  selectedIndex.value = 0
}

function addNode(): void {
  formState.nodes.push(createEmptyNode())
  selectedIndex.value = formState.nodes.length - 1
}

function insertAfter(index: number): void {
  formState.nodes.splice(index + 1, 0, createEmptyNode())
  selectedIndex.value = index + 1
}

function removeNode(index: number): void {
  if (formState.nodes.length <= 1) {
    void message.warning(t('approval.definition.nodesRequired'))
    return
  }
  formState.nodes.splice(index, 1)
  if (selectedIndex.value >= formState.nodes.length)
    selectedIndex.value = formState.nodes.length - 1
  if (selectedIndex.value < 0) selectedIndex.value = 0
}

function handleReorder(from: number, to: number): void {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= formState.nodes.length ||
    to >= formState.nodes.length
  )
    return
  const [moved] = formState.nodes.splice(from, 1)
  if (!moved) return
  formState.nodes.splice(to, 0, moved)
  if (selectedIndex.value === from) selectedIndex.value = to
  else if (selectedIndex.value > from && selectedIndex.value <= to) selectedIndex.value -= 1
  else if (selectedIndex.value < from && selectedIndex.value >= to) selectedIndex.value += 1
}

watch(
  () => props.open,
  (val) => {
    if (val) resetForm()
  },
)

async function handleSubmit(): Promise<void> {
  if (formState.nodes.length === 0) {
    message.warning(t('approval.definition.nodesRequired'))
    return
  }

  for (const node of formState.nodes) {
    if (!node.name.trim()) {
      message.warning(t('approval.definition.nodeNameRequired'))
      return
    }
    const needsValue =
      node.assigneeType === 'USER' ||
      node.assigneeType === 'ROLE' ||
      node.assigneeType === 'POST' ||
      node.assigneeType === 'DEPT'
    if (needsValue && !node.assigneeValue.trim()) {
      message.warning(t('approval.definition.assigneeValueRequired'))
      return
    }
  }

  if (!formState.code.trim()) {
    message.warning(t('approval.definition.codeRequired'))
    return
  }
  if (!formState.name.trim()) {
    message.warning(t('approval.definition.nameRequired'))
    return
  }

  submitting.value = true
  try {
    const payload: CreateApprovalDefinitionPayload = {
      code: formState.code.trim(),
      name: formState.name.trim(),
      category: formState.category.trim() || undefined,
      remark: formState.remark.trim() || undefined,
      enabled: formState.enabled,
      nodes: formState.nodes.map((n) => ({
        name: n.name.trim(),
        type: n.type,
        assigneeType: n.assigneeType,
        assigneeValue: n.assigneeValue.trim() || undefined,
        allowTransfer: n.allowTransfer,
        allowAddSign: n.allowAddSign,
        allowReject: n.allowReject,
      })),
    }

    if (isEdit.value && props.definition) {
      await updateApprovalDefinition(props.definition.id, {
        name: payload.name,
        category: payload.category,
        remark: payload.remark,
        enabled: payload.enabled,
        nodes: payload.nodes,
      })
      message.success(t('approval.definition.updateSuccess'))
    } else {
      await createApprovalDefinition(payload)
      message.success(t('approval.definition.createSuccess'))
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
    message.error(msg)
  } finally {
    submitting.value = false
  }
}

function handleCancel(): void {
  emit('update:open', false)
}

function getPopupContainer(triggerNode?: HTMLElement): HTMLElement {
  return triggerNode?.parentElement ?? document.body
}
</script>

<template>
  <Modal
    :open="open"
    width="1020px"
    destroy-on-hidden
    :confirm-loading="submitting"
    :get-container="false"
    @ok="handleSubmit"
    @cancel="handleCancel"
  >
    <template #title>
      <span>{{
        isEdit ? t('approval.definition.editTitle') : t('approval.definition.createTitle')
      }}</span>
    </template>

    <Form ref="formRef" :model="formState" layout="vertical" class="approval-canvas-form">
      <div class="grid grid-cols-3 gap-3">
        <FormItem :label="t('approval.definition.code')" required>
          <Input
            v-model:value="formState.code"
            :placeholder="t('approval.definition.codePlaceholder')"
            :disabled="isEdit"
            :maxlength="64"
          />
        </FormItem>
        <FormItem :label="t('approval.definition.name')" required>
          <Input
            v-model:value="formState.name"
            :placeholder="t('approval.definition.namePlaceholder')"
            :maxlength="64"
          />
        </FormItem>
        <FormItem :label="t('approval.definition.enabledLabel')">
          <Switch v-model:checked="formState.enabled" />
        </FormItem>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <FormItem :label="t('approval.definition.categoryLabel')">
          <Input
            v-model:value="formState.category"
            :placeholder="t('approval.definition.categoryLabelPlaceholder')"
            :maxlength="64"
          />
        </FormItem>
        <FormItem :label="t('approval.definition.remark')">
          <Input
            v-model:value="formState.remark"
            :placeholder="t('approval.definition.remarkPlaceholder')"
            :maxlength="255"
          />
        </FormItem>
      </div>

      <div class="approval-flow-section">
        <div class="approval-flow-section__header">
          <span class="text-sm font-medium text-slate-700">流程画布（@vue-flow）</span>
          <span class="text-xs text-slate-400">点击节点选中编辑 · 支持拖拽、缩放与小地图</span>
          <Button size="small" type="dashed" @click="addNode">
            <PlusOutlined />
            {{ t('approval.definition.addNode') }}
          </Button>
        </div>

        <ApprovalCanvas :nodes="canvasNodes" @reorder="handleReorder" />

        <div v-if="selectedNode" class="approval-flow-section__props">
          <div class="approval-flow-section__props-title">节点 #{{ selectedIndex + 1 }} 属性</div>
          <div class="grid grid-cols-3 gap-3">
            <FormItem :label="t('approval.definition.nodeNamePlaceholder')" required class="mb-2">
              <Input
                v-model:value="selectedNode.name"
                :placeholder="t('approval.definition.nodeNamePlaceholder')"
                :maxlength="64"
              />
            </FormItem>
            <FormItem :label="t('approval.definition.nodeType')" class="mb-2">
              <Select
                v-model:value="selectedNode.type"
                :options="nodeTypeOptions"
                :get-popup-container="getPopupContainer"
              />
            </FormItem>
            <FormItem :label="t('approval.definition.assigneeType')" class="mb-2">
              <Select
                v-model:value="selectedNode.assigneeType"
                :options="assigneeTypeOptions"
                :get-popup-container="getPopupContainer"
              />
            </FormItem>
          </div>
          <FormItem :label="t('approval.definition.assigneeValue')" class="mb-2">
            <TextArea
              v-model:value="selectedNode.assigneeValue"
              :placeholder="t('approval.definition.assigneeValuePlaceholder')"
              :rows="2"
              :maxlength="512"
              show-count
            />
          </FormItem>
          <div class="flex flex-wrap gap-4">
            <span class="flex items-center gap-1.5 text-sm text-slate-600">
              <Switch v-model:checked="selectedNode.allowTransfer" size="small" />
              {{ t('approval.definition.allowTransfer') }}
            </span>
            <span class="flex items-center gap-1.5 text-sm text-slate-600">
              <Switch v-model:checked="selectedNode.allowAddSign" size="small" />
              {{ t('approval.definition.allowAddSign') }}
            </span>
            <span class="flex items-center gap-1.5 text-sm text-slate-600">
              <Switch v-model:checked="selectedNode.allowReject" size="small" />
              {{ t('approval.definition.allowReject') }}
            </span>
          </div>
        </div>
      </div>
    </Form>
  </Modal>
</template>

<style scoped lang="scss">
.approval-canvas-form :deep(.ant-form-item) {
  margin-bottom: 12px;
}

.approval-flow-section {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
  overflow: hidden;
}

.approval-flow-section__header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
}

.approval-flow-section__props {
  margin: 0 12px 12px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 12px;
}

.approval-flow-section__props-title {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 8px;
}
</style>
