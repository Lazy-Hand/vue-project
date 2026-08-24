import { defineComponent, nextTick, type PropType } from 'vue'
import { shallowMount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import type { ApprovalEdgeInput, ApprovalNodeInput } from '@/types/approval'
import FlowDesignerTab from './FlowDesignerTab.vue'

vi.mock('@/api/dept', () => ({
  fetchDeptTree: vi.fn<() => Promise<never[]>>().mockResolvedValue([]),
}))
vi.mock('@/api/post', () => ({
  fetchPosts: vi.fn<() => Promise<never[]>>().mockResolvedValue([]),
}))
vi.mock('@/api/role', () => ({
  fetchRoles: vi.fn<() => Promise<never[]>>().mockResolvedValue([]),
}))
vi.mock('@/api/user', () => ({
  fetchUserList: vi
    .fn<() => Promise<{ items: never[]; total: number }>>()
    .mockResolvedValue({ items: [], total: 0 }),
}))

const VueFlowStub = defineComponent({
  name: 'VueFlow',
  props: {
    nodes: {
      type: Array as PropType<
        {
          id: string
          position: { x: number; y: number }
          data?: {
            node: ApprovalNodeInput
            index: number
            assigneeInfo?: { isConfigured: boolean }
          }
        }[]
      >,
      default: () => [],
    },
    edges: {
      type: Array as PropType<{ id: string }[]>,
      default: () => [],
    },
  },
  emits: ['connect', 'edge-click'],
  template: '<div data-testid="vue-flow"><slot /></div>',
})

function approvalNode(nodeKey: string, type: ApprovalNodeInput['type'] = 'SEQ'): ApprovalNodeInput {
  return {
    nodeKey,
    name: nodeKey,
    type,
    assigneeType: type === 'FORK' || type === 'JOIN' ? 'SELF' : 'USER',
    assigneeValue: type === 'FORK' || type === 'JOIN' ? undefined : '1',
  }
}

function mountDesigner(nodes: ApprovalNodeInput[], edges: ApprovalEdgeInput[]) {
  return shallowMount(FlowDesignerTab, {
    props: { nodes, edges },
    global: {
      plugins: [i18n],
      stubs: {
        VueFlow: VueFlowStub,
        Background: true,
        Controls: true,
        MiniMap: true,
      },
    },
  })
}

describe('FlowDesignerTab graph editing', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'zh-CN'
  })

  it('lays out all outgoing FORK branches in the same parallel layer', () => {
    const nodes = [
      approvalNode('fork', 'FORK'),
      approvalNode('branch_a'),
      approvalNode('branch_b'),
      approvalNode('join', 'JOIN'),
    ]
    const edges: ApprovalEdgeInput[] = [
      { fromNodeKey: 'fork', toNodeKey: 'branch_a' },
      { fromNodeKey: 'fork', toNodeKey: 'branch_b' },
      { fromNodeKey: 'branch_a', toNodeKey: 'join' },
      { fromNodeKey: 'branch_b', toNodeKey: 'join' },
    ]

    const wrapper = mountDesigner(nodes, edges)
    const renderedNodes = wrapper.findComponent(VueFlowStub).props('nodes') ?? []
    const branchA = renderedNodes.find((node) => node.id === 'n:branch_a')!
    const branchB = renderedNodes.find((node) => node.id === 'n:branch_b')!
    const join = renderedNodes.find((node) => node.id === 'n:join')!

    expect(branchA.position.y).toBe(branchB.position.y)
    expect(branchA.position.x).not.toBe(branchB.position.x)
    expect(join.position.y).toBeGreaterThan(branchA.position.y)
  })

  it('creates an explicit FORK and JOIN block for parallel approval', async () => {
    const wrapper = mountDesigner([approvalNode('first')], [])

    await wrapper.get('[data-testid="add-parallel-approval"]').trigger('click')

    const emittedNodes = wrapper.emitted('update:nodes')?.at(-1)?.[0] as ApprovalNodeInput[]
    const emittedEdges = wrapper.emitted('update:edges')?.at(-1)?.[0] as ApprovalEdgeInput[]
    const fork = emittedNodes.find((node) => node.type === 'FORK')!
    const join = emittedNodes.find((node) => node.type === 'JOIN')!
    const branches = emittedNodes.filter(
      (node) => node.nodeKey !== 'first' && node.type !== 'FORK' && node.type !== 'JOIN',
    )

    expect(branches).toHaveLength(2)
    expect(branches.every((b) => b.type === 'AND_SIGN')).toBe(true)
    expect(emittedEdges.filter((edge) => edge.fromNodeKey === fork.nodeKey)).toHaveLength(2)
    expect(emittedEdges.filter((edge) => edge.toNodeKey === join.nodeKey)).toHaveLength(2)
    expect(join.conditionConfig).toEqual({ joinType: 'AND' })
  })

  it('creates an OR join when parallel OR-sign is selected', async () => {
    const wrapper = mountDesigner([approvalNode('first')], [])

    await wrapper.get('[data-testid="add-parallel-or-approval"]').trigger('click')

    const emittedNodes = wrapper.emitted('update:nodes')?.at(-1)?.[0] as ApprovalNodeInput[]
    const join = emittedNodes.find((node) => node.type === 'JOIN')!
    const branches = emittedNodes.filter(
      (node) => node.nodeKey !== 'first' && node.type !== 'FORK' && node.type !== 'JOIN',
    )
    expect(branches).toHaveLength(2)
    expect(branches.every((b) => b.type === 'OR_SIGN')).toBe(true)
    expect(join.conditionConfig).toEqual({ joinType: 'OR' })
  })

  it('keeps a deleted connection deleted when the explicit edge list becomes empty', async () => {
    const nodes = [approvalNode('first'), approvalNode('second')]
    const wrapper = mountDesigner(nodes, [{ fromNodeKey: 'first', toNodeKey: 'second' }])
    const flow = wrapper.findComponent(VueFlowStub)

    flow.vm.$emit('edge-click', { edge: { id: 'e:first->second' } })
    await nextTick()

    await wrapper.get('[data-testid="delete-edge"]').trigger('click')
    await nextTick()
    expect(wrapper.emitted('update:edges')?.at(-1)?.[0]).toEqual([])

    await wrapper.setProps({ edges: [] })
    const renderedEdgeIds = (wrapper.findComponent(VueFlowStub).props('edges') ?? []).map(
      (edge) => edge.id,
    )
    expect(renderedEdgeIds).not.toContain('e:first->second')
  })

  it('automatically reconnects predecessor and successor when a middle node is removed', async () => {
    const nodes = [approvalNode('node_a'), approvalNode('node_b'), approvalNode('node_c')]
    const edges: ApprovalEdgeInput[] = [
      { fromNodeKey: 'node_a', toNodeKey: 'node_b' },
      { fromNodeKey: 'node_b', toNodeKey: 'node_c' },
    ]
    const wrapper = mountDesigner(nodes, edges)
    const renderedNodes = wrapper.findComponent(VueFlowStub).props('nodes') ?? []

    const nodeB = renderedNodes.find((n) => n.id === 'n:node_b')!
    expect(nodeB).toBeDefined()
    expect(nodeB.data?.assigneeInfo?.isConfigured).toBe(true)
  })
})
