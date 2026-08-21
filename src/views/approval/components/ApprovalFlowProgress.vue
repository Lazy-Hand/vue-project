<script setup lang="ts">
import { computed, h, markRaw, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Tag } from 'antdv-next'
import { UserOutlined } from '@antdv-next/icons'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { Handle, Position, VueFlow, useVueFlow, type Edge, type Node } from '@vue-flow/core'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/controls/dist/style.css'

import type { ApprovalInstanceStatus, ApprovalTaskStatus } from '@/types/approval'

/** flowSnapshot.nodes 中一个节点的结构（后端快照已补全拓扑字段）。 */
interface SnapshotNode {
  nodeKey?: string | null
  name?: string | null
  sort?: number | null
  type?: string | null
  assigneeType?: string | null
  assigneeValue?: string | null
  assigneeConfig?: Record<string, unknown> | null
  rejectTarget?: string | null
}

interface Props {
  nodes?: SnapshotNode[] | null
  tasks?: { nodeKey?: string | null; status: ApprovalTaskStatus }[] | null
  currentNodeKey?: string | null
  status: ApprovalInstanceStatus
}

const props = withDefaults(defineProps<Props>(), {
  nodes: () => [],
  tasks: () => [],
  currentNodeKey: null,
})

const { t } = useI18n()

type FlowStepState = 'done' | 'current' | 'upcoming' | 'rejected' | 'cancelled'

// ---------- 进度状态计算 ----------

/** 并行分支分组：显式 parallelGroup 优先，其次按相邻同类型会签/或签自动合并。 */
function groupKeyOf(node: SnapshotNode): { group: string; hasGroup: boolean } {
  const cfg = node.assigneeConfig as { parallelGroup?: string } | null | undefined
  const explicit =
    node.type === 'AND_SIGN' || node.type === 'OR_SIGN' ? cfg?.parallelGroup : undefined
  if (explicit) return { group: explicit, hasGroup: true }
  return { group: `${node.type ?? 'SEQ'}`, hasGroup: false }
}

interface Layer {
  isParallel: boolean
  groupKey: string
  nodes: { node: SnapshotNode; originalIndex: number }[]
}

function computeTopologyLayers(nodesList: SnapshotNode[]): Layer[] {
  const layers: Layer[] = []
  let currentLayer: Layer | null = null

  nodesList.forEach((node, idx) => {
    const { group, hasGroup } = groupKeyOf(node)

    if (hasGroup) {
      if (currentLayer && currentLayer.groupKey === group) {
        currentLayer.nodes.push({ node, originalIndex: idx })
        return
      }
      currentLayer = { isParallel: true, groupKey: group, nodes: [{ node, originalIndex: idx }] }
      layers.push(currentLayer)
      return
    }

    if ((node.type === 'AND_SIGN' || node.type === 'OR_SIGN') && currentLayer?.isParallel) {
      currentLayer.nodes.push({ node, originalIndex: idx })
      return
    }

    currentLayer = { isParallel: true, groupKey: group, nodes: [{ node, originalIndex: idx }] }
    layers.push(currentLayer)
  })

  return layers
}

const orderedNodes = computed<SnapshotNode[]>(() =>
  [...(props.nodes ?? [])].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)),
)

const stepStates = computed<Map<string | null, FlowStepState>>(() => {
  const map = new Map<string | null, FlowStepState>()
  const nodesList = orderedNodes.value

  if (nodesList.length === 0) return map

  if (props.status === 'APPROVED') {
    for (const n of nodesList) map.set(n.nodeKey ?? null, 'done')
    return map
  }
  if (props.status === 'CANCELLED') {
    for (const n of nodesList) map.set(n.nodeKey ?? null, 'cancelled')
    return map
  }

  const taskCountByNode = new Map<string | null, number>()
  const pendingByNode = new Map<string | null, number>()
  const rejectedByNode = new Map<string | null, boolean>()

  for (const task of props.tasks ?? []) {
    const key = task.nodeKey ?? null
    taskCountByNode.set(key, (taskCountByNode.get(key) ?? 0) + 1)
    if (task.status === 'PENDING') pendingByNode.set(key, (pendingByNode.get(key) ?? 0) + 1)
    if (task.status === 'REJECTED') rejectedByNode.set(key, true)
  }

  const isRejected = props.status === 'REJECTED'

  for (const n of nodesList) {
    const key = n.nodeKey ?? null
    const total = taskCountByNode.get(key) ?? 0
    const pending = pendingByNode.get(key) ?? 0

    if (total > 0) {
      if (rejectedByNode.get(key) && (isRejected || pending === total)) {
        map.set(key, 'rejected')
      } else if (pending > 0) {
        map.set(key, 'current')
      } else {
        map.set(key, 'done')
      }
      continue
    }

    if (props.currentNodeKey === key) {
      map.set(key, 'current')
    } else {
      map.set(key, 'upcoming')
    }
  }

  return map
})

function stateOf(node: SnapshotNode): FlowStepState {
  return stepStates.value.get(node.nodeKey ?? null) ?? 'upcoming'
}

const hasFlow = computed(() => orderedNodes.value.length > 0)

const currentIndex = computed(() => {
  const idx = orderedNodes.value.findIndex((n) => stateOf(n) === 'current')
  return idx === -1 ? null : idx
})

const instanceLabel = computed(() => {
  switch (props.status) {
    case 'APPROVED':
      return t('approval.instance.statusApproved')
    case 'REJECTED':
      return t('approval.instance.statusRejected')
    case 'CANCELLED':
      return t('approval.instance.statusCancelled')
    default:
      return t('approval.instance.statusPending')
  }
})

const instanceTagColor = computed(() => {
  switch (props.status) {
    case 'APPROVED':
      return 'success'
    case 'REJECTED':
      return 'error'
    case 'CANCELLED':
      return 'default'
    default:
      return 'processing'
  }
})

function stateText(state: FlowStepState): string {
  switch (state) {
    case 'done':
      return t('approval.instance.statusApproved')
    case 'current':
      return t('approval.instance.statusPending')
    case 'rejected':
      return t('approval.instance.statusRejected')
    case 'cancelled':
      return t('approval.instance.statusCancelled')
    default:
      return t('approval.instance.taskPending')
  }
}

// ---------- @vue-flow 拓扑布局（只读，照搬设计器算法） ----------

const { fitView, onPaneReady } = useVueFlow()
const isPaneReady = ref(false)

onPaneReady(() => {
  isPaneReady.value = true
  setTimeout(() => {
    try {
      void fitView({ padding: 0.2 })
    } catch {
      // ignore
    }
  }, 80)
})

watch(
  () => [orderedNodes.value.length, stepStates.value],
  () => {
    if (isPaneReady.value) {
      setTimeout(() => {
        try {
          void fitView({ padding: 0.2 })
        } catch {
          // ignore
        }
      }, 60)
    }
  },
  { deep: true },
)

function edgeState(): 'done' | 'active' {
  if (props.status === 'APPROVED' || props.status === 'REJECTED') return 'done'
  return 'active'
}

/** 构造与前两态对应的边样式：当前链路亮色，已完成/终态灰色。 */
function strokeFor(type: string | null | undefined, state: 'done' | 'active'): string {
  const key = type ?? 'SEQ'
  const palette: Record<string, { done: string; active: string }> = {
    SEQ: { done: '#cbd5e1', active: '#3b82f6' },
    AND_SIGN: { done: '#c4b5fd', active: '#722ed1' },
    OR_SIGN: { done: '#fcd34d', active: '#fa8c16' },
    CC: { done: '#cbd5e1', active: '#13c2c2' },
  }
  return palette[key]?.[state] ?? '#3b82f6'
}

const flowEdges = computed<Edge[]>(() => {
  const edges: Edge[] = []
  const layers = computeTopologyLayers(orderedNodes.value)
  const state = edgeState()
  if (layers.length === 0) {
    edges.push({
      id: 'edge-start-end',
      source: 'start-node',
      target: 'end-node',
      animated: state === 'active',
      style: { stroke: '#94a3b8', strokeWidth: 2 },
    })
    return edges
  }

  const firstLayer = layers[0]
  if (firstLayer) {
    for (const item of firstLayer.nodes) {
      edges.push({
        id: `edge-start-node-${item.originalIndex}`,
        source: 'start-node',
        target: `node-${item.originalIndex}`,
        animated: state === 'active',
        type: firstLayer.nodes.length > 1 ? 'smoothstep' : 'default',
        style: {
          stroke: '#10b981',
          strokeWidth: 2,
          strokeDasharray: state === 'done' ? '4 2' : undefined,
        },
      })
    }
  }

  for (let i = 0; i < layers.length - 1; i++) {
    const fromLayer = layers[i]
    const toLayer = layers[i + 1]
    if (!fromLayer || !toLayer) continue

    fromLayer.nodes.forEach((fromItem) => {
      toLayer.nodes.forEach((toItem) => {
        edges.push({
          id: `edge-${fromItem.originalIndex}-${toItem.originalIndex}`,
          source: `node-${fromItem.originalIndex}`,
          target: `node-${toItem.originalIndex}`,
          animated: state === 'active',
          type: fromLayer.nodes.length > 1 || toLayer.nodes.length > 1 ? 'smoothstep' : 'default',
          style: {
            stroke: strokeFor(toItem.node.type, state),
            strokeWidth: 2,
            strokeDasharray: state === 'done' ? '4 2' : undefined,
          },
        })
      })
    })
  }

  const lastLayer = layers[layers.length - 1]
  if (lastLayer) {
    for (const item of lastLayer.nodes) {
      edges.push({
        id: `edge-${item.originalIndex}-end-node`,
        source: `node-${item.originalIndex}`,
        target: 'end-node',
        animated: state === 'active',
        type: lastLayer.nodes.length > 1 ? 'smoothstep' : 'default',
        style: { stroke: '#64748b', strokeWidth: 2 },
      })
    }
  }

  return edges
})

// ---------- 自定义节点视图（只读 + 进度高亮） ----------

function typeText(node: SnapshotNode): string {
  switch (node.type) {
    case 'AND_SIGN':
      return t('approval.definition.nodeTypeAndSign')
    case 'OR_SIGN':
      return t('approval.definition.nodeTypeOrSign')
    case 'CC':
      return t('approval.definition.nodeTypeCc')
    default:
      return t('approval.definition.nodeTypeSeq')
  }
}

function nodeShell(state: FlowStepState): string {
  switch (state) {
    case 'current':
      return 'border-emerald-500 ring-2 ring-emerald-200 shadow-md'
    case 'done':
      return 'border-slate-300 bg-slate-100'
    case 'rejected':
      return 'border-red-400 ring-1 ring-red-200 bg-red-50'
    case 'cancelled':
      return 'border-slate-200 bg-slate-50 opacity-70'
    default:
      return 'border-slate-200'
  }
}

const approvalNodeView = markRaw({
  props: {
    data: { type: Object, required: true },
    id: { type: String, required: true },
  },
  setup(nodeProps: { data: Record<string, unknown>; id: string }) {
    return () => {
      const node = nodeProps.data['node'] as SnapshotNode
      const state = nodeProps.data['state'] as FlowStepState
      const isParallel = Boolean(nodeProps.data['isParallel'])
      const branchIndex = Number(nodeProps.data['branchIndex'] ?? 0)
      const branchCount = Number(nodeProps.data['branchCount'] ?? 0)
      const name = String(node.name ?? node.nodeKey ?? t('approval.definition.unnamedColumn'))

      const headBar =
        state === 'current'
          ? 'bg-emerald-600 text-white'
          : state === 'done'
            ? 'bg-slate-300 text-slate-600'
            : state === 'rejected'
              ? 'bg-red-500 text-white'
              : state === 'cancelled'
                ? 'bg-slate-200 text-slate-400'
                : 'bg-blue-600 text-white'

      return h(
        'div',
        {
          class: `w-56 bg-white border-2 rounded-xl shadow-xs relative ${nodeShell(state)}`,
        },
        [
          h(Handle, {
            type: 'target',
            position: Position.Top,
            class: 'w-3.5 h-3.5 !bg-slate-400 !border-2 !border-white rounded-full cursor-default',
          }),
          h(
            'div',
            {
              class: `px-3 py-1.5 flex items-center justify-between text-xs font-semibold rounded-t-lg ${headBar}`,
            },
            [
              h('span', { class: 'truncate flex-1' }, name),
              h(
                'span',
                { class: 'text-2xs bg-white/25 px-1.5 py-0.5 rounded shrink-0 ml-1' },
                typeText(node),
              ),
            ],
          ),
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
          h('div', { class: 'p-2.5 text-xs text-slate-600 space-y-1' }, [
            h('div', { class: 'flex items-center gap-1.5 text-slate-700 font-medium' }, [
              h(UserOutlined, { class: 'text-xs text-slate-400' }),
              h('span', {}, String(node.assigneeType ?? 'USER')),
            ]),
            h(
              'div',
              { class: 'text-2xs text-slate-400 truncate' },
              String(node.assigneeValue?.trim() ? node.assigneeValue : '—'),
            ),
          ]),
          h(
            'div',
            {
              class: `px-3 py-1 rounded-b-lg text-center text-2xs font-medium ${
                state === 'current'
                  ? 'bg-emerald-50 text-emerald-700'
                  : state === 'done'
                    ? 'bg-slate-50 text-slate-500'
                    : state === 'rejected'
                      ? 'bg-red-50 text-red-600'
                      : state === 'cancelled'
                        ? 'bg-slate-50 text-slate-400'
                        : 'bg-slate-50 text-slate-400'
              }`,
            },
            stateText(state),
          ),
          h(Handle, {
            type: 'source',
            position: Position.Bottom,
            class: 'w-3.5 h-3.5 !bg-slate-400 !border-2 !border-white rounded-full cursor-default',
          }),
        ],
      )
    }
  },
})

const startNodeView = markRaw({
  setup() {
    return () =>
      h(
        'div',
        {
          class:
            'w-48 bg-emerald-50 border-2 border-emerald-500 rounded-xl p-3 text-center shadow-xs cursor-default relative',
        },
        [
          h(
            'div',
            { class: 'text-xs font-bold text-emerald-800' },
            t('approval.definition.startNodeTitle'),
          ),
          h(
            'div',
            { class: 'text-2xs text-emerald-600 mt-0.5' },
            t('approval.definition.startNodeSubtitle'),
          ),
          h(Handle, {
            type: 'source',
            position: Position.Bottom,
            class:
              'w-3.5 h-3.5 !bg-emerald-500 !border-2 !border-white rounded-full cursor-default',
          }),
        ],
      )
  },
})

const endNodeView = markRaw({
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
            class: 'w-3.5 h-3.5 !bg-slate-500 !border-2 !border-white rounded-full cursor-default',
          }),
          h(
            'div',
            { class: 'text-xs font-semibold text-slate-600' },
            t('approval.definition.endNodeTitle'),
          ),
        ],
      )
  },
})

const nodeTypes = {
  approvalNode: approvalNodeView,
  startNode: startNodeView,
  endNode: endNodeView,
}

const flowNodes = computed<Node[]>(() => {
  const list: Node[] = []
  const centerX = 380
  let currentY = 30
  const nodeWidth = 230
  const nodeGapX = 50
  const layerGapY = 160

  list.push({
    id: 'start-node',
    type: 'startNode',
    position: { x: centerX - 96, y: currentY },
    data: {},
    draggable: false,
    selectable: false,
  })
  currentY += 95

  const layers = computeTopologyLayers(orderedNodes.value)
  layers.forEach((layer) => {
    const k = layer.nodes.length
    const totalWidth = k * nodeWidth + (k - 1) * nodeGapX
    const startX = centerX - totalWidth / 2

    layer.nodes.forEach((item, j) => {
      list.push({
        id: `node-${item.originalIndex}`,
        type: 'approvalNode',
        position: { x: startX + j * (nodeWidth + nodeGapX), y: currentY },
        data: {
          node: item.node,
          state: stateOf(item.node),
          isParallel: k > 1,
          branchIndex: j + 1,
          branchCount: k,
        },
        draggable: false,
        selectable: false,
      })
    })
    currentY += layerGapY
  })

  list.push({
    id: 'end-node',
    type: 'endNode',
    position: { x: centerX - 72, y: currentY },
    data: {},
    draggable: false,
    selectable: false,
  })

  return list
})
</script>

<template>
  <div v-if="hasFlow" class="rounded-xl border border-slate-200 bg-white overflow-hidden">
    <div class="flex items-center justify-between px-4 pt-3 pb-2">
      <div class="text-sm font-bold text-slate-800 flex items-center gap-1.5">
        <span class="inline-block w-2 h-2 rounded-full bg-emerald-500" />
        {{ t('approval.flowProgress.title') }}
      </div>
      <Tag :color="instanceTagColor">{{ instanceLabel }}</Tag>
    </div>

    <div class="h-[360px] bg-slate-50">
      <VueFlow
        :nodes="flowNodes"
        :edges="flowEdges"
        :node-types="nodeTypes"
        :nodes-draggable="false"
        :nodes-connectable="false"
        :elements-selectable="false"
        :default-viewport="{ zoom: 0.85 }"
        :min-zoom="0.3"
        :max-zoom="2"
        class="h-full w-full"
      >
        <Background :gap="16" color="#e2e8f0" />
        <Controls position="bottom-left" />
      </VueFlow>
    </div>

    <div class="px-4 py-2.5 flex items-center justify-between border-t border-slate-100">
      <div class="flex items-center gap-3 text-2xs text-slate-500">
        <span class="flex items-center gap-1">
          <span class="inline-block w-2 h-2 rounded-full bg-emerald-500" />{{
            t('approval.instance.statusPending')
          }}
        </span>
        <span class="flex items-center gap-1">
          <span class="inline-block w-2 h-2 rounded-full bg-slate-300" />{{
            t('approval.instance.statusApproved')
          }}
        </span>
        <span class="flex items-center gap-1">
          <span class="inline-block w-2 h-2 rounded-full bg-red-500" />{{
            t('approval.instance.statusRejected')
          }}
        </span>
      </div>
      <span v-if="currentIndex !== null" class="text-2xs text-emerald-700 font-medium">
        {{
          t('approval.flowProgress.currentStep', {
            step: currentIndex + 1,
            total: orderedNodes.length,
          })
        }}
      </span>
    </div>
  </div>
</template>
