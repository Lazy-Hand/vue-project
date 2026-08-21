<script setup lang="ts">
import { computed, h, markRaw, onMounted, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Button,
  Drawer,
  Form,
  FormItem,
  Input,
  Select,
  Switch,
  TreeSelect,
  message,
} from 'antdv-next'
import {
  BranchesOutlined,
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
  SendOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
} from '@antdv-next/icons'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import {
  Handle,
  Position,
  VueFlow,
  useVueFlow,
  type Connection,
  type Edge,
  type EdgeMouseEvent,
  type Node,
} from '@vue-flow/core'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'

import { fetchDeptTree } from '@/api/dept'
import { fetchPosts } from '@/api/post'
import { fetchRoles } from '@/api/role'
import { fetchUserList } from '@/api/user'
import type { DeptTreeNode } from '@/types/dept'
import type {
  ApprovalAssigneeType,
  ApprovalNodeInput,
  ApprovalNodeType,
  FormFieldSchema,
} from '@/types/approval'

interface Props {
  nodes: ApprovalNodeInput[]
  formFields?: FormFieldSchema[]
}

const props = withDefaults(defineProps<Props>(), {
  formFields: () => [],
})

const emit = defineEmits<{
  'update:nodes': [value: ApprovalNodeInput[]]
}>()

const { t } = useI18n()
const selectedNodeIndex = ref<number | null>(0)
const drawerVisible = ref(false)

const userOptions = ref<{ label: string; value: string }[]>([])
const roleOptions = ref<{ label: string; value: string }[]>([])
const deptTreeData = ref<DeptTreeNode[]>([])
const postOptions = ref<{ label: string; value: string }[]>([])
const deptLoading = ref(false)

const userSearchKeyword = ref('')
const roleSearchKeyword = ref('')

async function loadUserOptions(keyword?: string): Promise<void> {
  try {
    const res = await fetchUserList({ page: 1, pageSize: 100, ...(keyword ? { keyword } : {}) })
    userOptions.value = (res.items ?? []).map((u) => ({
      label: `${u.nickname || u.username} (${u.username})`,
      value: String(u.id),
    }))
  } catch {
    // ignore
  }
}

async function loadRoleOptions(): Promise<void> {
  try {
    const roles = await fetchRoles()
    roleOptions.value = (roles ?? []).map((r) => ({
      label: `${r.name} (${r.code})`,
      value: String(r.id),
    }))
  } catch {
    // ignore
  }
}

async function loadDeptTree(): Promise<void> {
  deptLoading.value = true
  try {
    deptTreeData.value = await fetchDeptTree()
  } catch {
    deptTreeData.value = []
  } finally {
    deptLoading.value = false
  }
}

async function loadPostOptions(): Promise<void> {
  try {
    const posts = await fetchPosts()
    postOptions.value = (posts ?? []).map((p) => ({
      label: `${p.name} (${p.code})`,
      value: String(p.id),
    }))
  } catch {
    // ignore
  }
}

function handleUserSearch(val: string): void {
  userSearchKeyword.value = val
  void loadUserOptions(val.trim() || undefined)
}

const filteredUserOptions = computed(() => {
  const kw = userSearchKeyword.value.trim().toLowerCase()
  if (!kw) return userOptions.value
  return userOptions.value.filter((o) => o.label.toLowerCase().includes(kw))
})

const filteredRoleOptions = computed(() => {
  const kw = roleSearchKeyword.value.trim().toLowerCase()
  if (!kw) return roleOptions.value
  return roleOptions.value.filter((o) => o.label.toLowerCase().includes(kw))
})

onMounted(() => {
  void loadUserOptions()
  void loadRoleOptions()
  void loadDeptTree()
  void loadPostOptions()
})

const nodeTypeOptions = computed(() => [
  { label: t('approval.definition.nodeTypeSeq'), value: 'SEQ' },
  { label: t('approval.definition.nodeTypeAndSign'), value: 'AND_SIGN' },
  { label: t('approval.definition.nodeTypeOrSign'), value: 'OR_SIGN' },
  { label: t('approval.definition.nodeTypeCc'), value: 'CC' },
])

const assigneeTypeOptions = computed(() => [
  { label: t('approval.definition.assigneeTypeUser'), value: 'USER' },
  { label: t('approval.definition.assigneeTypeRole'), value: 'ROLE' },
  { label: t('approval.definition.assigneeTypeDept'), value: 'DEPT' },
  { label: t('approval.definition.assigneeTypeDeptLeader'), value: 'DEPT_LEADER' },
  { label: t('approval.definition.assigneeTypeInitiatorLeader'), value: 'INITIATOR_LEADER' },
  { label: t('approval.definition.assigneeTypeSelf'), value: 'SELF' },
])

const rejectTargetOptions = computed(() => [
  { label: t('approval.definition.rejectTargetInitiator'), value: 'INITIATOR' },
  { label: t('approval.definition.rejectTargetPrev'), value: 'PREV' },
])

const currentNode = computed<ApprovalNodeInput | null>(() => {
  if (selectedNodeIndex.value === null) return null
  return props.nodes[selectedNodeIndex.value] ?? null
})

function openNodeDrawer(index: number): void {
  selectedNodeIndex.value = index
  drawerVisible.value = true
}

function updateCurrentNode(patch: Partial<ApprovalNodeInput>): void {
  if (selectedNodeIndex.value === null) return
  const copy = [...props.nodes]
  const target = copy[selectedNodeIndex.value]
  if (!target) return
  copy[selectedNodeIndex.value] = { ...target, ...patch }
  emit('update:nodes', copy)
  resetEdges(copy, false)
}

function insertNode(
  index: number,
  type: ApprovalNodeType = 'SEQ',
  parallelGroup?: string,
  customName?: string,
): void {
  const newNode: ApprovalNodeInput = {
    name:
      customName ||
      (type === 'CC'
        ? '抄送人'
        : type === 'AND_SIGN'
          ? '会签专家'
          : type === 'OR_SIGN'
            ? '或签专员'
            : '审批人'),
    type,
    assigneeType: 'USER',
    assigneeValue: '',
    parallelGroup: parallelGroup || undefined,
    allowTransfer: true,
    allowAddSign: type === 'AND_SIGN',
    allowReject: type !== 'CC',
    rejectTarget: 'INITIATOR',
  }

  const copy = [...props.nodes]
  copy.splice(index + 1, 0, newNode)
  emit('update:nodes', copy)
  resetEdges(copy, true)
  openNodeDrawer(index + 1)
}

// 快速插入并行会签双分支
function insertParallelAndSignBranch(index: number): void {
  const groupKey = `and_group_${Date.now().toString().slice(-4)}`
  const nodeA: ApprovalNodeInput = {
    name: '技术专家会签 (分支A)',
    type: 'AND_SIGN',
    assigneeType: 'ROLE',
    assigneeValue: 'TECH_ARCHITECT',
    parallelGroup: groupKey,
    branchIndex: 0,
    allowTransfer: false,
    allowAddSign: true,
    allowReject: true,
  }
  const nodeB: ApprovalNodeInput = {
    name: '业务专家会签 (分支B)',
    type: 'AND_SIGN',
    assigneeType: 'ROLE',
    assigneeValue: 'BIZ_EXPERT',
    parallelGroup: groupKey,
    branchIndex: 1,
    allowTransfer: false,
    allowAddSign: true,
    allowReject: true,
  }

  const copy = [...props.nodes]
  copy.splice(index + 1, 0, nodeA, nodeB)
  emit('update:nodes', copy)
  resetEdges(copy, true)
  openNodeDrawer(index + 1)
  void message.success('已插入并行会签双分支')
}

// 快速插入并行或签双分支
function insertParallelOrSignBranch(index: number): void {
  const groupKey = `or_group_${Date.now().toString().slice(-4)}`
  const nodeA: ApprovalNodeInput = {
    name: '财务主管或签 (分支A)',
    type: 'OR_SIGN',
    assigneeType: 'ROLE',
    assigneeValue: 'FIN_MANAGER',
    parallelGroup: groupKey,
    branchIndex: 0,
    allowTransfer: true,
    allowAddSign: false,
    allowReject: true,
  }
  const nodeB: ApprovalNodeInput = {
    name: '风控主管或签 (分支B)',
    type: 'OR_SIGN',
    assigneeType: 'ROLE',
    assigneeValue: 'RISK_MANAGER',
    parallelGroup: groupKey,
    branchIndex: 1,
    allowTransfer: true,
    allowAddSign: false,
    allowReject: true,
  }

  const copy = [...props.nodes]
  copy.splice(index + 1, 0, nodeA, nodeB)
  emit('update:nodes', copy)
  resetEdges(copy, true)
  openNodeDrawer(index + 1)
  void message.success('已插入或签决策双分支')
}

function removeNode(index: number): void {
  if (props.nodes.length <= 1) {
    void message.warning(t('approval.definition.nodesRequired'))
    return
  }
  const copy = props.nodes.filter((_, i) => i !== index)
  emit('update:nodes', copy)
  resetEdges(copy, true)
  if (selectedNodeIndex.value === index) {
    selectedNodeIndex.value = Math.max(0, index - 1)
  }
}

// 拓扑层级计算接口
interface LayoutLayer {
  isParallel: boolean
  groupKey: string
  nodes: { node: ApprovalNodeInput; originalIndex: number }[]
}

function computeTopologyLayers(nodesList: ApprovalNodeInput[]): LayoutLayer[] {
  const layers: LayoutLayer[] = []
  let currentLayer: LayoutLayer | null = null

  nodesList.forEach((node, idx) => {
    const isAnd = node.type === 'AND_SIGN'
    const isOr = node.type === 'OR_SIGN'
    const explicitGroup =
      node.parallelGroup ||
      (node.assigneeConfig as { parallelGroup?: string } | undefined)?.parallelGroup

    // 如果有明确的 parallelGroup，且与上一层相同，则合并入上一层
    if (explicitGroup) {
      if (currentLayer && currentLayer.groupKey === explicitGroup) {
        currentLayer.nodes.push({ node, originalIndex: idx })
        return
      }
      currentLayer = {
        isParallel: true,
        groupKey: explicitGroup,
        nodes: [{ node, originalIndex: idx }],
      }
      layers.push(currentLayer)
      return
    }

    // 如果是 AND_SIGN 或 OR_SIGN，且上一层也是同类型的会签/或签，则自动合并为并行分支层
    if (
      (isAnd || isOr) &&
      currentLayer &&
      currentLayer.isParallel &&
      currentLayer.groupKey.startsWith(node.type || '')
    ) {
      currentLayer.nodes.push({ node, originalIndex: idx })
      return
    }

    // 独立单节点层
    currentLayer = {
      isParallel: isAnd || isOr,
      groupKey: `${node.type || 'SEQ'}_${idx}`,
      nodes: [{ node, originalIndex: idx }],
    }
    layers.push(currentLayer)
  })

  return layers
}

// Vue Flow Node Views with multi-direction Handle dots
const FlowNodeView = markRaw({
  props: {
    data: { type: Object, required: true },
  },
  setup(nodeProps: {
    data: {
      node: ApprovalNodeInput
      index: number
      isSelected: boolean
      isParallel: boolean
      branchIndex: number
      branchCount: number
    }
  }) {
    return () => {
      const { node, index, isSelected, isParallel, branchIndex, branchCount } = nodeProps.data
      const isCc = node.type === 'CC'
      const isAnd = node.type === 'AND_SIGN'
      const isOr = node.type === 'OR_SIGN'

      let headerClass = 'bg-blue-600 text-white'
      let typeText = '审批'
      let borderClass = 'border-slate-200'

      if (isCc) {
        headerClass = 'bg-teal-600 text-white'
        typeText = '抄送'
        borderClass = 'border-teal-200 border-dashed'
      } else if (isAnd) {
        headerClass = 'bg-purple-600 text-white'
        typeText = '会签 (全员同意)'
        borderClass = 'border-purple-300'
      } else if (isOr) {
        headerClass = 'bg-amber-600 text-white'
        typeText = '或签 (任一通过)'
        borderClass = 'border-amber-300'
      }

      return h(
        'div',
        {
          class: [
            'w-56 bg-white border-2 rounded-xl shadow-xs cursor-pointer transition-all relative group',
            borderClass,
            isSelected
              ? '!border-blue-500 ring-2 ring-blue-200 shadow-md'
              : 'hover:border-slate-300',
          ],
          onClick: () => openNodeDrawer(index),
        },
        [
          // Top Input Handle (Target)
          h(Handle, {
            type: 'target',
            position: Position.Top,
            class:
              'w-3.5 h-3.5 !bg-blue-500 hover:!bg-blue-600 !border-2 !border-white rounded-full transition-transform hover:scale-125 cursor-crosshair shadow-xs',
          }),
          // Header
          h(
            'div',
            {
              class: [
                'px-3 py-1.5 flex items-center justify-between text-xs font-semibold rounded-t-lg',
                headerClass,
              ],
            },
            [
              h('span', { class: 'truncate flex-1' }, node.name || '未命名节点'),
              h(
                'span',
                { class: 'text-2xs bg-white/25 px-1.5 py-0.5 rounded shrink-0 ml-1' },
                typeText,
              ),
            ],
          ),
          // Parallel Branch Badge
          isParallel
            ? h(
                'div',
                {
                  class:
                    'absolute -top-2.5 right-2 bg-slate-800 text-white text-3xs font-mono px-1.5 py-0.2 rounded-full shadow-xs border border-white',
                },
                `分支 ${branchIndex}/${branchCount}`,
              )
            : null,
          // Body
          h('div', { class: 'p-2.5 text-xs text-slate-600 space-y-1' }, [
            h('div', { class: 'flex items-center gap-1.5 text-slate-700 font-medium' }, [
              h(UserOutlined, { class: 'text-xs text-slate-400' }),
              h('span', {}, `${node.assigneeType || 'USER'}`),
            ]),
            h(
              'div',
              { class: 'text-2xs text-slate-400 truncate' },
              node.assigneeValue?.trim()
                ? `审批对象: ${node.assigneeValue}`
                : '未指定人员（默认部门主管）',
            ),
          ]),
          // Actions bar
          h(
            'div',
            {
              class:
                'px-3 py-1.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between rounded-b-lg',
            },
            [
              h(
                'button',
                {
                  type: 'button',
                  class:
                    'text-2xs text-blue-600 hover:underline flex items-center gap-1 cursor-pointer',
                  onClick: (e: MouseEvent) => {
                    e.stopPropagation()
                    openNodeDrawer(index)
                  },
                },
                [h(SettingOutlined), '设置'],
              ),
              h(
                'button',
                {
                  type: 'button',
                  class:
                    'text-2xs text-red-500 hover:underline flex items-center gap-1 cursor-pointer',
                  onClick: (e: MouseEvent) => {
                    e.stopPropagation()
                    removeNode(index)
                  },
                },
                [h(DeleteOutlined), '删除'],
              ),
            ],
          ),
          // Bottom Output Handle (Source)
          h(Handle, {
            type: 'source',
            position: Position.Bottom,
            class:
              'w-3.5 h-3.5 !bg-blue-500 hover:!bg-blue-600 !border-2 !border-white rounded-full transition-transform hover:scale-125 cursor-crosshair shadow-xs',
          }),
        ],
      )
    }
  },
})

const FlowStartView = markRaw({
  setup() {
    return () =>
      h(
        'div',
        {
          class:
            'w-48 bg-emerald-50 border-2 border-emerald-500 rounded-xl p-3 text-center shadow-xs cursor-default relative',
        },
        [
          h('div', { class: 'text-xs font-bold text-emerald-800' }, '发起人节点'),
          h('div', { class: 'text-2xs text-emerald-600 mt-0.5' }, '全体成员可提交申请'),
          h(Handle, {
            type: 'source',
            position: Position.Bottom,
            class:
              'w-3.5 h-3.5 !bg-emerald-500 hover:!bg-emerald-600 !border-2 !border-white rounded-full transition-transform hover:scale-125 cursor-crosshair shadow-xs',
          }),
        ],
      )
  },
})

const FlowEndView = markRaw({
  setup() {
    return () =>
      h(
        'div',
        {
          class:
            'w-36 bg-slate-100 border border-slate-300 rounded-xl p-2 text-center shadow-2xs cursor-default relative',
        },
        [
          h(Handle, {
            type: 'target',
            position: Position.Top,
            class:
              'w-3.5 h-3.5 !bg-slate-500 hover:!bg-slate-600 !border-2 !border-white rounded-full transition-transform hover:scale-125 cursor-crosshair shadow-xs',
          }),
          h('div', { class: 'text-xs font-semibold text-slate-600' }, '流程结束'),
        ],
      )
  },
})

const nodeTypes = {
  flowNode: FlowNodeView,
  startNode: FlowStartView,
  endNode: FlowEndView,
}

const { fitView, onPaneReady } = useVueFlow()
const isPaneReady = ref(false)

onPaneReady(() => {
  isPaneReady.value = true
  setTimeout(() => {
    try {
      void fitView({ padding: 0.2 })
    } catch {
      // ignore if tab hidden
    }
  }, 100)
})

const customEdges = shallowRef<Edge[]>([])

function buildDefaultEdges(nodesList: ApprovalNodeInput[]): Edge[] {
  const edges: Edge[] = []
  const layers = computeTopologyLayers(nodesList)
  if (layers.length === 0) {
    edges.push({
      id: 'edge-start-end',
      source: 'start-node',
      target: 'end-node',
      animated: true,
      style: { stroke: '#3b82f6', strokeWidth: 2 },
    })
    return edges
  }

  // 1. Start Node -> Layer 0
  const firstLayer = layers[0]
  if (firstLayer) {
    firstLayer.nodes.forEach((item) => {
      edges.push({
        id: `edge-start-node-${item.originalIndex}`,
        source: 'start-node',
        target: `node-${item.originalIndex}`,
        animated: true,
        type: firstLayer.nodes.length > 1 ? 'smoothstep' : 'default',
        style: { stroke: '#10b981', strokeWidth: 2 },
      })
    })
  }

  // 2. Layer i -> Layer i+1 (支持分流 Fork 与汇聚 Join)
  for (let i = 0; i < layers.length - 1; i++) {
    const fromLayer = layers[i]
    const toLayer = layers[i + 1]
    if (!fromLayer || !toLayer) continue

    fromLayer.nodes.forEach((fromItem) => {
      toLayer.nodes.forEach((toItem) => {
        const targetType = toItem.node.type
        let stroke = '#3b82f6'
        if (targetType === 'AND_SIGN') stroke = '#722ed1'
        else if (targetType === 'OR_SIGN') stroke = '#fa8c16'
        else if (targetType === 'CC') stroke = '#13c2c2'

        edges.push({
          id: `edge-${fromItem.originalIndex}-${toItem.originalIndex}`,
          source: `node-${fromItem.originalIndex}`,
          target: `node-${toItem.originalIndex}`,
          animated: true,
          type: fromLayer.nodes.length > 1 || toLayer.nodes.length > 1 ? 'smoothstep' : 'default',
          style: { stroke, strokeWidth: 2 },
        })
      })
    })
  }

  // 3. Last Layer -> End Node
  const lastLayer = layers[layers.length - 1]
  if (lastLayer) {
    lastLayer.nodes.forEach((item) => {
      edges.push({
        id: `edge-${item.originalIndex}-end-node`,
        source: `node-${item.originalIndex}`,
        target: 'end-node',
        animated: true,
        type: lastLayer.nodes.length > 1 ? 'smoothstep' : 'default',
        style: { stroke: '#64748b', strokeWidth: 2 },
      })
    })
  }

  return edges
}

function resetEdges(nodesList = props.nodes, shouldFit = false): void {
  customEdges.value = buildDefaultEdges(nodesList)
  if (shouldFit && isPaneReady.value) {
    setTimeout(() => {
      try {
        void fitView({ padding: 0.2 })
      } catch {
        // ignore
      }
    }, 60)
  }
}

// 智能拓扑坐标计算
const flowNodes = computed<Node[]>(() => {
  const list: Node[] = []
  const centerX = 380
  let currentY = 30
  const nodeWidth = 230
  const nodeGapX = 50
  const layerGapY = 160

  // Start Node
  list.push({
    id: 'start-node',
    type: 'startNode',
    position: { x: centerX - 96, y: currentY },
    data: {},
    draggable: true,
    selectable: false,
  })

  currentY += 95

  // Layers
  const layers = computeTopologyLayers(props.nodes)

  layers.forEach((layer) => {
    const k = layer.nodes.length
    const totalWidth = k * nodeWidth + (k - 1) * nodeGapX
    const startX = centerX - totalWidth / 2

    layer.nodes.forEach((item, j) => {
      const nodeX = startX + j * (nodeWidth + nodeGapX)
      list.push({
        id: `node-${item.originalIndex}`,
        type: 'flowNode',
        position: { x: item.node.x ?? nodeX, y: item.node.y ?? currentY },
        data: {
          node: item.node,
          index: item.originalIndex,
          isSelected: selectedNodeIndex.value === item.originalIndex,
          isParallel: k > 1,
          branchIndex: j + 1,
          branchCount: k,
        },
        draggable: true,
        selectable: false,
      })
    })

    currentY += layerGapY
  })

  // End Node
  list.push({
    id: 'end-node',
    type: 'endNode',
    position: { x: centerX - 72, y: currentY },
    data: {},
    draggable: true,
    selectable: false,
  })

  return list
})

function handleConnect(params: Connection): void {
  if (!params.source || !params.target || params.source === params.target) return

  const exists = customEdges.value.some(
    (e) => e.source === params.source && e.target === params.target,
  )
  if (exists) {
    void message.info('连线已存在')
    return
  }

  const newEdge: Edge = {
    id: `edge-${params.source}-${params.target}-${Date.now().toString().slice(-4)}`,
    source: params.source,
    target: params.target,
    animated: true,
    type: 'smoothstep',
    style: { stroke: '#3b82f6', strokeWidth: 2 },
  }

  customEdges.value = [...customEdges.value, newEdge]
  void message.success('已成功建立节点连线')
}

function handleEdgeClick(event: EdgeMouseEvent): void {
  const clickedEdge = event.edge
  customEdges.value = customEdges.value.filter((e) => e.id !== clickedEdge.id)
  void message.success('已删除连线')
}

watch(
  () => props.nodes.length,
  (newLen, oldLen) => {
    resetEdges(props.nodes, Boolean(oldLen))
  },
  { immediate: true },
)
</script>

<template>
  <div
    class="flow-designer-tab relative h-[580px] border border-slate-200 rounded-xl overflow-hidden bg-slate-50"
  >
    <!-- 顶部拓扑工具条 -->
    <div
      class="absolute top-3 left-3 z-10 bg-white/95 backdrop-blur-xs p-1.5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-2"
    >
      <div class="flex items-center gap-1.5 pr-2 border-r border-slate-200">
        <Button
          size="small"
          type="primary"
          class="text-xs"
          @click="insertNode(props.nodes.length - 1, 'SEQ')"
        >
          <PlusOutlined />
          {{ t('approval.definition.addApprover') }}
        </Button>
        <Button
          size="small"
          class="text-xs !bg-purple-50 !text-purple-700 !border-purple-300 hover:!bg-purple-100"
          @click="insertParallelAndSignBranch(props.nodes.length - 1)"
        >
          <TeamOutlined />
          + 会签分支 (并行2路)
        </Button>
        <Button
          size="small"
          class="text-xs !bg-amber-50 !text-amber-700 !border-amber-300 hover:!bg-amber-100"
          @click="insertParallelOrSignBranch(props.nodes.length - 1)"
        >
          <BranchesOutlined />
          + 或签分支 (并行2路)
        </Button>
        <Button
          size="small"
          class="text-xs !bg-teal-50 !text-teal-700 !border-teal-300 hover:!bg-teal-100"
          @click="insertNode(props.nodes.length - 1, 'CC')"
        >
          <SendOutlined />
          {{ t('approval.definition.addCc') }}
        </Button>
      </div>

      <Button size="small" class="text-xs" @click="resetEdges(props.nodes, true)">
        <ReloadOutlined />
        重置智能拓扑
      </Button>
    </div>

    <!-- 画布主体 -->
    <VueFlow
      :nodes="flowNodes"
      :edges="customEdges"
      :node-types="nodeTypes"
      :nodes-draggable="true"
      :nodes-connectable="true"
      :elements-selectable="true"
      :snap-to-grid="true"
      :snap-grid="[15, 15]"
      :default-viewport="{ zoom: 0.85 }"
      :min-zoom="0.3"
      :max-zoom="2"
      class="h-full w-full"
      @connect="handleConnect"
      @edge-click="handleEdgeClick"
    >
      <Background :gap="16" color="#cbd5e1" />
      <Controls position="bottom-left" />
      <MiniMap position="bottom-right" />
    </VueFlow>

    <!-- 节点属性抽屉 -->
    <Drawer
      v-model:open="drawerVisible"
      :title="currentNode?.name || '节点设置'"
      :size="400"
      destroy-on-hidden
    >
      <Form v-if="currentNode" layout="vertical" class="py-2">
        <FormItem :label="t('approval.definition.nodeName')" required>
          <Input
            :value="currentNode.name"
            :placeholder="t('approval.definition.nodeNamePlaceholder')"
            @update:value="(val) => updateCurrentNode({ name: String(val) })"
          />
        </FormItem>

        <FormItem :label="t('approval.definition.nodeType')">
          <Select
            :value="currentNode.type || 'SEQ'"
            :options="nodeTypeOptions"
            @update:value="(val) => updateCurrentNode({ type: val as ApprovalNodeType })"
          />
        </FormItem>

        <FormItem label="并行分支分组标识 (相同分组将并排分流)">
          <Input
            :value="currentNode.parallelGroup || ''"
            placeholder="如 tech_and_sign，相同分组并排展示"
            @update:value="
              (val) => updateCurrentNode({ parallelGroup: String(val).trim() || undefined })
            "
          />
        </FormItem>

        <FormItem :label="t('approval.definition.assigneeType')">
          <Select
            :value="currentNode.assigneeType"
            :options="assigneeTypeOptions"
            @update:value="
              (val) => updateCurrentNode({ assigneeType: val as ApprovalAssigneeType })
            "
          />
        </FormItem>

        <FormItem
          v-if="currentNode.assigneeType === 'USER'"
          :label="t('approval.definition.assigneeValue')"
          required
        >
          <Select
            :value="
              currentNode.assigneeValue
                ? currentNode.assigneeValue
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
                : []
            "
            :options="filteredUserOptions"
            mode="multiple"
            allow-clear
            show-search
            :filter-option="false"
            :placeholder="t('approval.definition.assigneeValuePlaceholder')"
            @update:value="
              (val) => updateCurrentNode({ assigneeValue: (val as string[]).join(',') })
            "
            @search="handleUserSearch"
          />
        </FormItem>

        <FormItem
          v-else-if="currentNode.assigneeType === 'ROLE'"
          :label="t('approval.definition.assigneeValue')"
          required
        >
          <Select
            :value="
              currentNode.assigneeValue
                ? currentNode.assigneeValue
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
                : []
            "
            :options="filteredRoleOptions"
            mode="multiple"
            allow-clear
            show-search
            :filter-option="false"
            :placeholder="t('approval.definition.assigneeValuePlaceholder')"
            @update:value="
              (val) => updateCurrentNode({ assigneeValue: (val as string[]).join(',') })
            "
            @search="(val: string) => (roleSearchKeyword = val)"
          />
        </FormItem>

        <FormItem
          v-else-if="currentNode.assigneeType === 'DEPT'"
          :label="t('approval.definition.assigneeValue')"
          required
        >
          <TreeSelect
            :value="
              currentNode.assigneeValue
                ? currentNode.assigneeValue
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
                : []
            "
            :tree-data="deptTreeData"
            :field-names="{ label: 'name', value: 'id', children: 'children' }"
            multiple
            allow-clear
            tree-checkable
            tree-check-strictly
            tree-default-expand-all
            :placeholder="t('approval.definition.assigneeValuePlaceholder')"
            :loading="deptLoading"
            @update:value="
              (val) => {
                const ids: string[] = Array.isArray(val)
                  ? val.map((item) =>
                      typeof item === 'object' && item !== null && 'value' in item
                        ? String((item as { value: string }).value)
                        : String(item),
                    )
                  : val
                    ? [String(val)]
                    : []
                const unique = [...new Set(ids.map((s) => s.trim()).filter(Boolean))]
                updateCurrentNode({ assigneeValue: unique.join(',') })
              }
            "
          />
        </FormItem>

        <FormItem
          v-else-if="currentNode.assigneeType === 'POST'"
          :label="t('approval.definition.assigneeValue')"
          required
        >
          <Select
            :value="
              currentNode.assigneeValue
                ? currentNode.assigneeValue
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
                : []
            "
            :options="postOptions"
            mode="multiple"
            allow-clear
            show-search
            :filter-option="
              (input: string, option: { label: string }) =>
                option.label.toLowerCase().includes(input.toLowerCase())
            "
            :placeholder="t('approval.definition.assigneeValuePlaceholder')"
            @update:value="
              (val) => updateCurrentNode({ assigneeValue: (val as string[]).join(',') })
            "
          />
        </FormItem>

        <div
          v-else-if="['DEPT_LEADER', 'INITIATOR_LEADER', 'SELF'].includes(currentNode.assigneeType)"
          class="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-2.5"
        >
          {{
            currentNode.assigneeType === 'DEPT_LEADER'
              ? '部门主管将自动解析为发起人直属部门的主管（无需填写）'
              : currentNode.assigneeType === 'INITIATOR_LEADER'
                ? '直属上级将自动解析为发起人上级部门的主管（无需填写）'
                : '本人节点将自动指向发起人自己（无需填写）'
          }}
        </div>

        <div v-if="currentNode.type !== 'CC'" class="pt-3 border-t border-slate-100 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-slate-700">{{
              t('approval.definition.allowTransfer')
            }}</span>
            <Switch
              :checked="currentNode.allowTransfer ?? true"
              size="small"
              @update:checked="(val) => updateCurrentNode({ allowTransfer: Boolean(val) })"
            />
          </div>

          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-slate-700">{{
              t('approval.definition.allowAddSign')
            }}</span>
            <Switch
              :checked="currentNode.allowAddSign ?? false"
              size="small"
              @update:checked="(val) => updateCurrentNode({ allowAddSign: Boolean(val) })"
            />
          </div>

          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-slate-700">{{
              t('approval.definition.allowReject')
            }}</span>
            <Switch
              :checked="currentNode.allowReject ?? true"
              size="small"
              @update:checked="(val) => updateCurrentNode({ allowReject: Boolean(val) })"
            />
          </div>

          <FormItem
            v-if="currentNode.allowReject"
            :label="t('approval.definition.rejectTarget')"
            class="!mt-2"
          >
            <Select
              :value="currentNode.rejectTarget || 'INITIATOR'"
              :options="rejectTargetOptions"
              @update:value="(val) => updateCurrentNode({ rejectTarget: String(val) })"
            />
          </FormItem>
        </div>
      </Form>
    </Drawer>
  </div>
</template>

<style scoped lang="scss">
.flow-designer-tab {
  :deep(.vue-flow__edge-path) {
    stroke-linecap: round;
  }
}
</style>
