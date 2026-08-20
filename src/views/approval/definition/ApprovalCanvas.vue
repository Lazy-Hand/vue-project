<script setup lang="ts">
import { computed, h, markRaw, ref, watch } from 'vue'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import { Handle, Position, VueFlow, useVueFlow, type Edge, type Node } from '@vue-flow/core'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'

import type { ApprovalAssigneeType, ApprovalNodeType } from '@/types/approval'

interface CanvasNodeData {
  label: string
  type: ApprovalNodeType
  assigneeType: ApprovalAssigneeType
  assigneeValue: string
  allowTransfer: boolean
  allowAddSign: boolean
  allowReject: boolean
  selected: boolean
  index: number
  onSelect: (index: number) => void
  onAddAfter: (index: number) => void
  onRemove: (index: number) => void
}

interface Props {
  nodes: CanvasNodeData[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  reorder: [from: number, to: number]
}>()

function splitAssignees(value: string): string[] {
  const trimmed = value.trim()
  if (!trimmed) return []
  return trimmed
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function isParallelNode(node: CanvasNodeData): boolean {
  const count = splitAssignees(node.assigneeValue).length
  return (node.type === 'AND_SIGN' || node.type === 'OR_SIGN') && count > 1
}

const ApprovalNodeView = markRaw({
  props: {
    data: { type: Object, required: true },
    id: { type: String, required: true },
  },
  setup(nodeProps: { data: CanvasNodeData; id: string }) {
    const data = computed(() => nodeProps.data)

    function typeClass(type: ApprovalNodeType): string {
      switch (type) {
        case 'AND_SIGN':
          return 'approval-canvas-node--and'
        case 'OR_SIGN':
          return 'approval-canvas-node--or'
        default:
          return 'approval-canvas-node--seq'
      }
    }

    function typeText(type: ApprovalNodeType): string {
      switch (type) {
        case 'AND_SIGN':
          return '会签'
        case 'OR_SIGN':
          return '或签'
        default:
          return '审批'
      }
    }

    return () =>
      h(
        'div',
        {
          class: [
            'approval-canvas-node',
            typeClass(data.value.type),
            data.value.selected ? 'approval-canvas-node--selected' : '',
          ],
          onClick: () => data.value.onSelect(data.value.index),
        },
        [
          h(Handle, { type: 'target', position: Position.Left, style: { visibility: 'hidden' } }),
          h('div', { class: 'approval-canvas-node__header' }, [
            h('span', { class: 'approval-canvas-node__index' }, `#${data.value.index + 1}`),
            h('span', { class: 'approval-canvas-node__type' }, typeText(data.value.type)),
          ]),
          h(
            'div',
            { class: 'approval-canvas-node__title', title: data.value.label || '未命名节点' },
            data.value.label || '未命名节点',
          ),
          h(
            'div',
            { class: 'approval-canvas-node__meta' },
            `${data.value.assigneeType} · ${data.value.assigneeValue?.trim() ? data.value.assigneeValue : '—'}`,
          ),
          h('div', { class: 'approval-canvas-node__actions' }, [
            h(
              'button',
              {
                class: 'approval-canvas-node__btn',
                title: '在此后插入',
                onClick: (e: MouseEvent) => {
                  e.stopPropagation()
                  data.value.onAddAfter(data.value.index)
                },
              },
              '+',
            ),
            h(
              'button',
              {
                class: 'approval-canvas-node__btn approval-canvas-node__btn--danger',
                title: '删除',
                onClick: (e: MouseEvent) => {
                  e.stopPropagation()
                  data.value.onRemove(data.value.index)
                },
              },
              '×',
            ),
          ]),
          h(Handle, { type: 'source', position: Position.Right, style: { visibility: 'hidden' } }),
        ],
      )
  },
})

const BranchNodeView = markRaw({
  props: {
    data: { type: Object, required: true },
  },
  setup(branchProps: { data: CanvasNodeData & { branchLabel: string } }) {
    const data = computed(() => branchProps.data)

    return () =>
      h(
        'div',
        {
          class: [
            'approval-canvas-branch',
            data.value.selected ? 'approval-canvas-branch--selected' : '',
          ],
          onClick: () => data.value.onSelect(data.value.index),
        },
        [
          h(Handle, { type: 'target', position: Position.Left, style: { visibility: 'hidden' } }),
          h(
            'div',
            { class: 'approval-canvas-branch__title', title: data.value.branchLabel },
            data.value.branchLabel,
          ),
          h('div', { class: 'approval-canvas-branch__meta' }, data.value.assigneeType),
          h(Handle, { type: 'source', position: Position.Right, style: { visibility: 'hidden' } }),
        ],
      )
  },
})

const GatewayNodeView = markRaw({
  props: {
    data: { type: Object, required: true },
  },
  setup(gatewayProps: { data: { label: string } }) {
    const label = computed(() => gatewayProps.data.label)
    return () =>
      h('div', { class: 'approval-canvas-gateway' }, [
        h(Handle, { type: 'target', position: Position.Left }),
        h('div', { class: 'approval-canvas-gateway__diamond' }),
        h('div', { class: 'approval-canvas-gateway__label' }, label.value),
        h(Handle, { type: 'source', position: Position.Right }),
      ])
  },
})

const EndpointNodeView = markRaw({
  props: {
    data: { type: Object, required: true },
  },
  setup(endpointProps: { data: { label: string; kind: 'start' | 'end' } }) {
    return () =>
      h(
        'div',
        {
          class: [
            'approval-canvas-endpoint',
            `approval-canvas-endpoint--${endpointProps.data.kind}`,
          ],
        },
        [
          endpointProps.data.kind === 'start'
            ? h(Handle, { type: 'source', position: Position.Right })
            : h(Handle, { type: 'target', position: Position.Left }),
          h('div', { class: 'approval-canvas-endpoint__dot' }),
          h('div', { class: 'approval-canvas-endpoint__label' }, endpointProps.data.label),
        ],
      )
  },
})

const nodeTypes = {
  approval: ApprovalNodeView,
  branch: BranchNodeView,
  gateway: GatewayNodeView,
  endpoint: EndpointNodeView,
}

const { fitView, onNodeDragStop, onNodesChange, onPaneReady } = useVueFlow()
const isPaneReady = ref(false)

onPaneReady(() => {
  isPaneReady.value = true
  setTimeout(() => {
    try {
      void fitView({ padding: 0.2 })
    } catch {
      // ignore if unmounted
    }
  }, 100)
})

const flowNodes = computed<Node[]>(() => {
  const nodes: Node[] = []
  const gapX = 220
  const startX = 40
  const baseY = 140
  const branchGapY = 88

  nodes.push({
    id: 'start',
    type: 'endpoint',
    position: { x: startX, y: baseY },
    data: { label: '开始', kind: 'start' },
    draggable: false,
    selectable: false,
  })

  let currentX = startX + gapX

  for (let i = 0; i < props.nodes.length; i++) {
    const n = props.nodes[i]!
    const parallel = isParallelNode(n)
    const assignees = parallel ? splitAssignees(n.assigneeValue) : []

    if (!parallel) {
      nodes.push({
        id: `node-${i}`,
        type: 'approval',
        position: { x: currentX, y: baseY },
        data: n,
        draggable: true,
        selectable: false,
      })
      currentX += gapX
    } else {
      const forkId = `fork-${i}`
      const joinId = `join-${i}`

      nodes.push({
        id: forkId,
        type: 'gateway',
        position: { x: currentX, y: baseY },
        data: { label: n.type === 'AND_SIGN' ? '会签' : '或签' },
        draggable: false,
        selectable: false,
      })

      currentX += gapX
      const branchX = currentX
      const totalHeight = (assignees.length - 1) * branchGapY
      const startBranchY = baseY - totalHeight / 2

      for (let k = 0; k < assignees.length; k++) {
        const branchY = startBranchY + k * branchGapY
        const branchLabel = `${n.label?.trim() ? n.label : `节点${i + 1}`} · ${assignees[k]}`
        nodes.push({
          id: `branch-${i}-${k}`,
          type: 'branch',
          position: { x: branchX, y: branchY },
          data: { ...n, branchLabel, assigneeValue: assignees[k] ?? '', selected: n.selected },
          draggable: false,
          selectable: false,
        })
      }

      currentX += gapX
      nodes.push({
        id: joinId,
        type: 'gateway',
        position: { x: currentX, y: baseY },
        data: { label: '汇聚' },
        draggable: false,
        selectable: false,
      })
      currentX += gapX
    }
  }

  nodes.push({
    id: 'end',
    type: 'endpoint',
    position: { x: currentX, y: baseY },
    data: { label: '结束', kind: 'end' },
    draggable: false,
    selectable: false,
  })

  return nodes
})

const flowEdges = computed<Edge[]>(() => {
  const edges: Edge[] = []
  let prevId = 'start'

  for (let i = 0; i < props.nodes.length; i++) {
    const n = props.nodes[i]!
    const parallel = isParallelNode(n)
    const assignees = parallel ? splitAssignees(n.assigneeValue) : []

    if (!parallel) {
      edges.push({
        id: `e-${prevId}-node-${i}`,
        source: prevId,
        target: `node-${i}`,
        animated: false,
      })
      prevId = `node-${i}`
    } else {
      const forkId = `fork-${i}`
      const joinId = `join-${i}`
      edges.push({ id: `e-${prevId}-${forkId}`, source: prevId, target: forkId, animated: false })
      for (let k = 0; k < assignees.length; k++) {
        const branchId = `branch-${i}-${k}`
        edges.push({
          id: `e-${forkId}-${branchId}`,
          source: forkId,
          target: branchId,
          animated: false,
        })
        edges.push({
          id: `e-${branchId}-${joinId}`,
          source: branchId,
          target: joinId,
          animated: false,
        })
      }
      prevId = joinId
    }
  }

  edges.push({ id: `e-${prevId}-end`, source: prevId, target: 'end', animated: false })
  return edges
})

onNodeDragStop(({ node }) => {
  const match = /^node-(\d+)$/.exec(node.id)
  if (!match) return
  const from = Number.parseInt(match[1]!, 10)
  const gapX = 220
  const startX = 40
  const targetIndex = Math.round((node.position.x - (startX + gapX)) / gapX)
  const clamped = Math.max(0, Math.min(props.nodes.length - 1, targetIndex))
  if (clamped !== from) emit('reorder', from, clamped)
})

onNodesChange((changes) => {
  for (const c of changes) {
    if (c.type === 'position' && c.dragging === false && c.id.startsWith('node-')) {
      const from = Number.parseInt(c.id.replace('node-', ''), 10)
      const pos = (c as { position?: { x: number } }).position
      if (!pos || Number.isNaN(from)) continue
      const gapX = 220
      const startX = 40
      const targetIndex = Math.round((pos.x - (startX + gapX)) / gapX)
      const clamped = Math.max(0, Math.min(props.nodes.length - 1, targetIndex))
      if (clamped !== from) emit('reorder', from, clamped)
    }
  }
})

watch(
  () => props.nodes.length,
  (newLen, oldLen) => {
    if (oldLen && isPaneReady.value) {
      setTimeout(() => {
        try {
          void fitView({ padding: 0.2 })
        } catch {
          // ignore
        }
      }, 50)
    }
  },
)
</script>

<template>
  <div class="approval-flow">
    <VueFlow
      :nodes="flowNodes"
      :edges="flowEdges"
      :node-types="nodeTypes"
      :nodes-draggable="true"
      :nodes-connectable="false"
      :elements-selectable="false"
      :pan-on-drag="true"
      :pan-on-scroll="true"
      :zoom-on-scroll="true"
      :zoom-on-pinch="true"
      :zoom-on-double-click="false"
      :select-nodes-on-drag="false"
      fit-view-on-init
      class="approval-flow__canvas"
      :default-viewport="{ zoom: 1, x: 0, y: 0 }"
    >
      <Background />
      <Controls />
      <MiniMap />
    </VueFlow>
  </div>
</template>

<style scoped lang="scss">
.approval-flow {
  height: 420px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
  background: #f8fafc;
}

.approval-flow__canvas {
  width: 100%;
  height: 100%;
}

:deep(.approval-canvas-node) {
  width: 176px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 10px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
  cursor: grab;

  &:active {
    cursor: grabbing;
  }
}

:deep(.approval-canvas-node--selected) {
  border-color: #3b82f6;
  box-shadow: 0 4px 10px rgba(59, 130, 246, 0.15);
}

:deep(.approval-canvas-node--and) {
  border-left: 3px solid #f59e0b;
}

:deep(.approval-canvas-node--or) {
  border-left: 3px solid #0ea5e9;
}

:deep(.approval-canvas-node--seq) {
  border-left: 3px solid #94a3b8;
}

:deep(.approval-canvas-node__header) {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #64748b;
}

:deep(.approval-canvas-node__index) {
  font-weight: 700;
  color: #475569;
}

:deep(.approval-canvas-node__type) {
  margin-left: auto;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 9999px;
  background: #f1f5f9;
}

:deep(.approval-canvas-node__title) {
  margin-top: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.approval-canvas-node__meta) {
  margin-top: 4px;
  font-size: 11px;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.approval-canvas-node__actions) {
  margin-top: 8px;
  display: flex;
  gap: 4px;
  justify-content: flex-end;
}

:deep(.approval-canvas-node__btn) {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #475569;
  cursor: pointer;
  line-height: 20px;
  text-align: center;
  font-size: 12px;
}

:deep(.approval-canvas-node__btn--danger) {
  color: #dc2626;
  border-color: #fecaca;
}

:deep(.approval-canvas-branch) {
  width: 150px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px 10px;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
}

:deep(.approval-canvas-branch--selected) {
  border-color: #3b82f6;
  box-shadow: 0 4px 10px rgba(59, 130, 246, 0.12);
}

:deep(.approval-canvas-branch__title) {
  font-size: 12px;
  font-weight: 600;
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.approval-canvas-branch__meta) {
  margin-top: 2px;
  font-size: 11px;
  color: #64748b;
}

:deep(.approval-canvas-gateway) {
  position: relative;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

:deep(.approval-canvas-gateway__diamond) {
  width: 28px;
  height: 28px;
  background: #fff;
  border: 1.5px solid #94a3b8;
  transform: rotate(45deg);
  border-radius: 3px;
}

:deep(.approval-canvas-gateway__label) {
  position: absolute;
  top: 44px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  color: #64748b;
  white-space: nowrap;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 9999px;
  padding: 0 6px;
  line-height: 16px;
}

:deep(.approval-canvas-endpoint) {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

:deep(.approval-canvas-endpoint__dot) {
  width: 14px;
  height: 14px;
  border-radius: 9999px;
  border: 2px solid #cbd5e1;
  background: #fff;
}

:deep(.approval-canvas-endpoint--start .approval-canvas-endpoint__dot) {
  background: #22c55e;
  border-color: #16a34a;
}

:deep(.approval-canvas-endpoint--end .approval-canvas-endpoint__dot) {
  background: #0f172a;
  border-color: #020617;
}

:deep(.approval-canvas-endpoint__label) {
  font-size: 12px;
  color: #64748b;
}

:deep(.vue-flow__controls) {
  bottom: 12px;
}

:deep(.vue-flow__minimap) {
  border-radius: 8px;
  overflow: hidden;
}
</style>
