<script setup lang="ts">
import { computed, h, markRaw, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Button,
  Drawer,
  Form,
  FormItem,
  Input,
  Popover,
  Select,
  Switch,
  Tag,
  Tooltip,
  TreeSelect,
  message,
} from 'antdv-next'
import {
  ApartmentOutlined,
  BranchesOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  DeleteOutlined,
  DisconnectOutlined,
  FullscreenOutlined,
  PlusOutlined,
  ReloadOutlined,
  SendOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
  WarningOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@antdv-next/icons'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import {
  Handle,
  MarkerType,
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
  ApprovalEdgeInput,
  ApprovalNodeInput,
  ApprovalNodeType,
  FormFieldSchema,
} from '@/types/approval'

interface Props {
  nodes: ApprovalNodeInput[]
  /** 真实边模型；父级负责将旧版无边数据迁移为显式线性边 */
  edges?: ApprovalEdgeInput[]
  formFields?: FormFieldSchema[]
}

const props = withDefaults(defineProps<Props>(), {
  edges: () => [],
  formFields: () => [],
})

const emit = defineEmits<{
  'update:nodes': [value: ApprovalNodeInput[]]
  'update:edges': [value: ApprovalEdgeInput[]]
}>()

const { t } = useI18n()
const selectedNodeIndex = ref<number | null>(0)
const selectedEdgeId = ref<string | null>(null)
const designerRootRef = ref<HTMLElement | null>(null)
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

function flattenDeptNames(list: DeptTreeNode[], map: Map<string, string>): void {
  for (const item of list) {
    map.set(String(item.id), item.name)
    if (item.children && item.children.length > 0) {
      flattenDeptNames(item.children, map)
    }
  }
}

const deptMap = computed(() => {
  const map = new Map<string, string>()
  flattenDeptNames(deptTreeData.value, map)
  return map
})

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

const userMap = computed(() => new Map(userOptions.value.map((u) => [u.value, u.label])))
const roleMap = computed(() => new Map(roleOptions.value.map((r) => [r.value, r.label])))
const postMap = computed(() => new Map(postOptions.value.map((p) => [p.value, p.label])))

function getAssigneeInfo(node: ApprovalNodeInput): {
  displayText: string
  isConfigured: boolean
} {
  if (node.type === 'FORK' || node.type === 'JOIN') {
    return { displayText: '', isConfigured: true }
  }
  const type = node.assigneeType
  if (type === 'DEPT_LEADER') {
    return { displayText: t('approval.definition.assigneeDeptLeaderDesc'), isConfigured: true }
  }
  if (type === 'INITIATOR_LEADER') {
    return { displayText: t('approval.definition.assigneeInitiatorLeaderDesc'), isConfigured: true }
  }
  if (type === 'SELF') {
    return { displayText: t('approval.definition.assigneeSelfDesc'), isConfigured: true }
  }

  const raw = node.assigneeValue?.trim() || ''
  const ids = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (ids.length === 0) {
    if (type === 'USER') {
      return { displayText: t('approval.definition.assigneeUnassignedWarning'), isConfigured: false }
    }
    if (type === 'ROLE') {
      return {
        displayText: t('approval.definition.assigneeUnassignedRoleWarning'),
        isConfigured: false,
      }
    }
    if (type === 'DEPT') {
      return {
        displayText: t('approval.definition.assigneeUnassignedDeptWarning'),
        isConfigured: false,
      }
    }
    if (type === 'POST') {
      return {
        displayText: t('approval.definition.assigneeUnassignedPostWarning'),
        isConfigured: false,
      }
    }
    return { displayText: t('approval.definition.assigneeUnassignedWarning'), isConfigured: false }
  }

  let names: string[] = []
  if (type === 'USER') {
    names = ids.map((id) => userMap.value.get(id) || id)
  } else if (type === 'ROLE') {
    names = ids.map((id) => roleMap.value.get(id) || id)
  } else if (type === 'DEPT') {
    names = ids.map((id) => deptMap.value.get(id) || id)
  } else if (type === 'POST') {
    names = ids.map((id) => postMap.value.get(id) || id)
  } else {
    names = ids
  }
  return { displayText: names.join('、'), isConfigured: true }
}

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
  // 第三批：抄送节点已支持（持久化接收记录 + 查看权限 + 站内通知）
  { label: t('approval.definition.nodeTypeCc'), value: 'CC' },
])

const assigneeTypeOptions = computed(() => [
  { label: t('approval.definition.assigneeTypeUser'), value: 'USER' },
  { label: t('approval.definition.assigneeTypeRole'), value: 'ROLE' },
  { label: t('approval.definition.assigneeTypeDept'), value: 'DEPT' },
  { label: t('approval.definition.assigneeTypePost'), value: 'POST' },
  { label: t('approval.definition.assigneeTypeDeptLeader'), value: 'DEPT_LEADER' },
  { label: t('approval.definition.assigneeTypeInitiatorLeader'), value: 'INITIATOR_LEADER' },
  { label: t('approval.definition.assigneeTypeSelf'), value: 'SELF' },
])

const rejectTargetOptions = computed(() => [
  { label: t('approval.definition.rejectTargetInitiator'), value: 'INITIATOR' },
  // 第三批：驳回上一节点（产生新 round，历史轮次只读）
  { label: t('approval.definition.rejectTargetPrev'), value: 'PREV' },
  { label: t('approval.definition.rejectTargetTerminate'), value: 'TERMINATE' },
])

const joinTypeOptions = computed(() => [
  { label: t('approval.definition.parallelJoinAnd'), value: 'AND' },
  { label: t('approval.definition.parallelJoinOr'), value: 'OR' },
])

// ================= 真实节点 + 边模型 =================

/** 节点稳定标识：优先 nodeKey，缺省按位置兜底 */
function keyAt(index: number): string {
  const node = props.nodes[index]
  return node?.nodeKey?.trim() || `node_${index + 1}`
}

interface ResolvedEdge {
  fromNodeKey: string
  toNodeKey: string | null
  conditionConfig?: ApprovalEdgeInput['conditionConfig']
}

interface GraphModel {
  items: { node: ApprovalNodeInput; key: string; index: number }[]
  /** 解析去重后的有效显式边 */
  resolvedEdges: ResolvedEdge[]
  /** key -> 全部出边；FORK/CONDITION 可有多个后继 */
  outgoingOf: Map<string, ResolvedEdge[]>
  incomingOf: Map<string, string[]>
  /** 最长路径分层深度，用于画布布局 */
  depthOf: Map<string, number>
}

const graph = computed<GraphModel>(() => {
  const items = props.nodes.map((node, index) => ({
    node,
    key: node.nodeKey?.trim() || `node_${index + 1}`,
    index,
  }))
  const keySet = new Set(items.map((i) => i.key))

  // 过滤端点失效的残留边（节点删除后父组件尚未同步的场景）
  const rawEdges = props.edges.filter(
    (e) =>
      !!e.fromNodeKey && keySet.has(e.fromNodeKey) && (!e.toNodeKey || keySet.has(e.toNodeKey)),
  )

  const resolvedEdges: ResolvedEdge[] = []
  const outgoingOf = new Map<string, ResolvedEdge[]>(items.map((i) => [i.key, []]))
  const incomingOf = new Map<string, string[]>(items.map((i) => [i.key, []]))
  const seen = new Set<string>()
  for (const e of rawEdges) {
    const dedupe = `${e.fromNodeKey}->${e.toNodeKey ?? ''}`
    if (seen.has(dedupe)) continue
    seen.add(dedupe)
    const resolved = {
      fromNodeKey: e.fromNodeKey,
      toNodeKey: e.toNodeKey || null,
      conditionConfig: e.conditionConfig,
    }
    resolvedEdges.push(resolved)
    outgoingOf.get(e.fromNodeKey)!.push(resolved)
    if (e.toNodeKey) incomingOf.get(e.toNodeKey)!.push(e.fromNodeKey)
  }

  // 最长路径分层（Kahn 拓扑序 + 松弛）；环上节点无法入队，兜底排到最后
  const indeg = new Map<string, number>(items.map((i) => [i.key, incomingOf.get(i.key)!.length]))
  const depthOf = new Map<string, number>()
  const queue: string[] = []
  for (const i of items) {
    if ((indeg.get(i.key) ?? 0) === 0) {
      depthOf.set(i.key, 0)
      queue.push(i.key)
    }
  }
  let maxDepth = 0
  while (queue.length > 0) {
    const cur = queue.shift()!
    const d = depthOf.get(cur) ?? 0
    maxDepth = Math.max(maxDepth, d)
    for (const edge of outgoingOf.get(cur) ?? []) {
      const next = edge.toNodeKey
      if (next === null) continue
      depthOf.set(next, Math.max(depthOf.get(next) ?? 0, d + 1))
      maxDepth = Math.max(maxDepth, d + 1)
      indeg.set(next, (indeg.get(next) ?? 1) - 1)
      if ((indeg.get(next) ?? 0) === 0) queue.push(next)
    }
  }
  let fallback = maxDepth + 1
  for (const i of items) {
    if (!depthOf.has(i.key)) depthOf.set(i.key, fallback++)
  }

  return { items, resolvedEdges, outgoingOf, incomingOf, depthOf }
})

/** BFS 可达性判断（用于连线环路保护） */
function reaches(graphModel: GraphModel, from: string, to: string): boolean {
  if (from === to) return true
  const visited = new Set<string>([from])
  const queue = [from]
  while (queue.length > 0) {
    const cur = queue.shift()!
    for (const edge of graphModel.outgoingOf.get(cur) ?? []) {
      const next = edge.toNodeKey
      if (next === null) continue
      if (next === to) return true
      if (!visited.has(next)) {
        visited.add(next)
        queue.push(next)
      }
    }
  }
  return false
}

const currentNode = computed<ApprovalNodeInput | null>(() => {
  if (selectedNodeIndex.value === null) return null
  return props.nodes[selectedNodeIndex.value] ?? null
})

const currentNodeIsGateway = computed(
  () => currentNode.value?.type === 'FORK' || currentNode.value?.type === 'JOIN',
)

const parallelBranchKeys = computed(() => {
  const keys = new Set<string>()
  const g = graph.value
  const typeByKey = new Map(g.items.map((item) => [item.key, item.node.type]))
  for (const fork of g.items.filter((item) => item.node.type === 'FORK')) {
    const queue = (g.outgoingOf.get(fork.key) ?? [])
      .map((edge) => edge.toNodeKey)
      .filter((key): key is string => key !== null)
    while (queue.length > 0) {
      const key = queue.shift()!
      if (typeByKey.get(key) === 'JOIN' || keys.has(key)) continue
      keys.add(key)
      for (const edge of g.outgoingOf.get(key) ?? []) {
        if (edge.toNodeKey !== null) queue.push(edge.toNodeKey)
      }
    }
  }
  return keys
})

const currentRejectTargetOptions = computed(() => {
  if (selectedNodeIndex.value === null) return rejectTargetOptions.value
  const key = keyAt(selectedNodeIndex.value)
  return parallelBranchKeys.value.has(key)
    ? [{ label: t('approval.definition.rejectTargetTerminate'), value: 'TERMINATE' }]
    : rejectTargetOptions.value
})

const currentForkBranches = computed(() => {
  if (!currentNode.value || (currentNode.value.type !== 'FORK' && currentNode.value.type !== 'JOIN'))
    return []
  const g = graph.value
  let forkKey: string | null = null

  if (currentNode.value.type === 'FORK') {
    forkKey = keyAt(selectedNodeIndex.value ?? 0)
  } else {
    const joinKey = keyAt(selectedNodeIndex.value ?? 0)
    const incomingBranches = g.incomingOf.get(joinKey) ?? []
    if (incomingBranches.length > 0) {
      const firstBranch = incomingBranches[0]!
      const incomingToBranch = g.incomingOf.get(firstBranch) ?? []
      if (incomingToBranch.length > 0) {
        forkKey = incomingToBranch[0]!
      }
    }
  }

  if (!forkKey) return []
  const outgoing = g.outgoingOf.get(forkKey) ?? []
  return outgoing
    .map((edge) => {
      if (!edge.toNodeKey) return null
      const item = g.items.find((i) => i.key === edge.toNodeKey)
      return item ? { ...item, assigneeInfo: getAssigneeInfo(item.node) } : null
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
})

const currentForkIndex = computed<number | null>(() => {
  if (!currentNode.value) return null
  if (currentNode.value.type === 'FORK') return selectedNodeIndex.value
  if (currentNode.value.type === 'JOIN') {
    const g = graph.value
    const joinKey = keyAt(selectedNodeIndex.value ?? 0)
    const incomingBranches = g.incomingOf.get(joinKey) ?? []
    if (incomingBranches.length > 0) {
      const firstBranch = incomingBranches[0]!
      const incomingToBranch = g.incomingOf.get(firstBranch) ?? []
      if (incomingToBranch.length > 0) {
        const forkKey = incomingToBranch[0]!
        const forkItem = g.items.find((i) => i.key === forkKey)
        return forkItem ? forkItem.index : null
      }
    }
  }
  return null
})

function openNodeDrawer(index: number): void {
  selectedEdgeId.value = null
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
}

function updateCurrentJoinType(value: unknown): void {
  const node = currentNode.value
  if (!node || node.type !== 'JOIN') return
  updateCurrentNode({
    conditionConfig: {
      ...node.conditionConfig,
      joinType: value === 'OR' ? 'OR' : 'AND',
    },
  })
}

function generateNodeKey(existingKeys: Set<string>): string {
  let max = 0
  for (const k of existingKeys) {
    const m = /^node_(\d+)$/.exec(k)
    if (m) max = Math.max(max, Number(m[1]))
  }
  let n = max + 1
  while (existingKeys.has(`node_${n}`)) n++
  return `node_${n}`
}

function insertNode(
  index: number,
  type: ApprovalNodeType = 'SEQ',
  parallelGroup?: string,
  customName?: string,
): void {
  const keys = new Set(props.nodes.map((_, i) => keyAt(i)))
  const newKey = generateNodeKey(keys)
  const defaultName =
    customName ||
    (type === 'CC'
      ? t('approval.definition.addCc')
      : type === 'AND_SIGN'
        ? t('approval.definition.nodeTypeAndSign')
        : type === 'OR_SIGN'
          ? t('approval.definition.nodeTypeOrSign')
          : t('approval.definition.addApprover'))

  const newNode: ApprovalNodeInput = {
    nodeKey: newKey,
    name: defaultName,
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

  // 边模型重连：锚点原出边转接到新节点，保持插入位置前后衔接
  const g = graph.value
  const anchorKey = keyAt(index)
  const oldOutgoing = g.outgoingOf.get(anchorKey) ?? []
  const next = g.resolvedEdges.filter((e) => e.fromNodeKey !== anchorKey).map((e) => ({ ...e }))
  next.push({ fromNodeKey: anchorKey, toNodeKey: newKey })
  for (const edge of oldOutgoing) {
    next.push({ fromNodeKey: newKey, toNodeKey: edge.toNodeKey })
  }
  emit('update:edges', next)
  openNodeDrawer(index + 1)
  fitViewSoon()
}

function cloneNode(index: number): void {
  const source = props.nodes[index]
  if (!source) return
  const keys = new Set(props.nodes.map((_, i) => keyAt(i)))
  const newKey = generateNodeKey(keys)

  const cloned: ApprovalNodeInput = {
    ...JSON.parse(JSON.stringify(source)),
    nodeKey: newKey,
    name: `${source.name || t('approval.definition.addApprover')}`,
  }

  const copy = [...props.nodes]
  copy.splice(index + 1, 0, cloned)
  emit('update:nodes', copy)

  const g = graph.value
  const anchorKey = keyAt(index)
  const oldOutgoing = g.outgoingOf.get(anchorKey) ?? []
  const next = g.resolvedEdges.filter((e) => e.fromNodeKey !== anchorKey).map((e) => ({ ...e }))
  next.push({ fromNodeKey: anchorKey, toNodeKey: newKey })
  for (const edge of oldOutgoing) {
    next.push({ fromNodeKey: newKey, toNodeKey: edge.toNodeKey })
  }
  emit('update:edges', next)

  openNodeDrawer(index + 1)
  void message.success(t('approval.definition.copyNodeSuccess'))
  fitViewSoon()
}

function createGatewayNode(
  nodeKey: string,
  type: Extract<ApprovalNodeType, 'FORK' | 'JOIN'>,
  joinType: 'AND' | 'OR' = 'AND',
): ApprovalNodeInput {
  return {
    nodeKey,
    name:
      type === 'FORK'
        ? t('approval.definition.parallelForkName')
        : t('approval.definition.parallelJoinName'),
    type,
    assigneeType: 'SELF',
    allowTransfer: false,
    allowAddSign: false,
    allowReject: false,
    conditionConfig: type === 'JOIN' ? { joinType } : undefined,
  }
}

function createParallelBranchNode(
  nodeKey: string,
  branchNumber: number,
  type: Extract<ApprovalNodeType, 'SEQ' | 'AND_SIGN' | 'OR_SIGN'> = 'AND_SIGN',
): ApprovalNodeInput {
  const name =
    type === 'AND_SIGN'
      ? t('approval.definition.parallelAndBranchName', { number: branchNumber })
      : type === 'OR_SIGN'
        ? t('approval.definition.parallelOrBranchName', { number: branchNumber })
        : t('approval.definition.parallelBranchName', { number: branchNumber })

  return {
    nodeKey,
    name,
    type,
    assigneeType: 'USER',
    assigneeValue: '',
    allowTransfer: true,
    allowAddSign: type === 'AND_SIGN',
    allowReject: true,
    rejectTarget: 'TERMINATE',
  }
}

/** 在指定节点后面插入一个完整的并行块 */
function insertParallelAfter(index: number, joinType: 'AND' | 'OR' = 'AND'): void {
  const g = graph.value
  const anchorKey = keyAt(index)
  const keys = new Set(g.items.map((item) => item.key))

  const forkKey = generateNodeKey(keys)
  keys.add(forkKey)
  const firstBranchKey = generateNodeKey(keys)
  keys.add(firstBranchKey)
  const secondBranchKey = generateNodeKey(keys)
  keys.add(secondBranchKey)
  const joinKey = generateNodeKey(keys)

  const branchType: Extract<ApprovalNodeType, 'SEQ' | 'AND_SIGN' | 'OR_SIGN'> =
    joinType === 'OR' ? 'OR_SIGN' : 'AND_SIGN'

  const blockNodes = [
    createGatewayNode(forkKey, 'FORK'),
    createParallelBranchNode(firstBranchKey, 1, branchType),
    createParallelBranchNode(secondBranchKey, 2, branchType),
    createGatewayNode(joinKey, 'JOIN', joinType),
  ]

  const nextNodes = [...props.nodes]
  nextNodes.splice(index + 1, 0, ...blockNodes)

  const oldOutgoing = g.outgoingOf.get(anchorKey) ?? []
  const nextEdges: ApprovalEdgeInput[] = g.resolvedEdges
    .filter((edge) => edge.fromNodeKey !== anchorKey)
    .map((edge) => ({ ...edge }))

  nextEdges.push(
    { fromNodeKey: anchorKey, toNodeKey: forkKey },
    { fromNodeKey: forkKey, toNodeKey: firstBranchKey },
    { fromNodeKey: forkKey, toNodeKey: secondBranchKey },
    { fromNodeKey: firstBranchKey, toNodeKey: joinKey },
    { fromNodeKey: secondBranchKey, toNodeKey: joinKey },
  )

  for (const edge of oldOutgoing) {
    nextEdges.push({ fromNodeKey: joinKey, toNodeKey: edge.toNodeKey })
  }

  emit('update:nodes', nextNodes)
  emit('update:edges', nextEdges)
  selectedNodeIndex.value = index + 2
  selectedEdgeId.value = null
  fitViewSoon()
}

/** 追加一个完整的并行块至末尾 */
function appendParallelApproval(joinType: 'AND' | 'OR' = 'AND'): void {
  const g = graph.value
  const terminalItems = g.items.filter(
    (item) => !(g.outgoingOf.get(item.key) ?? []).some((edge) => edge.toNodeKey !== null),
  )
  if (terminalItems.length !== 1) {
    void message.warning(t('approval.definition.parallelRequiresSingleEnd'))
    return
  }
  const anchor = terminalItems[0]!
  insertParallelAfter(anchor.index, joinType)
}

/** 为指定的 FORK 网关增加一条新分支 */
function addBranchToFork(forkIndex: number): void {
  const forkNode = props.nodes[forkIndex]
  if (!forkNode || forkNode.type !== 'FORK') return
  const forkKey = forkNode.nodeKey?.trim() || `node_${forkIndex + 1}`

  const g = graph.value
  const currentBranches = g.outgoingOf.get(forkKey) ?? []
  let matchedJoinKey: string | null = null

  for (const branch of currentBranches) {
    if (!branch.toNodeKey) continue
    const nextOutgoing = g.outgoingOf.get(branch.toNodeKey) ?? []
    for (const out of nextOutgoing) {
      if (out.toNodeKey) {
        const targetNode = g.items.find((item) => item.key === out.toNodeKey)?.node
        if (targetNode?.type === 'JOIN') {
          matchedJoinKey = out.toNodeKey
          break
        }
      }
    }
    if (matchedJoinKey) break
  }

  if (!matchedJoinKey) {
    const joinItem = g.items.find((item) => item.node.type === 'JOIN')
    if (joinItem) matchedJoinKey = joinItem.key
  }

  if (!matchedJoinKey) {
    void message.warning('未找到与该分叉网关配对的汇聚网关')
    return
  }

  const joinNode = g.items.find((item) => item.key === matchedJoinKey)?.node
  const isOrJoin =
    (joinNode?.conditionConfig as { joinType?: string } | undefined)?.joinType === 'OR'
  const branchType: Extract<ApprovalNodeType, 'SEQ' | 'AND_SIGN' | 'OR_SIGN'> = isOrJoin
    ? 'OR_SIGN'
    : 'AND_SIGN'

  const keys = new Set(g.items.map((item) => item.key))
  const newBranchKey = generateNodeKey(keys)
  const branchCount = currentBranches.length + 1
  const newBranchNode = createParallelBranchNode(newBranchKey, branchCount, branchType)

  const joinIndex = props.nodes.findIndex(
    (n, idx) => (n.nodeKey?.trim() || `node_${idx + 1}`) === matchedJoinKey,
  )
  const insertPos = joinIndex >= 0 ? joinIndex : forkIndex + 1

  const nextNodes = [...props.nodes]
  nextNodes.splice(insertPos, 0, newBranchNode)

  const nextEdges: ApprovalEdgeInput[] = [
    ...g.resolvedEdges.map((e) => ({ ...e })),
    { fromNodeKey: forkKey, toNodeKey: newBranchKey },
    { fromNodeKey: newBranchKey, toNodeKey: matchedJoinKey },
  ]

  emit('update:nodes', nextNodes)
  emit('update:edges', nextEdges)
  void message.success(t('approval.definition.addBranchSuccess'))
  fitViewSoon()
}

/**
 * 智能自动缝合删除算法（Auto-Healing Remove）：
 * 删除节点时，将其所有前驱与所有后继自动搭桥连线，确保流程始终连贯闭环不报错
 */
function removeNode(index: number): void {
  if (props.nodes.length <= 1) {
    void message.warning(t('approval.definition.nodesRequired'))
    return
  }
  const targetKey = keyAt(index)
  const g = graph.value

  const incomingKeys = g.incomingOf.get(targetKey) ?? []
  const outgoingEdges = g.outgoingOf.get(targetKey) ?? []
  const outgoingKeys = outgoingEdges.map((e) => e.toNodeKey).filter((k): k is string => k !== null)

  // 1. 过滤掉直接关联被删除节点的边
  const filteredEdges = g.resolvedEdges
    .filter((e) => e.fromNodeKey !== targetKey && e.toNodeKey !== targetKey)
    .map((e) => ({ ...e }))

  // 2. 自动缝合：对每一个前驱，连接到每一个后继
  const existingEdgeSet = new Set(
    filteredEdges.map((e) => `${e.fromNodeKey}->${e.toNodeKey ?? ''}`),
  )
  for (const fromKey of incomingKeys) {
    if (outgoingKeys.length > 0) {
      for (const toKey of outgoingKeys) {
        if (fromKey !== toKey && !existingEdgeSet.has(`${fromKey}->${toKey}`)) {
          filteredEdges.push({ fromNodeKey: fromKey, toNodeKey: toKey })
          existingEdgeSet.add(`${fromKey}->${toKey}`)
        }
      }
    }
  }

  // 3. 更新节点与边
  emit(
    'update:nodes',
    props.nodes.filter((_, i) => i !== index),
  )
  emit('update:edges', filteredEdges)

  if (selectedNodeIndex.value === index) {
    selectedNodeIndex.value = Math.max(0, index - 1)
  }
  fitViewSoon()
}

// ================= 画布渲染 =================

const FlowNodeView = markRaw({
  props: {
    data: { type: Object, required: true },
  },
  setup(nodeProps: {
    data: {
      node: ApprovalNodeInput
      index: number
      isSelected: boolean
      assigneeInfo: { displayText: string; isConfigured: boolean }
    }
  }) {
    const popoverOpen = ref(false)

    return () => {
      const { node, index, isSelected, assigneeInfo } = nodeProps.data
      const isCc = node.type === 'CC'
      const isAnd = node.type === 'AND_SIGN'
      const isOr = node.type === 'OR_SIGN'

      let headerClass = 'bg-blue-600 text-white'
      let typeText = t('approval.definition.addApprover')
      let borderClass = 'border-slate-200'
      let TypeIcon = UserOutlined

      if (isCc) {
        headerClass = 'bg-teal-600 text-white'
        typeText = t('approval.definition.addCc')
        borderClass = 'border-teal-200 border-dashed'
        TypeIcon = SendOutlined
      } else if (isAnd) {
        headerClass = 'bg-purple-600 text-white'
        typeText = t('approval.definition.nodeTypeAndSign')
        borderClass = 'border-purple-300'
        TypeIcon = TeamOutlined
      } else if (isOr) {
        headerClass = 'bg-amber-600 text-white'
        typeText = t('approval.definition.nodeTypeOrSign')
        borderClass = 'border-amber-300'
        TypeIcon = ApartmentOutlined
      }

      const quickInsertMenu = h('div', { class: 'w-48 py-1 space-y-1' }, [
        h(
          'button',
          {
            type: 'button',
            class:
              'w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-600 rounded-md flex items-center gap-2 cursor-pointer transition-colors',
            onClick: (e: MouseEvent) => {
              e.stopPropagation()
              popoverOpen.value = false
              insertNode(index, 'SEQ')
            },
          },
          [h(UserOutlined, { class: 'text-blue-600' }), t('approval.definition.insertApprover')],
        ),
        h(
          'button',
          {
            type: 'button',
            class:
              'w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-purple-50 hover:text-purple-600 rounded-md flex items-center gap-2 cursor-pointer transition-colors',
            onClick: (e: MouseEvent) => {
              e.stopPropagation()
              popoverOpen.value = false
              insertNode(index, 'AND_SIGN')
            },
          },
          [h(TeamOutlined, { class: 'text-purple-600' }), t('approval.definition.insertAndSign')],
        ),
        h(
          'button',
          {
            type: 'button',
            class:
              'w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-amber-50 hover:text-amber-600 rounded-md flex items-center gap-2 cursor-pointer transition-colors',
            onClick: (e: MouseEvent) => {
              e.stopPropagation()
              popoverOpen.value = false
              insertNode(index, 'OR_SIGN')
            },
          },
          [
            h(ApartmentOutlined, { class: 'text-amber-600' }),
            t('approval.definition.insertOrSign'),
          ],
        ),
        h(
          'button',
          {
            type: 'button',
            class:
              'w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-teal-50 hover:text-teal-600 rounded-md flex items-center gap-2 cursor-pointer transition-colors',
            onClick: (e: MouseEvent) => {
              e.stopPropagation()
              popoverOpen.value = false
              insertNode(index, 'CC')
            },
          },
          [h(SendOutlined, { class: 'text-teal-600' }), t('approval.definition.insertCc')],
        ),
        h('div', { class: 'border-t border-slate-100 my-1' }),
        h(
          'button',
          {
            type: 'button',
            class:
              'w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-md flex items-center gap-2 cursor-pointer transition-colors',
            onClick: (e: MouseEvent) => {
              e.stopPropagation()
              popoverOpen.value = false
              insertParallelAfter(index, 'AND')
            },
          },
          [
            h(BranchesOutlined, { class: 'text-indigo-600' }),
            t('approval.definition.insertParallelAnd'),
          ],
        ),
        h(
          'button',
          {
            type: 'button',
            class:
              'w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-md flex items-center gap-2 cursor-pointer transition-colors',
            onClick: (e: MouseEvent) => {
              e.stopPropagation()
              popoverOpen.value = false
              insertParallelAfter(index, 'OR')
            },
          },
          [
            h(BranchesOutlined, { class: 'text-indigo-600' }),
            t('approval.definition.insertParallelOr'),
          ],
        ),
      ])

      return h(
        'div',
        {
          class: [
            'w-64 bg-white border-2 rounded-xl shadow-xs cursor-pointer transition-all relative group',
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
                'px-3 py-2 flex items-center justify-between text-xs font-semibold rounded-t-lg',
                headerClass,
              ],
            },
            [
              h('div', { class: 'flex items-center gap-1.5 truncate flex-1' }, [
                h(TypeIcon, { class: 'text-xs shrink-0' }),
                h('span', { class: 'truncate' }, node.name || '未命名节点'),
              ]),
              h(
                'span',
                { class: 'text-2xs bg-white/20 px-1.5 py-0.5 rounded shrink-0 ml-1 font-normal' },
                typeText,
              ),
            ],
          ),
          // Body
          h('div', { class: 'p-3 text-xs space-y-1.5 bg-white' }, [
            h('div', { class: 'flex items-center justify-between' }, [
              h('span', { class: 'text-slate-500 font-medium text-2xs' }, '处理对象'),
              assigneeInfo.isConfigured
                ? h(
                    Tag,
                    {
                      class:
                        'm-0 px-1.5 py-0 text-3xs rounded font-normal bg-emerald-50 text-emerald-600 border-emerald-200',
                    },
                    () => [
                      h(CheckCircleOutlined, { class: 'mr-0.5' }),
                      t('approval.definition.nodeConfigStatusComplete'),
                    ],
                  )
                : h(
                    Tag,
                    {
                      class:
                        'm-0 px-1.5 py-0 text-3xs rounded font-normal bg-amber-50 text-amber-600 border-amber-200 animate-pulse',
                    },
                    () => [
                      h(WarningOutlined, { class: 'mr-0.5' }),
                      t('approval.definition.nodeConfigStatusIncomplete'),
                    ],
                  ),
            ]),
            h(
              'div',
              {
                class: [
                  'text-xs font-medium rounded-lg p-1.5 truncate transition-colors',
                  assigneeInfo.isConfigured
                    ? 'bg-slate-50 text-slate-700 border border-slate-100'
                    : 'bg-amber-50 text-amber-700 border border-amber-200',
                ],
                title: assigneeInfo.displayText,
              },
              assigneeInfo.displayText,
            ),
          ]),
          // Actions bar
          h(
            'div',
            {
              class:
                'px-3 py-1.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between rounded-b-lg text-2xs',
            },
            [
              h(
                'button',
                {
                  type: 'button',
                  class:
                    'text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer font-medium',
                  onClick: (e: MouseEvent) => {
                    e.stopPropagation()
                    openNodeDrawer(index)
                  },
                },
                [h(SettingOutlined), '设置'],
              ),
              h('div', { class: 'flex items-center gap-2' }, [
                h(
                  'button',
                  {
                    type: 'button',
                    class:
                      'text-slate-500 hover:text-slate-700 flex items-center gap-1 cursor-pointer',
                    title: t('approval.definition.copyNode'),
                    onClick: (e: MouseEvent) => {
                      e.stopPropagation()
                      cloneNode(index)
                    },
                  },
                  [h(CopyOutlined), t('approval.definition.copyNode')],
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    class:
                      'text-red-500 hover:text-red-600 flex items-center gap-1 cursor-pointer',
                    onClick: (e: MouseEvent) => {
                      e.stopPropagation()
                      removeNode(index)
                    },
                  },
                  [h(DeleteOutlined), '删除'],
                ),
              ]),
            ],
          ),
          // Bottom Output Handle (Source)
          h(Handle, {
            type: 'source',
            position: Position.Bottom,
            class:
              'w-3.5 h-3.5 !bg-blue-500 hover:!bg-blue-600 !border-2 !border-white rounded-full transition-transform hover:scale-125 cursor-crosshair shadow-xs',
          }),
          // Bottom Hover "+" Quick Insert Button
          h(
            'div',
            {
              class:
                'absolute -bottom-3 left-1/2 -translate-x-1/2 z-20 transition-all opacity-90 hover:opacity-100 group-hover:scale-110',
            },
            [
              h(
                Popover,
                {
                  open: popoverOpen.value,
                  trigger: 'click',
                  placement: 'bottom',
                  'onUpdate:open': (val: boolean) => (popoverOpen.value = val),
                },
                {
                  default: () =>
                    h(
                      Tooltip,
                      { title: t('approval.definition.addNodeAfter') },
                      {
                        default: () =>
                          h(
                            'button',
                            {
                              type: 'button',
                              class:
                                'w-6 h-6 rounded-full bg-blue-600 text-white shadow-md flex items-center justify-center text-xs hover:bg-blue-500 cursor-pointer border-2 border-white',
                              onClick: (e: MouseEvent) => {
                                e.stopPropagation()
                              },
                            },
                            [h(PlusOutlined)],
                          ),
                      },
                    ),
                  content: () => quickInsertMenu,
                },
              ),
            ],
          ),
        ],
      )
    }
  },
})

const FlowGatewayView = markRaw({
  props: {
    data: { type: Object, required: true },
  },
  setup(nodeProps: {
    data: {
      node: ApprovalNodeInput
      index: number
      isSelected: boolean
    }
  }) {
    return () => {
      const { node, index, isSelected } = nodeProps.data
      const isFork = node.type === 'FORK'
      const isOrJoin =
        node.type === 'JOIN' &&
        (node.conditionConfig as { joinType?: string } | undefined)?.joinType === 'OR'
      const label = isFork
        ? t('approval.definition.parallelForkLabel')
        : isOrJoin
          ? t('approval.definition.parallelOrJoinLabel')
          : t('approval.definition.parallelAndJoinLabel')
      const handleClass = isOrJoin ? '!bg-amber-500' : '!bg-indigo-500'
      const diamondClass = isOrJoin
        ? isSelected
          ? 'border-amber-600 bg-amber-50 ring-4 ring-amber-100'
          : 'border-amber-400 bg-amber-50 group-hover:border-amber-600'
        : isSelected
          ? 'border-indigo-600 bg-indigo-50 ring-4 ring-indigo-100'
          : 'border-indigo-400 bg-indigo-50 group-hover:border-indigo-600'
      const labelClass = isOrJoin
        ? 'border-amber-200 text-amber-700'
        : 'border-indigo-200 text-indigo-700'

      return h(
        'div',
        {
          class: [
            'relative w-28 h-24 flex flex-col items-center justify-center cursor-pointer bg-transparent border-0 group',
            'focus-visible:outline-none',
          ],
          onClick: () => openNodeDrawer(index),
        },
        [
          h(Handle, {
            type: 'target',
            position: Position.Top,
            class: `w-3.5 h-3.5 ${handleClass} !border-2 !border-white rounded-full cursor-crosshair shadow-xs`,
          }),
          h(
            'div',
            {
              class: [
                'w-12 h-12 rotate-45 rounded-lg border-2 transition-all shadow-xs flex items-center justify-center',
                diamondClass,
              ],
            },
            [
              h(
                'span',
                {
                  class: [
                    '-rotate-45 text-lg font-bold leading-none',
                    isOrJoin ? 'text-amber-700' : 'text-indigo-700',
                  ],
                },
                isFork ? '+' : '•',
              ),
            ],
          ),
          h(
            'span',
            {
              class: `absolute bottom-0 whitespace-nowrap rounded-full border bg-white px-2 py-0.5 text-2xs font-semibold shadow-2xs ${labelClass}`,
            },
            label,
          ),
          isFork
            ? h(
                'div',
                {
                  class:
                    'absolute -bottom-3 left-1/2 -translate-x-1/2 z-20 transition-all opacity-90 hover:opacity-100 group-hover:scale-105',
                },
                [
                  h(
                    Tooltip,
                    { title: t('approval.definition.addBranchBtn') },
                    {
                      default: () =>
                        h(
                          'button',
                          {
                            type: 'button',
                            class:
                              'px-2 py-0.5 rounded-full bg-indigo-600 text-white shadow-md flex items-center gap-1 text-3xs hover:bg-indigo-500 cursor-pointer border border-white whitespace-nowrap',
                            onClick: (e: MouseEvent) => {
                              e.stopPropagation()
                              addBranchToFork(index)
                            },
                          },
                          [h(PlusOutlined), t('approval.definition.addBranch')],
                        ),
                    },
                  ),
                ],
              )
            : null,
          h(Handle, {
            type: 'source',
            position: Position.Bottom,
            class: `w-3.5 h-3.5 ${handleClass} !border-2 !border-white rounded-full cursor-crosshair shadow-xs`,
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
  gatewayNode: FlowGatewayView,
  startNode: FlowStartView,
  endNode: FlowEndView,
}

const { fitView, zoomIn, zoomOut, onPaneReady } = useVueFlow()
const isPaneReady = ref(false)

onPaneReady(() => {
  isPaneReady.value = true
  fitViewSoon()
})

function fitViewSoon(): void {
  setTimeout(() => {
    try {
      void fitView({ padding: 0.25, duration: 200 })
    } catch {
      // ignore if tab hidden
    }
  }, 100)
}

function handleZoomIn(): void {
  void zoomIn({ duration: 200 })
}

function handleZoomOut(): void {
  void zoomOut({ duration: 200 })
}

function handleFitView(): void {
  void fitView({ padding: 0.25, duration: 200 })
}

/** 重置布局：布局由图模型确定性推导，拖拽后可一键还原 */
function resetLayout(): void {
  layoutNonce.value += 1
  fitViewSoon()
}

watch(
  () => [props.nodes.length, props.edges.length],
  () => fitViewSoon(),
)

const NODE_W = 260
const NODE_GAP_X = 60
const LAYER_GAP_Y = 170

const layoutNonce = ref(0)

const flowNodes = computed<Node[]>(() => {
  void layoutNonce.value
  const list: Node[] = []
  const centerX = 420
  let y = 30

  list.push({
    id: 'start-node',
    type: 'startNode',
    position: { x: centerX - 96, y },
    data: {},
    draggable: true,
    selectable: false,
  })

  y += 120

  const g = graph.value
  const layers = new Map<number, typeof g.items>()
  for (const item of g.items) {
    const d = g.depthOf.get(item.key) ?? 0
    const arr = layers.get(d) ?? []
    arr.push(item)
    layers.set(d, arr)
  }

  for (const depth of [...layers.keys()].sort((a, b) => a - b)) {
    const arr = layers.get(depth)!
    const k = arr.length
    const totalWidth = k * NODE_W + (k - 1) * NODE_GAP_X
    const startX = centerX - totalWidth / 2

    arr.forEach((item, j) => {
      const isGateway = item.node.type === 'FORK' || item.node.type === 'JOIN'
      list.push({
        id: `n:${item.key}`,
        type: isGateway ? 'gatewayNode' : 'flowNode',
        position: {
          x: startX + j * (NODE_W + NODE_GAP_X) + (isGateway ? (NODE_W - 112) / 2 : 0),
          y,
        },
        data: {
          node: item.node,
          index: item.index,
          isSelected: selectedNodeIndex.value === item.index,
          assigneeInfo: getAssigneeInfo(item.node),
        },
        draggable: true,
        selectable: false,
      })
    })

    y += LAYER_GAP_Y
  }

  list.push({
    id: 'end-node',
    type: 'endNode',
    position: { x: centerX - 72, y },
    data: {},
    draggable: true,
    selectable: false,
  })

  return list
})

const EDGE_COLORS: Record<string, string> = {
  AND_SIGN: '#722ed1',
  OR_SIGN: '#fa8c16',
  CC: '#13c2c2',
}

const canvasEdges = computed<Edge[]>(() => {
  const list: Edge[] = []
  const g = graph.value
  const typeByKey = new Map(g.items.map((i) => [i.key, i.node.type ?? 'SEQ']))

  // 模型边：终点为空表示汇入流程结束
  for (const e of g.resolvedEdges) {
    const id = `e:${e.fromNodeKey}->${e.toNodeKey ?? ''}`
    const selected = selectedEdgeId.value === id
    const stroke = e.toNodeKey
      ? (EDGE_COLORS[typeByKey.get(e.toNodeKey) ?? ''] ?? '#3b82f6')
      : '#64748b'
    list.push({
      id,
      source: `n:${e.fromNodeKey}`,
      target: e.toNodeKey ? `n:${e.toNodeKey}` : 'end-node',
      animated: true,
      type: 'smoothstep',
      selectable: true,
      markerEnd: { type: MarkerType.ArrowClosed, color: selected ? '#dc2626' : stroke },
      style: { stroke: selected ? '#dc2626' : stroke, strokeWidth: selected ? 3.5 : 2 },
    })
  }

  // 入口边：无入边的节点从发起人接入（发布校验要求唯一入口）
  for (const item of g.items) {
    if ((g.incomingOf.get(item.key)?.length ?? 0) === 0) {
      list.push({
        id: `e:start->${item.key}`,
        source: 'start-node',
        target: `n:${item.key}`,
        animated: true,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' },
        style: { stroke: '#10b981', strokeWidth: 2 },
      })
    }
    if ((g.outgoingOf.get(item.key)?.length ?? 0) === 0) {
      list.push({
        id: `virtual:${item.key}->end`,
        source: `n:${item.key}`,
        target: 'end-node',
        animated: false,
        selectable: false,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
        style: { stroke: '#94a3b8', strokeWidth: 1.5, strokeDasharray: '5 4' },
      })
    }
  }

  return list
})

// ================= 连线交互：直接修改边模型 =================

function parseNodeKey(id: string | null | undefined): string | null {
  if (!id || !id.startsWith('n:')) return null
  return id.slice(2)
}

function handleConnect(params: Connection): void {
  const sourceKey = parseNodeKey(params.source)
  const targetKey = parseNodeKey(params.target)
  if (!sourceKey || !targetKey) return

  if (sourceKey === targetKey) {
    void message.warning(t('approval.definition.connectSelfLoop'))
    return
  }

  const g = graph.value
  const sourceNode = g.items.find((item) => item.key === sourceKey)?.node
  const allowsMultipleOutgoing = sourceNode?.type === 'FORK' || sourceNode?.type === 'CONDITION'
  if (!allowsMultipleOutgoing && (g.outgoingOf.get(sourceKey)?.length ?? 0) > 0) {
    void message.warning(t('approval.definition.connectOutgoingLimit'))
    return
  }
  if (
    g.resolvedEdges.some((e) => e.fromNodeKey === sourceKey && (e.toNodeKey ?? '') === targetKey)
  ) {
    void message.info(t('approval.definition.connectDuplicate'))
    return
  }
  if (reaches(g, targetKey, sourceKey)) {
    void message.warning(t('approval.definition.connectCycle'))
    return
  }

  emit('update:edges', [
    ...g.resolvedEdges.map((e) => ({ ...e })),
    { fromNodeKey: sourceKey, toNodeKey: targetKey },
  ])
  selectedEdgeId.value = null
  void message.success(t('approval.definition.connectSuccess'))
}

function handleEdgeClick(event: EdgeMouseEvent): void {
  const id = event.edge.id
  if (!id.startsWith('e:') || id.startsWith('e:start->')) return
  event.event?.stopPropagation()
  selectedEdgeId.value = id
  designerRootRef.value?.focus()
}

function removeSelectedEdge(): void {
  const id = selectedEdgeId.value
  if (!id) return
  const arrowIdx = id.indexOf('->')
  if (arrowIdx < 0) return
  const from = id.slice(2, arrowIdx)
  const to = id.slice(arrowIdx + 2)
  emit(
    'update:edges',
    graph.value.resolvedEdges
      .filter((e) => !(e.fromNodeKey === from && (e.toNodeKey ?? '') === to))
      .map((e) => ({ ...e })),
  )
  selectedEdgeId.value = null
  void message.success(t('approval.definition.deleteEdgeSuccess'))
}

function handleDesignerKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Delete' && event.key !== 'Backspace') return
  if (!selectedEdgeId.value) return
  event.preventDefault()
  removeSelectedEdge()
}

function clearEdgeSelection(): void {
  selectedEdgeId.value = null
}
</script>

<template>
  <div
    ref="designerRootRef"
    tabindex="0"
    class="flow-designer-tab relative h-[580px] border border-slate-200 rounded-xl overflow-hidden bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
    @keydown="handleDesignerKeydown"
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
          class="text-xs"
          @click="insertNode(props.nodes.length - 1, 'CC')"
        >
          <SendOutlined />
          {{ t('approval.definition.addCc') }}
        </Button>
        <Button
          data-testid="add-parallel-approval"
          size="small"
          class="text-xs"
          @click="appendParallelApproval('AND')"
        >
          <BranchesOutlined />
          {{ t('approval.definition.addParallelAndApproval') }}
        </Button>
        <Button
          data-testid="add-parallel-or-approval"
          size="small"
          class="text-xs"
          @click="appendParallelApproval('OR')"
        >
          <BranchesOutlined />
          {{ t('approval.definition.addParallelOrApproval') }}
        </Button>
      </div>

      <div class="flex items-center gap-1 pr-2 border-r border-slate-200">
        <Tooltip :title="t('approval.definition.zoomIn')">
          <Button size="small" class="text-xs px-2" @click="handleZoomIn">
            <ZoomInOutlined />
          </Button>
        </Tooltip>
        <Tooltip :title="t('approval.definition.zoomOut')">
          <Button size="small" class="text-xs px-2" @click="handleZoomOut">
            <ZoomOutOutlined />
          </Button>
        </Tooltip>
        <Tooltip :title="t('approval.definition.fitView')">
          <Button size="small" class="text-xs px-2" @click="handleFitView">
            <FullscreenOutlined />
          </Button>
        </Tooltip>
        <Tooltip :title="t('approval.definition.resetLayout')">
          <Button size="small" class="text-xs" @click="resetLayout">
            <ReloadOutlined />
            {{ t('approval.definition.resetLayout') }}
          </Button>
        </Tooltip>
      </div>

      <Button
        v-if="selectedEdgeId"
        data-testid="delete-edge"
        danger
        size="small"
        class="text-xs"
        @click="removeSelectedEdge"
      >
        <DisconnectOutlined />
        {{ t('approval.definition.deleteConnection') }}
      </Button>
    </div>

    <!-- 画布主体 -->
    <VueFlow
      :nodes="flowNodes"
      :edges="canvasEdges"
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
      @pane-click="clearEdgeSelection"
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

        <FormItem v-if="!currentNodeIsGateway" :label="t('approval.definition.nodeType')">
          <Select
            :value="currentNode.type || 'SEQ'"
            :options="nodeTypeOptions"
            @update:value="(val) => updateCurrentNode({ type: val as ApprovalNodeType })"
          />
        </FormItem>

        <div v-if="currentNodeIsGateway" class="space-y-3 mb-4">
          <div
            class="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-xs leading-5 text-indigo-700"
          >
            {{ t('approval.definition.gatewayNodeHint') }}
          </div>

          <!-- 分支管理面板 -->
          <div class="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-700">
                {{ t('approval.definition.branchListTitle') }}
              </span>
              <Tag class="m-0 font-mono text-3xs text-indigo-700 bg-indigo-50 border-indigo-200">
                {{ t('approval.definition.branchCountBadge', { count: currentForkBranches.length }) }}
              </Tag>
            </div>

            <div class="space-y-2">
              <div
                v-for="(branch, bIdx) in currentForkBranches"
                :key="branch.key"
                class="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 hover:border-indigo-300 transition-colors shadow-2xs"
              >
                <div class="min-w-0 flex-1 pr-2">
                  <div class="flex items-center gap-1.5">
                    <span class="text-xs font-semibold text-slate-800 truncate">
                      {{ branch.node.name || `分支 ${bIdx + 1}` }}
                    </span>
                    <Tag
                      v-if="branch.node.type === 'AND_SIGN'"
                      class="m-0 text-3xs text-purple-600 bg-purple-50 border-purple-200"
                    >
                      会签
                    </Tag>
                    <Tag
                      v-else-if="branch.node.type === 'OR_SIGN'"
                      class="m-0 text-3xs text-amber-600 bg-amber-50 border-amber-200"
                    >
                      或签
                    </Tag>
                  </div>
                  <div class="text-2xs text-slate-500 mt-0.5 truncate">
                    {{ branch.assigneeInfo.displayText || '未指定处理人' }}
                  </div>
                </div>

                <Button
                  size="small"
                  type="link"
                  class="text-xs px-1 text-blue-600 hover:text-blue-700 shrink-0 font-medium"
                  @click="openNodeDrawer(branch.index)"
                >
                  {{ t('approval.definition.jumpToBranchSettings') }}
                </Button>
              </div>
            </div>

            <Button
              v-if="currentForkIndex !== null"
              type="dashed"
              block
              size="small"
              class="text-xs text-indigo-600 hover:text-indigo-700 border-indigo-300 hover:border-indigo-400 bg-white"
              @click="addBranchToFork(currentForkIndex)"
            >
              <PlusOutlined />
              {{ t('approval.definition.addBranchBtn') }}
            </Button>
          </div>
        </div>

        <FormItem
          v-if="currentNode.type === 'JOIN'"
          :label="t('approval.definition.parallelJoinStrategy')"
        >
          <Select
            :value="
              (currentNode.conditionConfig as { joinType?: string } | undefined)?.joinType || 'AND'
            "
            :options="joinTypeOptions"
            @update:value="updateCurrentJoinType"
          />
        </FormItem>

        <div
          v-if="currentNode.type === 'AND_SIGN' || currentNode.type === 'OR_SIGN'"
          class="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800"
        >
          {{ t('approval.definition.signNodeParallelHint') }}
        </div>

        <FormItem v-if="!currentNodeIsGateway" :label="t('approval.definition.assigneeType')">
          <Select
            :value="currentNode.assigneeType"
            :options="assigneeTypeOptions"
            @update:value="
              (val) => updateCurrentNode({ assigneeType: val as ApprovalAssigneeType })
            "
          />
        </FormItem>

        <FormItem
          v-if="!currentNodeIsGateway && currentNode.assigneeType === 'USER'"
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
          v-else-if="!currentNodeIsGateway && currentNode.assigneeType === 'ROLE'"
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
          v-else-if="!currentNodeIsGateway && currentNode.assigneeType === 'DEPT'"
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
          v-else-if="!currentNodeIsGateway && currentNode.assigneeType === 'POST'"
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
          v-else-if="
            !currentNodeIsGateway &&
            ['DEPT_LEADER', 'INITIATOR_LEADER', 'SELF'].includes(currentNode.assigneeType)
          "
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

        <div
          v-if="!currentNodeIsGateway && currentNode.type !== 'CC'"
          class="pt-3 border-t border-slate-100 space-y-3"
        >
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
              :options="currentRejectTargetOptions"
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
    cursor: pointer;
  }
}
</style>
