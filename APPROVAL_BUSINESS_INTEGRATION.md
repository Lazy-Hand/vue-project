# 审批流业务模块接入文档（前端）

> 文档状态：已实施（与后端批二/批三实现同步）
> 适用范围：需要把业务单据接入审批流程的前端开发与实施人员
> 参考实现：`src/views/system/project/`（ProjectApprovalDialog、ProjectDetailDrawer）与 `src/views/approval/`
> 配套文档：后端 `APPROVAL_BUSINESS_INTEGRATION.md`（数据契约、Outbox 回写、API 与权限）、`../nest-go/APPROVAL_WORKFLOW_IMPLEMENTATION_PLAN.md`（审批三批实施计划）

## 1. 前端接入面总览

审批模块（`src/views/approval/`）**不直接依赖任何业务模块**，业务通过三个松耦合入口接入：

| 入口 | 位置 | 作用 |
| --- | --- | --- |
| 单据注册表 | `src/views/approval/businessRegistry.ts` | `businessType` → 只读详情组件（或 fetch），实例详情抽屉按此渲染业务单据 |
| 审批 API | `src/api/approval.ts` + `src/types/approval.ts` | 实例查询/详情、待办已办、任务操作、场景绑定、Outbox 运维等全部封装 |
| 业务页发起入口 | 业务模块自己的页面（参考 `ProjectApprovalDialog.vue`） | 业务状态机允许时发起审批，只让用户确认标题 |

发送/回放链路（前端视角）：

1. 业务页发起审批（业务模块自己的 API，如 `POST /api/project/:id/approval`），流程版本由后端按场景绑定解析，**前端不选流程**；
2. 审批人/申请人通过待办中心（`views/approval/todo/`）、我发起的（`views/approval/done/`）、业务页审批记录抽屉（`ApprovalRecordsDrawer.vue`）进入实例详情；
3. 实例详情抽屉（`views/approval/instance/InstanceDetailDrawer.vue`）按实例的 `businessType` 命中注册表，渲染业务只读详情；
4. SSE（`useNoticeSse`）实时推送 `approval:todo` / `approval:todo-refresh`，刷新待办角标与列表。

## 2. 接入步骤（以项目模块为模板）

### 2.1 注册业务单据只读详情

在 `src/views/approval/businessRegistry.ts` 注册一行（`businessType` 与后端 `ApprovalInstance.businessType` 完全一致）：

```ts
export const businessDetailRegistry: Record<string, BusinessRegistryEntry> = {
  project: { label: 'project', component: ProjectDetailReadonly },
  // 新增业务只需在此注册：
  'my-business': { label: '我的业务', component: MyBusinessDetailReadonly },
}
```

`BusinessRegistryEntry` 两种形态：

- **`component`（推荐）**：只读组件，接收 `businessId: string` 与 `formData: Record<string, unknown> | null` 两个 props（`BusinessDetailHost.vue` 语义：命中注册组件且有 businessId 时渲染组件并透传 props）。
- **`fetch`**：`(businessId) => Promise<Record<string, unknown>>`，按 businessId 拉取详情后渲染（组件未注册时兜底到业务占位/表单数据透出）。

**只读组件必须"快照优先"**：审批查看的是发起时的业务快照，与当前数据可能不一致。参考 `ProjectDetailReadonly.vue`：

- 对 `formData` 做**完整运行时类型守卫**（`isProjectSnapshot`/`parseSnapshot`，含 `snapshotVersion` 版本守卫），守卫不通过则展示兜底而非崩溃；
- `formData` 缺失或命中 `snapshotVersion` 旧版本时回退展示占位提示，不要静默显示空；
- 展示优先级：`formData` 快照 → （可选）接口拉取当前数据 → 占位提示；项目模块当前**只渲染快照**，不重新拉取当前数据，避免与后端"审批期间数据锁定"的语义冲突。

### 2.2 业务页发起审批

参考 `ProjectApprovalDialog.vue`（发起弹窗）与 `ProjectDetailDrawer.vue`（入口与提交）：

- 发起弹窗只收集**标题**（可预填业务名），流程版本后端按场景绑定解析（B2-03），不要在页面让用户选流程；
- 提交走**业务模块自己的 API**（如 `createProjectApproval(id, payload)` → `POST /api/project/:id/approval`），不在业务页直接调 `POST /api/approval/instances`（那是模式 B 通用入口）;
- 入口显隐用权限指令：`hasPermission('system:project:approve') | hasPermission('system:project:query')` 等（与后端接口权限码一致）；
- **审批期锁定**：业务状态为 `PENDING_*_APPROVAL` 时，所有写入口禁用并提示原因（项目 `approvalLocked` computed + 写入口统一 `guard`）；提交成功后刷新业务详情；
- 弹窗提交中状态用 `defineExpose({ setSubmitting })` 由父组件控制（禁用重复提交），失败用 `message.error` 展示后端错误。

### 2.3 业务页展示审批记录

直接复用 `src/views/approval/components/ApprovalRecordsDrawer.vue`：

```vue
<ApprovalRecordsDrawer
  v-model:open="recordsOpen"
  :business-type="'my-business'"
  :business-id="detail.id"
/>
```

该抽屉按 `businessType + businessId` 拉取实例列表，展示状态、最近一条审批意见，并可内嵌打开实例详情抽屉（`InstanceDetailDrawer`）。注意：它调用的是管理视角接口 `fetchApprovalInstances`（需 `system:approval:instance:query` 权限），业务页面用它时前端需校验权限。

### 2.4 实例详情中的数据与操作

`fetchApprovalInstanceDetail(id)` 返回 `ApprovalInstanceDetail`：

```ts
interface ApprovalInstanceDetail {
  instance: ApprovalInstance        // 含 formData（快照/表单载荷）、businessType/businessId、sceneCode
  tasks: ApprovalTask[]
  logs: ApprovalLog[]
  myPendingTask: ApprovalTask | null  // 当前用户在本实例的待办；无则 null
  capabilities: ApprovalCapabilities  // canApprove/canReject/canTransfer/canAddSign/canCancel/canComment
}
```

- 详情抽屉（`InstanceDetailDrawer.vue`）已实现：流程进度（`ApprovalFlowProgress`）、业务详情宿主（`BusinessDetailHost`）、任务处理（通过/驳回/转办/加签）、评论、撤销——**业务模块无需重复实现**；
- `capabilities` 由后端按参与人 ACL 与节点策略计算，前端**只按它决定按钮显隐**，不要自己拼权限逻辑；
- 待办列表项 `ApprovalTodoItem` 携带 `myPendingTaskId`，处理入口必须用**本人**的待办任务 ID（后端 `tasks/todo` 已按当前用户过滤，前端不要从实例任务列表里取第一条）。

### 2.5 待办实时刷新（SSE）

`src/composables/useNoticeSse.ts` 已消费审批事件（`approval:todo` 新待办、`approval:todo-refresh` 角标刷新），业务模块的列表页如需实时感知，复用该 composable：

```ts
useNoticeSse({
  onApprovalTodo: () => refreshTodoList(),
  onApprovalTodoRefresh: () => refreshTodoList(),
})
```

连接 `GET /api/notice/events?access_token=` 由 composable 内部维护（token 变化重连、心跳保活），业务页面不需要自己建 `EventSource`。

## 3. 涉及的 API 与类型

### 3.1 业务模块常用 API（`src/api/approval.ts`）

| 函数 | 后端端点 | 用途 |
| --- | --- | --- |
| `fetchApprovalInstances` | `GET /approval/instances` | 管理视角实例分页，支持 `businessType`/`businessId` 过滤（审批记录抽屉用） |
| `fetchMyApprovalInstances` | `GET /approval/instances/my` | 我发起的 |
| `fetchApprovalInstanceDetail` | `GET /approval/instances/:id` | 实例详情（含任务/日志/待办/能力） |
| `cancelApprovalInstance` | `POST /approval/instances/:id/cancel` | 撤销（仅申请人） |
| `commentApprovalInstance` | `POST /approval/instances/:id/comment` | 评论 |
| `fetchTodoList` / `fetchDoneList` | `GET /approval/tasks/todo` / `done` | 我的待办 / 已办 |
| `approveTask` / `rejectTask` / `transferTask` / `addSignTask` | `POST /approval/tasks/:id/*` | 任务操作 |

发起模式 B（通用审批）才用 `createApprovalInstance`；场景绑定业务一律走后端业务接口（如项目 `POST /api/project/:id/approval`）。

### 3.2 关键类型（`src/types/approval.ts`）

- `ApprovalInstance`：实例字段，`businessType`/`businessId`/`sceneCode`/`businessRevision`/`formData` 为业务侧关注字段；
- `ApprovalInstanceDetail` / `ApprovalTodoItem`：详情与待办（含 `myPendingTask` / `myPendingTaskId`、`capabilities`）；
- `ApprovalCapabilities`：六项操作能力，驱动按钮显隐；
- `ApprovalStatus`：`PENDING | APPROVED | REJECTED | CANCELLED`，与后端一致；
- 后端契约变更时同步本文件，勿在前端自定义枚举值。

### 3.3 权限

审批管理页（定义/场景绑定/Outbox/修复台/实例管理）是独立路由与菜单（见 `src/views/approval/`，权限码 `system:approval:*`）。业务模块页面接入审批时：

- 发起/查看审批按钮按**业务模块权限码**显隐（项目为 `system:project:approve` / `system:project:query`）；
- 审批记录抽屉调用的 `fetchApprovalInstances` 需要 `system:approval:instance:query`，前端在用到该能力时用 `hasPermission` 校验，避免权限不足时报错；
- 待办/我发起的等参与人视角接口无需额外权限码，由后端 ACL 控制。

## 4. i18n

审批模块文案集中在 `src/locales/zh-CN.ts` / `en-US.ts` 的 `approval` 段（新组件引用 `approval.*` 键）；业务模块自有弹窗/提示文案放业务模块自己的 locale 段（项目模块为 `project.approval*`）。新增接入时**必须补全两种语言**，并通过 `t()` 取用，禁止硬编码中文。

## 5. 接入验收清单

- [ ] `businessRegistry.ts` 已注册业务类型，只读组件对 `formData` 有完整运行时守卫（含 `snapshotVersion`），快照缺失时展示兜底；
- [ ] 业务页发起弹窗只收集标题，版本由后端场景绑定解析；提交走业务模块自己的 API；
- [ ] 审批期业务写入口全部禁用并提示原因；提交成功后刷新业务详情；
- [ ] 审批记录抽屉（或等价入口）已接入业务详情页，按钮显隐与后端权限码一致；
- [ ] 按钮显隐只依赖后端 `capabilities`，不使用本人待办以外的任务 ID；
- [ ] 中英文文案齐全，通过 `pnpm run lint` 与 `pnpm run type-check`（vue-tsc）。

## 6. 常见问题

- **实例详情看不到业务单据**：`businessType` 未在 `businessRegistry.ts` 注册，或后端 `businessType` 与注册表 key 不一致——详情抽屉会回落到占位组件（`BusinessDetailPlaceholder`）并透出 formData。
- **只读组件渲染报错**：`formData` 字段缺失/类型变化导致守卫失败——先看 `ProjectDetailReadonly` 的守卫写法，失败分支必须兜底，不能放任运行时异常。
- **发起按钮不显示**：业务状态机不允许（后端仅特定状态可发起）或前端权限码没配——项目模块用 `getProjectApprovalType(status)` 推算可发起类型，`approvalType === null` 时隐藏按钮。
- **审批期间业务还能被改**：前端 `approvalLocked` 只禁了 UI 入口，后端守卫才是真锁；前端锁定逻辑必须与后端 `PENDING_*_APPROVAL` 状态保持一致，后端拒绝（409）也要正常提示。