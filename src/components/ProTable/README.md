# ProTable 高级表格

`ProTable` 是基于 Antdv Next `Table` 的请求驱动表格，统一处理查询表单、分页、远程排序、选择、加载与失败状态。组件保留列插槽和查询插槽，业务页面只需要描述查询项、列和数据请求。

## 快速开始

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from 'antdv-next'

import ProTable from '@/components/ProTable/index.vue'
import type {
  ProTableColumn,
  ProTableExpose,
  ProTableRequestParams,
  ProTableRequestResult,
  ProTableSearchField,
} from '@/types/pro-table'

interface UserRow {
  id: string
  username: string
  enabled: boolean
  createdAt: string
}

const { t } = useI18n()
const tableRef = ref<ProTableExpose<UserRow> | null>(null)

const searchFields = computed<ProTableSearchField[]>(() => [
  {
    prop: 'keyword',
    type: 'input',
    label: t('user.username'),
    placeholder: t('user.searchPlaceholder'),
  },
  {
    prop: 'enabled',
    type: 'select',
    label: t('user.enabled'),
    options: [
      { label: t('common.enabled'), value: true },
      { label: t('common.disabled'), value: false },
    ],
  },
])

const columns = computed<ProTableColumn<UserRow>[]>(() => [
  { type: 'selection', width: 48, reserveSelection: true },
  { type: 'index', label: '#', width: 64 },
  { prop: 'username', label: t('user.username'), minWidth: 140, sortable: 'custom' },
  { prop: 'enabled', label: t('user.enabled'), width: 100, type: 'tag' },
  { prop: 'createdAt', label: t('common.createdAt'), minWidth: 180 },
  {
    key: 'actions',
    label: t('common.actions'),
    width: 140,
    fixed: 'right',
    type: 'slot',
    slot: 'actions',
  },
])

async function requestUsers(
  params: ProTableRequestParams,
): Promise<ProTableRequestResult<UserRow>> {
  // 将 params 直接传给 API，或在这里适配后端字段名。
  return fetchUserList(params)
}

async function handleCreated(): Promise<void> {
  await tableRef.value?.reload()
}
</script>

<template>
  <ProTable
    ref="tableRef"
    :columns="columns"
    :search-fields="searchFields"
    :request="requestUsers"
    :default-sort="{ prop: 'username', order: 'ascending' }"
    @selection-change="handleSelectionChange"
  >
    <template #toolbar-actions>
      <Button type="primary" @click="openCreateDialog">
        {{ t('user.create') }}
      </Button>
    </template>

    <template #column-actions="{ row }">
      <Button type="link" @click="openEditDialog(row)">
        {{ t('common.edit') }}
      </Button>
    </template>
  </ProTable>
</template>
```

`UserRow` 会从 `request`、`columns` 传递到列插槽和组件实例方法，因此 `row`、`formatter`、选中行都保留业务类型。

## 请求约定

`request` 每次接收 `ProTableRequestParams`：

```ts
interface ProTableRequestParams {
  page: number
  pageSize: number
  sortField?: string
  sortOrder?: 'asc' | 'desc'
  [searchField: string]: unknown
}
```

返回值支持两种形式：

```ts
// 服务端分页，推荐
{ items: rows, total: 100 }

// 完整数组，通常配合 :pagination="false"
rows
```

只有 `sortable: 'custom'` 的列会触发重新请求，并写入 `sortField`、`sortOrder`。`sortable: true` 使用 Antdv Next 的当前页本地排序。

组件使用请求序号忽略过期响应。例如先发出的慢查询晚于新查询返回时，不会覆盖新数据。请求失败会触发 `request-error`，默认显示可替换的错误提示；旧数据不会被清空。

分页请求返回后，如果当前页已超过新的最大页码（常见于删除末页最后一条数据），组件会自动回退到有效的最后一页并重新请求。

> `clientFilter` 只处理本次 `request` 返回的数据。服务端分页返回对象时，它不会重算服务端 `total`，不适合代替跨页服务端查询。

## Props

| 属性                      | 类型                                            | 默认值           | 说明                                             |
| ------------------------- | ----------------------------------------------- | ---------------- | ------------------------------------------------ |
| `columns`                 | `ProTableColumn<T>[]`                           | 必填             | 列配置                                           |
| `searchFields`            | `ProTableSearchField[]`                         | `[]`             | 查询项配置                                       |
| `request`                 | `(params) => Promise<ProTableRequestResult<T>>` | 必填             | 数据请求函数                                     |
| `rowKey`                  | `string`                                        | `'id'`           | 行唯一键；跨页保留选择时必填                     |
| `pagination`              | `boolean \| ProTablePaginationConfig`           | `true`           | 是否分页及分页配置                               |
| `defaultSort`             | `{ prop, order }`                               | -                | 初始排序，`order` 为 `ascending` 或 `descending` |
| `immediate`               | `boolean`                                       | `true`           | 挂载后是否立即请求                               |
| `clientFilter`            | `(items, params) => items`                      | -                | 对本次响应做客户端过滤                           |
| `border`                  | `boolean`                                       | `false`          | 是否显示纵向边框                                 |
| `stripe`                  | `boolean`                                       | `false`          | 是否显示斑马纹                                   |
| `height`                  | `string \| number`                              | -                | 表格固定高度                                     |
| `maxHeight`               | `string \| number`                              | -                | 表格最大高度                                     |
| `showHeader`              | `boolean`                                       | `true`           | 是否显示表头                                     |
| `highlightCurrentRow`     | `boolean`                                       | `false`          | 是否高亮当前行                                   |
| `currentRowKey`           | `string \| number`                              | -                | 当前行的 key                                     |
| `defaultExpandAll`        | `boolean`                                       | `false`          | 树形表格是否默认展开全部                         |
| `treeProps`               | `ProTableTreeProps`                             | -                | 树节点字段配置                                   |
| `showSearchActions`       | `boolean`                                       | `true`           | 是否显示查询和重置区域                           |
| `showColumnSetting`       | `boolean`                                       | `true`           | 是否显示列设置入口                               |
| `searchCollapsible`       | `boolean`                                       | `true`           | 查询条件超出阈值时是否允许折叠                   |
| `searchCollapseThreshold` | `number`                                        | `3`              | 折叠状态下显示的查询项数量                       |
| `defaultSearchCollapsed`  | `boolean`                                       | `true`           | 查询条件是否默认折叠                             |
| `showRequestError`        | `boolean`                                       | `true`           | 请求失败时是否显示错误区域                       |
| `emptyText`               | `string`                                        | 国际化“暂无数据” | 空状态文案                                       |
| `emptyCellText`           | `string`                                        | `'-'`            | `null`、`undefined`、空字符串的占位文案          |

### 分页配置

```ts
interface ProTablePaginationConfig {
  pageSize?: number
  pageSizes?: number[]
  layout?: string
  small?: boolean
  background?: boolean
  hideOnSinglePage?: boolean
  pagerCount?: number
}
```

示例：

```vue
<ProTable
  :columns="columns"
  :request="requestUsers"
  :pagination="{
    pageSize: 20,
    pageSizes: [20, 50, 100],
    hideOnSinglePage: true,
  }"
/>
```

## 查询项

`ProTableSearchField.type` 支持：

| 类型          | 说明                                             |
| ------------- | ------------------------------------------------ |
| `input`       | 文本输入，默认类型；回车查询，清空后默认查询     |
| `select`      | Antdv Next 选择器，值变化后默认查询              |
| `dict-select` | 项目 `DictSelect`，需要 `dictTypeCode`           |
| `slot`        | 自定义查询控件，插槽名为 `search-{slot ?? prop}` |

通用配置：

| 属性                    | 说明                                             |
| ----------------------- | ------------------------------------------------ |
| `prop`                  | 查询参数名，必填                                 |
| `label` / `placeholder` | 标签和占位文案，应由调用方通过 `vue-i18n` 提供   |
| `defaultValue`          | 初始化及重置后的值                               |
| `clearable`             | 是否可清空                                       |
| `searchOnChange`        | 值变化后是否立即查询；可覆盖各类型默认行为       |
| `transform`             | 非空值加入请求参数前的转换函数                   |
| `fieldClass`            | 查询控件附加 class                               |
| `options`               | `select` 选项，支持 `label`、`value`、`disabled` |
| `multiple`              | `select` 是否多选                                |

空字符串、`null` 和空数组不会写入请求参数；`0` 与 `false` 会保留。

### 查询条件折叠

查询项超过 `searchCollapseThreshold`（默认 3）时，组件会显示“展开/收起”按钮，并默认只渲染前 3 项。折叠只改变表单显示，隐藏查询项的当前值仍会进入请求参数，重置时也会恢复其默认值。

```vue
<ProTable
  :columns="columns"
  :search-fields="searchFields"
  :request="requestUsers"
  :search-collapse-threshold="4"
  :default-search-collapsed="true"
  @search-collapse-change="handleSearchCollapseChange"
/>
```

不需要折叠时设置 `:search-collapsible="false"`。也可以通过实例方法 `setSearchCollapsed()` 或 `toggleSearchCollapse()` 控制状态。

### 自定义查询控件

```ts
const searchFields = computed<ProTableSearchField[]>(() => [
  {
    prop: 'createdAt',
    type: 'slot',
    label: t('common.createdAt'),
  },
])
```

```vue
<template #search-createdAt="{ modelValue, setValue, search }">
  <DateRangePicker
    :model-value="modelValue"
    value-format="YYYY-MM-DD"
    @update:value="setValue"
    @change="search"
  />
</template>
```

查询插槽参数包括 `field`、`modelValue`、`setValue(value)` 和 `search()`。

## 列配置

常用属性与 Antdv Next `Table` 列一致：`prop`、`label`、`width`、`minWidth`、`fixed`、`align`、`headerAlign`、`className`、`showOverflowTooltip`、`sortable` 和 `sortOrders`。

`type` 的扩展能力：

| 类型        | 说明                                                                      |
| ----------- | ------------------------------------------------------------------------- |
| `text`      | 普通文本，支持点路径，如 `department.name`                                |
| `tag`       | Antdv Next `Tag`；布尔值自动映射为启用/禁用，可用 `tagTypeMap` 映射其他值 |
| `dict`      | `DictTag`，需要 `dictTypeCode`                                            |
| `slot`      | 自定义单元格，插槽名为 `column-{slot}`                                    |
| `selection` | 多选列，支持 `selectable`、`reserveSelection`                             |
| `index`     | 序号列，支持 `index` 自定义序号                                           |

其他扩展属性：

- `formatter(row, column, cellValue, index)`：格式化普通列或标签文字。
- `trueLabel` / `falseLabel`：覆盖布尔标签文字。
- `headerSlot`：自定义表头，插槽名为 `header-{headerSlot}`。
- `hidden`：列的初始隐藏状态，可在列设置中恢复显示。
- `key`：无 `prop` 的特殊列建议提供稳定 key。

### 列设置

列设置默认显示在 `toolbar-actions` 所在操作行的右侧。用户可以拖动列名调整顺序，也可以勾选显示列、隐藏列或按 `columns[].hidden` 重置初始状态；至少保留一列可见。

拖动、显隐和重置操作只修改弹窗内的草稿，点击“保存”后才会统一应用到表格；直接关闭弹窗会放弃未保存修改。设置仅作用于当前组件实例，组件重新挂载后恢复列配置的初始状态。拖动把手获得焦点后，也可以使用方向键上、下调整顺序。

```vue
<!-- 默认启用 -->
<ProTable :columns="columns" :request="requestUsers" />

<!-- 页面不需要列设置时关闭 -->
<ProTable :columns="columns" :request="requestUsers" :show-column-setting="false" />
```

没有 `prop` 的操作列、选择列等应提供稳定的 `key`，避免列数组调整后设置项错位。

### 行操作收纳

操作超过两个时，推荐通过 `ProTableActions` 常驻高频操作，并将其余操作收入“更多”菜单。危险操作会集中显示在菜单底部。

```vue
<script setup lang="ts">
import { computed } from 'vue'

import ProTableActions from '@/components/ProTableActions/index.vue'
import type { ProTableAction } from '@/types/pro-table'

const userActions = computed<ProTableAction<UserRow>[]>(() => [
  {
    key: 'edit',
    label: t('common.edit'),
    placement: 'inline',
    onClick: openEditDialog,
  },
  {
    key: 'resetPassword',
    label: t('user.resetPassword'),
    onClick: openResetPasswordDialog,
  },
  {
    key: 'delete',
    label: t('common.delete'),
    danger: true,
    visible: (row) => !isCurrentUser(row),
    onClick: handleDelete,
  },
])
</script>

<template #column-actions="{ row }">
  <ProTableActions :row="row" :actions="userActions" />
</template>
```

`visible` 与 `disabled` 可以传入布尔值或按行判断的函数。默认不超过 3 个操作时全部显示；超过 3 个时显示前 2 个操作和“更多”，分别可通过 `collapse-threshold` 与 `max-inline` 调整。`placement: 'inline'` 可以提高常驻优先级，`placement: 'menu'` 会强制收入菜单。

当操作列无法完整容纳当前操作时，常驻操作会继续自动收入菜单；空间恢复后自动展开。危险操作在自动排序时最后进入常驻区域，并统一排列在菜单底部。

### 树形表格

树形数据直接由 `request` 返回，并关闭分页：

```vue
<ProTable
  ref="tableRef"
  row-key="id"
  :columns="columns"
  :request="requestTree"
  :pagination="false"
  :default-expand-all="true"
  :tree-props="{ children: 'children' }"
/>
```

通过 `tableRef.value?.setAllRowsExpanded(true)` 可以展开或收起当前树的全部节点。

## Slots

| 插槽              | 参数                                                                       | 说明                   |
| ----------------- | -------------------------------------------------------------------------- | ---------------------- |
| `toolbar-actions` | -                                                                          | 表格右上角业务操作     |
| `search-actions`  | `search`、`reset`、`loading`、`collapsible`、`collapsed`、`toggleCollapse` | 替换默认查询/重置按钮  |
| `search-{name}`   | `field`、`modelValue`、`setValue`、`search`                                | 自定义查询控件         |
| `column-{name}`   | `row`、`index`、`column`                                                   | 自定义单元格           |
| `header-{name}`   | `column`、`index`、`config`                                                | 自定义表头             |
| `empty`           | -                                                                          | 自定义空状态           |
| `request-error`   | `error`、`retry`                                                           | 替换默认请求失败提示   |
| `append`          | -                                                                          | 追加到表格最后一行之后 |

## Events

| 事件                       | 参数                 | 说明                 |
| -------------------------- | -------------------- | -------------------- |
| `row-click`                | `row, column, event` | 行点击               |
| `selection-change`         | `rows`               | 选中行变化           |
| `sort-change`              | `{ prop, order }`    | 排序状态变化         |
| `search-collapse-change`   | `collapsed`          | 查询条件折叠状态变化 |
| `column-visibility-change` | `visibleKeys`        | 保存后的可见列顺序   |
| `column-order-change`      | `orderedKeys`        | 保存后的全部列顺序   |
| `request-success`          | `result, params`     | 最新请求成功         |
| `request-error`            | `error, params`      | 最新请求失败         |

`sort-change.order` 沿用 `ascending`、`descending`、`null`；传给 `request` 时会转换成 `asc`、`desc`。

## 实例方法

通过 `ref<ProTableExpose<T>>` 调用：

| 方法                                 | 说明                                            |
| ------------------------------------ | ----------------------------------------------- |
| `reload()`                           | 使用当前查询、页码和排序重新请求                |
| `search()`                           | 回到第 1 页并请求                               |
| `resetSearch()`                      | 恢复查询默认值、回到第 1 页并请求               |
| `getSearchParams()`                  | 获取下一次请求会使用的完整参数                  |
| `setSearchParams(params, submit?)`   | 设置已声明查询项；`submit` 为 `true` 时立即查询 |
| `setSearchCollapsed(collapsed)`      | 设置查询条件折叠状态                            |
| `toggleSearchCollapse()`             | 切换查询条件折叠状态                            |
| `setAllRowsExpanded(expanded)`       | 展开或收起树形表格的全部节点                    |
| `getTableData()`                     | 获取当前表格数据                                |
| `getSelectedRows()`                  | 获取当前选中行                                  |
| `clearSelection()`                   | 清空选择                                        |
| `toggleRowSelection(row, selected?)` | 切换指定行的选择状态                            |

```ts
await tableRef.value?.setSearchParams({ keyword: 'admin' }, true)

const selected = tableRef.value?.getSelectedRows() ?? []
tableRef.value?.clearSelection()
```

## 使用建议

- 列、查询项及面向用户的文案使用 `computed` + `t(...)`，确保切换语言后立即更新。
- 跨页保留选择时，同时配置表格 `rowKey` 和选择列 `reserveSelection: true`。
- 删除当前页最后一条数据后，业务页面可根据需要调整查询条件或页码；`reload()` 会保持当前页。
- 后端排序字段与页面 `prop` 不一致时，在 `request` 函数中做映射，保持组件 API 简单。
