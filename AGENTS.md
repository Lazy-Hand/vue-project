# AGENTS.md

- 本项目为 Vue 3 + TypeScript 前端应用，使用 pnpm 包管理器，Node >= 22.12.0
- 样式方案：scss + tailwindcss，使用 tailwindcss 进行样式设计
- UI 组件库：antdv-next

## Project Structure

```
src/
├── __tests__/        # 测试文件
├── api/              # 接口文件
├── assets/           # 静态资源
│   ├── images/       # 图片资源（背景、插图、占位图等）
│   └── icons/        # 图标资源（SVG / 自定义图标）
├── components/       # 通用组件
├── composables/      # 组合式函数
├── constants/        # 常量
├── directives/       # 自定义指令
├── i18n/             # 国际化配置
├── layouts/          # 布局组件
├── locales/          # 本地化资源
├── mocks/            # 模拟数据
├── router/           # 路由配置
├── stores/           # 状态管理
├── styles/           # 样式文件
├── types/            # 类型定义
├── utils/            # 工具函数
├── views/            # 视图组件
```

- Never edit dist-prod/ — 构建产物（生产环境）
- Never edit dist-test/ — 构建产物（测试环境）

## Coding Style

- 代码风格以 ESLint、oxlint 为准；改完代码后应能通过 `pnpm lint`
- 格式化以 oxfmt 为准；提交前可用 `pnpm format`
- 使用 interface 定义 Props
- 组件命名：PascalCase，文件名 index.vue
- Never 使用 any 类型
- Never 使用内联样式（`style` / `:style`）；允许用 Tailwind `class`
- 尽量使用 scss，尽量使用 scoped
- 菜单图标：`@antdv-next/icons` 用组件名（如 `SettingOutlined`）；自定义 SVG 放 `src/assets/icons/*.svg`，字段写 `custom:文件名`（旧后端图标名由 `src/utils/icons.ts` 兼容映射）
- 国际化：界面文案必须支持中英文切换；Never 在代码中硬编码汉字或面向用户的中英文字符串
- 文案统一走 `vue-i18n`（`t('...')`），新增 key 同时写入 `src/locales/zh-CN.ts` 与 `src/locales/en-US.ts`
- 后端返回的业务数据名称（如菜单 `name`）除外，由接口按 `X-Locale` 本地化

## Build Commands

开发与预览：

```
pnpm dev              # 启动 Vite 开发服务器
pnpm preview          # 本地预览最近一次构建产物
```

构建（含类型检查）：

```
pnpm build            # 等同 build:prod：type-check + 生产构建 → dist-prod/
pnpm build:prod       # type-check + 生产环境构建（mode=production）→ dist-prod/
pnpm build:test       # type-check + 测试环境构建（mode=test）→ dist-test/
```

仅构建（跳过类型检查，一般给 CI/脚本用）：

```
pnpm build-only       # vite build（默认 mode）
pnpm build-only:prod  # vite build --mode production
pnpm build-only:test  # vite build --mode test
pnpm type-check       # vue-tsc 类型检查
```

测试与质量：

```
pnpm test:unit        # Vitest 单元测试（watch）
pnpm lint             # 依次执行 lint:oxlint + lint:eslint
pnpm lint:oxlint      # oxlint 检查并自动修复
pnpm lint:eslint      # ESLint 检查并自动修复
pnpm format           # oxfmt 格式化 src/
```
