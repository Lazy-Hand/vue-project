<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { Color } from '@tiptap/extension-color'
import { Highlight } from '@tiptap/extension-highlight'
import { Image } from '@tiptap/extension-image'
import { Link } from '@tiptap/extension-link'
import { Placeholder } from '@tiptap/extension-placeholder'
import { Table } from '@tiptap/extension-table'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableRow } from '@tiptap/extension-table-row'
import { TextAlign } from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import { Underline } from '@tiptap/extension-underline'
import { Button, Dropdown, Input, Modal, Select, Tooltip } from 'antdv-next'
import {
  AlignCenterOutlined,
  AlignLeftOutlined,
  AlignRightOutlined,
  BoldOutlined,
  ClearOutlined,
  CodeOutlined,
  DeleteOutlined,
  DisconnectOutlined,
  FontColorsOutlined,
  HighlightOutlined,
  ItalicOutlined,
  LineOutlined,
  LinkOutlined,
  OrderedListOutlined,
  PictureOutlined,
  RedoOutlined,
  StrikethroughOutlined,
  TableOutlined,
  UnderlineOutlined,
  UndoOutlined,
  UnorderedListOutlined,
} from '@antdv-next/icons'

export interface RichEditorProps {
  modelValue?: string
  placeholder?: string
  disabled?: boolean
  minHeight?: number | string
  maxHeight?: number | string
  toolbarMode?: 'full' | 'simple'
  bubbleMenu?: boolean
}

const props = withDefaults(defineProps<RichEditorProps>(), {
  modelValue: '',
  placeholder: '',
  disabled: false,
  minHeight: 220,
  maxHeight: 600,
  toolbarMode: 'full',
  bubbleMenu: true,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'change', value: string): void
  (e: 'focus', event: FocusEvent): void
  (e: 'blur', event: FocusEvent): void
}>()

const { t } = useI18n()

const linkModalVisible = ref(false)
const linkUrl = ref('')
const imageModalVisible = ref(false)
const imageUrl = ref('')

const minHeightStyle = computed(() => {
  if (typeof props.minHeight === 'number') return `${props.minHeight}px`
  return props.minHeight
})

const maxHeightStyle = computed(() => {
  if (typeof props.maxHeight === 'number') return `${props.maxHeight}px`
  return props.maxHeight
})

const editor = useEditor({
  content: props.modelValue,
  editable: !props.disabled,
  extensions: [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3],
      },
      link: false,
      underline: false,
    }),
    Underline,
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        target: '_blank',
        rel: 'noopener noreferrer',
      },
    }),
    Image.configure({
      inline: true,
      allowBase64: true,
    }),
    Placeholder.configure({
      placeholder: () => props.placeholder || t('editor.placeholder'),
    }),
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
    Table.configure({
      resizable: true,
    }),
    TableRow,
    TableHeader,
    TableCell,
  ],
  onUpdate: ({ editor: currentEditor }) => {
    const html = currentEditor.getHTML()
    const isEmpty = currentEditor.isEmpty
    const valueToEmit = isEmpty ? '' : html
    emit('update:modelValue', valueToEmit)
    emit('change', valueToEmit)
  },
  onFocus: ({ event }) => {
    emit('focus', event)
  },
  onBlur: ({ event }) => {
    emit('blur', event)
  },
})

// Sync outside modelValue changes
watch(
  () => props.modelValue,
  (newVal) => {
    if (!editor.value) return
    const isSame = editor.value.getHTML() === newVal
    if (!isSame) {
      editor.value.commands.setContent(newVal || '', { emitUpdate: false })
    }
  },
)

// Sync disabled state
watch(
  () => props.disabled,
  (val) => {
    if (editor.value) {
      editor.value.setEditable(!val)
    }
  },
)

// Paragraph / Heading selector value
const currentBlockType = computed(() => {
  if (!editor.value) return 'paragraph'
  if (editor.value.isActive('heading', { level: 1 })) return 'h1'
  if (editor.value.isActive('heading', { level: 2 })) return 'h2'
  if (editor.value.isActive('heading', { level: 3 })) return 'h3'
  return 'paragraph'
})

function handleBlockTypeChange(value: unknown) {
  if (!editor.value) return
  const str = String(value)
  if (str === 'paragraph') {
    editor.value.chain().focus().setParagraph().run()
  } else if (str === 'h1') {
    editor.value.chain().focus().toggleHeading({ level: 1 }).run()
  } else if (str === 'h2') {
    editor.value.chain().focus().toggleHeading({ level: 2 }).run()
  } else if (str === 'h3') {
    editor.value.chain().focus().toggleHeading({ level: 3 }).run()
  }
}

// Color picker
function handleColorChange(e: Event) {
  const color = (e.target as HTMLInputElement).value
  if (editor.value && color) {
    editor.value.chain().focus().setColor(color).run()
  }
}

// Link handling
function openLinkModal() {
  if (!editor.value) return
  const previousUrl = editor.value.getAttributes('link').href as string | undefined
  linkUrl.value = previousUrl || ''
  linkModalVisible.value = true
}

function handleSaveLink() {
  if (!editor.value) return
  if (!linkUrl.value) {
    editor.value.chain().focus().extendMarkRange('link').unsetLink().run()
  } else {
    editor.value.chain().focus().extendMarkRange('link').setLink({ href: linkUrl.value }).run()
  }
  linkModalVisible.value = false
}

function handleUnlink() {
  if (!editor.value) return
  editor.value.chain().focus().unsetLink().run()
}

// Image handling
function openImageModal() {
  imageUrl.value = ''
  imageModalVisible.value = true
}

function handleInsertImage() {
  if (!editor.value || !imageUrl.value) return
  editor.value.chain().focus().setImage({ src: imageUrl.value }).run()
  imageModalVisible.value = false
}

// Table Dropdown menu items
const tableMenuItems = computed(() => [
  { key: 'insertTable', label: t('editor.insertTable') },
  { type: 'divider' as const },
  { key: 'addRowBefore', label: t('editor.addRowBefore') },
  { key: 'addRowAfter', label: t('editor.addRowAfter') },
  { key: 'deleteRow', label: t('editor.deleteRow') },
  { type: 'divider' as const },
  { key: 'addColumnBefore', label: t('editor.addColumnBefore') },
  { key: 'addColumnAfter', label: t('editor.addColumnAfter') },
  { key: 'deleteColumn', label: t('editor.deleteColumn') },
  { type: 'divider' as const },
  { key: 'deleteTable', label: t('editor.deleteTable'), danger: true },
])

function handleTableMenuClick({ key }: { key: string }) {
  if (!editor.value) return
  const chain = editor.value.chain().focus()
  switch (key) {
    case 'insertTable':
      chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
      break
    case 'addRowBefore':
      chain.addRowBefore().run()
      break
    case 'addRowAfter':
      chain.addRowAfter().run()
      break
    case 'deleteRow':
      chain.deleteRow().run()
      break
    case 'addColumnBefore':
      chain.addColumnBefore().run()
      break
    case 'addColumnAfter':
      chain.addColumnAfter().run()
      break
    case 'deleteColumn':
      chain.deleteColumn().run()
      break
    case 'deleteTable':
      chain.deleteTable().run()
      break
  }
}

// Clear content
function handleClearContent() {
  if (!editor.value) return
  editor.value.chain().focus().clearContent().run()
}

// Clear formatting
function handleClearFormatting() {
  if (!editor.value) return
  editor.value.chain().focus().clearNodes().unsetAllMarks().run()
}

onBeforeUnmount(() => {
  editor.value?.destroy()
})
</script>

<template>
  <div class="rich-editor-wrapper" :class="{ 'is-disabled': disabled }">
    <!-- 工具栏 -->
    <div v-if="editor && !disabled" class="rich-editor-toolbar">
      <!-- 撤销 / 重做 -->
      <div class="toolbar-group">
        <Tooltip :title="t('editor.undo')">
          <Button
            type="text"
            size="small"
            class="toolbar-btn"
            :disabled="!editor.can().chain().focus().undo().run()"
            @click="editor.chain().focus().undo().run()"
          >
            <UndoOutlined />
          </Button>
        </Tooltip>
        <Tooltip :title="t('editor.redo')">
          <Button
            type="text"
            size="small"
            class="toolbar-btn"
            :disabled="!editor.can().chain().focus().redo().run()"
            @click="editor.chain().focus().redo().run()"
          >
            <RedoOutlined />
          </Button>
        </Tooltip>
      </div>

      <div class="toolbar-divider" />

      <!-- 段落 / 标题选择 -->
      <div class="toolbar-group">
        <Select
          :value="currentBlockType"
          size="small"
          class="heading-select"
          :options="[
            { value: 'paragraph', label: t('editor.paragraph') },
            { value: 'h1', label: t('editor.heading1') },
            { value: 'h2', label: t('editor.heading2') },
            { value: 'h3', label: t('editor.heading3') },
          ]"
          @change="handleBlockTypeChange"
        />
      </div>

      <div class="toolbar-divider" />

      <!-- 基础文字格式化 -->
      <div class="toolbar-group">
        <Tooltip :title="t('editor.bold')">
          <Button
            type="text"
            size="small"
            class="toolbar-btn"
            :class="{ 'is-active': editor.isActive('bold') }"
            @click="editor.chain().focus().toggleBold().run()"
          >
            <BoldOutlined />
          </Button>
        </Tooltip>

        <Tooltip :title="t('editor.italic')">
          <Button
            type="text"
            size="small"
            class="toolbar-btn"
            :class="{ 'is-active': editor.isActive('italic') }"
            @click="editor.chain().focus().toggleItalic().run()"
          >
            <ItalicOutlined />
          </Button>
        </Tooltip>

        <Tooltip :title="t('editor.underline')">
          <Button
            type="text"
            size="small"
            class="toolbar-btn"
            :class="{ 'is-active': editor.isActive('underline') }"
            @click="editor.chain().focus().toggleUnderline().run()"
          >
            <UnderlineOutlined />
          </Button>
        </Tooltip>

        <Tooltip :title="t('editor.strike')">
          <Button
            type="text"
            size="small"
            class="toolbar-btn"
            :class="{ 'is-active': editor.isActive('strike') }"
            @click="editor.chain().focus().toggleStrike().run()"
          >
            <StrikethroughOutlined />
          </Button>
        </Tooltip>

        <Tooltip :title="t('editor.highlight')">
          <Button
            type="text"
            size="small"
            class="toolbar-btn"
            :class="{ 'is-active': editor.isActive('highlight') }"
            @click="editor.chain().focus().toggleHighlight({ color: '#ffec3d' }).run()"
          >
            <HighlightOutlined />
          </Button>
        </Tooltip>

        <!-- 文字颜色调色板 -->
        <Tooltip :title="t('editor.color')">
          <label class="color-picker-label">
            <FontColorsOutlined />
            <input type="color" class="hidden-color-input" @input="handleColorChange" />
          </label>
        </Tooltip>
      </div>

      <div class="toolbar-divider" />

      <!-- 对齐方式 -->
      <div class="toolbar-group">
        <Tooltip :title="t('editor.alignLeft')">
          <Button
            type="text"
            size="small"
            class="toolbar-btn"
            :class="{ 'is-active': editor.isActive({ textAlign: 'left' }) }"
            @click="editor.chain().focus().setTextAlign('left').run()"
          >
            <AlignLeftOutlined />
          </Button>
        </Tooltip>

        <Tooltip :title="t('editor.alignCenter')">
          <Button
            type="text"
            size="small"
            class="toolbar-btn"
            :class="{ 'is-active': editor.isActive({ textAlign: 'center' }) }"
            @click="editor.chain().focus().setTextAlign('center').run()"
          >
            <AlignCenterOutlined />
          </Button>
        </Tooltip>

        <Tooltip :title="t('editor.alignRight')">
          <Button
            type="text"
            size="small"
            class="toolbar-btn"
            :class="{ 'is-active': editor.isActive({ textAlign: 'right' }) }"
            @click="editor.chain().focus().setTextAlign('right').run()"
          >
            <AlignRightOutlined />
          </Button>
        </Tooltip>
      </div>

      <div class="toolbar-divider" />

      <!-- 列表与引用/代码 -->
      <div class="toolbar-group">
        <Tooltip :title="t('editor.bulletList')">
          <Button
            type="text"
            size="small"
            class="toolbar-btn"
            :class="{ 'is-active': editor.isActive('bulletList') }"
            @click="editor.chain().focus().toggleBulletList().run()"
          >
            <UnorderedListOutlined />
          </Button>
        </Tooltip>

        <Tooltip :title="t('editor.orderedList')">
          <Button
            type="text"
            size="small"
            class="toolbar-btn"
            :class="{ 'is-active': editor.isActive('orderedList') }"
            @click="editor.chain().focus().toggleOrderedList().run()"
          >
            <OrderedListOutlined />
          </Button>
        </Tooltip>

        <Tooltip :title="t('editor.blockquote')">
          <Button
            type="text"
            size="small"
            class="toolbar-btn"
            :class="{ 'is-active': editor.isActive('blockquote') }"
            @click="editor.chain().focus().toggleBlockquote().run()"
          >
            <span class="font-serif font-bold text-sm">”</span>
          </Button>
        </Tooltip>

        <Tooltip :title="t('editor.codeBlock')">
          <Button
            type="text"
            size="small"
            class="toolbar-btn"
            :class="{ 'is-active': editor.isActive('codeBlock') }"
            @click="editor.chain().focus().toggleCodeBlock().run()"
          >
            <CodeOutlined />
          </Button>
        </Tooltip>

        <Tooltip :title="t('editor.horizontalRule')">
          <Button
            type="text"
            size="small"
            class="toolbar-btn"
            @click="editor.chain().focus().setHorizontalRule().run()"
          >
            <LineOutlined />
          </Button>
        </Tooltip>
      </div>

      <div v-if="toolbarMode === 'full'" class="toolbar-divider" />

      <!-- 插入项（链接 / 图片 / 表格） -->
      <div v-if="toolbarMode === 'full'" class="toolbar-group">
        <Tooltip :title="editor.isActive('link') ? t('editor.unlink') : t('editor.link')">
          <Button
            type="text"
            size="small"
            class="toolbar-btn"
            :class="{ 'is-active': editor.isActive('link') }"
            @click="editor.isActive('link') ? handleUnlink() : openLinkModal()"
          >
            <DisconnectOutlined v-if="editor.isActive('link')" />
            <LinkOutlined v-else />
          </Button>
        </Tooltip>

        <Tooltip :title="t('editor.image')">
          <Button type="text" size="small" class="toolbar-btn" @click="openImageModal">
            <PictureOutlined />
          </Button>
        </Tooltip>

        <Dropdown
          :menu="{ items: tableMenuItems }"
          :trigger="['click']"
          @menu-click="handleTableMenuClick"
        >
          <Tooltip :title="t('editor.table')">
            <Button
              type="text"
              size="small"
              class="toolbar-btn"
              :class="{ 'is-active': editor.isActive('table') }"
            >
              <TableOutlined />
            </Button>
          </Tooltip>
        </Dropdown>
      </div>

      <div class="toolbar-divider" />

      <!-- 清除工具 -->
      <div class="toolbar-group">
        <Tooltip :title="t('editor.clearFormatting')">
          <Button type="text" size="small" class="toolbar-btn" @click="handleClearFormatting">
            <ClearOutlined />
          </Button>
        </Tooltip>

        <Tooltip :title="t('editor.clearContent')">
          <Button
            type="text"
            size="small"
            class="toolbar-btn text-rose-500 hover:text-rose-600"
            @click="handleClearContent"
          >
            <DeleteOutlined />
          </Button>
        </Tooltip>
      </div>
    </div>

    <!-- 编辑器内容渲染区 -->
    <div
      class="editor-content-scroll"
      :style="{ minHeight: minHeightStyle, maxHeight: maxHeightStyle }"
    >
      <EditorContent :editor="editor" class="editor-content-container" />
    </div>

    <!-- 插入链接 Modal -->
    <Modal v-model:open="linkModalVisible" :title="t('editor.link')" @ok="handleSaveLink">
      <div class="pt-4">
        <Input
          v-model:value="linkUrl"
          :placeholder="t('editor.linkPlaceholder')"
          allow-clear
          @press-enter="handleSaveLink"
        />
      </div>
    </Modal>

    <!-- 插入图片 Modal -->
    <Modal v-model:open="imageModalVisible" :title="t('editor.image')" @ok="handleInsertImage">
      <div class="pt-4">
        <Input
          v-model:value="imageUrl"
          :placeholder="t('editor.imagePlaceholder')"
          allow-clear
          @press-enter="handleInsertImage"
        />
      </div>
    </Modal>
  </div>
</template>

<style scoped lang="scss">
.rich-editor-wrapper {
  display: flex;
  flex-direction: column;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background-color: #ffffff;
  transition: all 0.2s ease;
  overflow: hidden;

  &:focus-within {
    border-color: var(--app-color-primary, #409eff);
    box-shadow: 0 0 0 2px rgb(64 158 255 / 15%);
  }

  &.is-disabled {
    background-color: #f9fafb;
    border-color: #e5e7eb;
    cursor: not-allowed;
  }
}

/* 工具栏 */
.rich-editor-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  padding: 6px 8px;
  background-color: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
  user-select: none;
}

.toolbar-group {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.toolbar-divider {
  width: 1px;
  height: 16px;
  background-color: #e2e8f0;
  margin: 0 4px;
}

.toolbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 4px;
  color: #4b5563;
  font-size: 14px;
  transition: all 0.15s ease;

  &:hover {
    color: var(--app-color-primary, #409eff);
    background-color: #e2e8f0;
  }

  &.is-active {
    color: var(--app-color-primary, #409eff);
    background-color: #dbeafe;
    font-weight: bold;
  }
}

.heading-select {
  width: 110px;
}

.color-picker-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  color: #4b5563;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;

  &:hover {
    color: var(--app-color-primary, #409eff);
    background-color: #e2e8f0;
  }
}

.hidden-color-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  pointer-events: none;
}

/* 气泡菜单 Bubble Menu */
.editor-bubble-menu {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  background-color: #1e293b;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgb(0 0 0 / 20%);
  z-index: 50;
}

.bubble-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  background: transparent;
  color: #e2e8f0;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    color: #ffffff;
    background-color: #334155;
  }

  &.is-active {
    color: #60a5fa;
    background-color: #0f172a;
  }
}

/* 内容滚动区 */
.editor-content-scroll {
  overflow-y: auto;
  padding: 12px 16px;
}

.editor-content-container {
  height: 100%;
}

/* Tiptap 渲染内容内部排版样式 */
:deep(.tiptap) {
  outline: none;
  min-height: inherit;
  font-size: 14px;
  line-height: 1.6;
  color: #1f2937;

  /* 占位符提示 */
  p.is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    float: left;
    color: #9ca3af;
    pointer-events: none;
    height: 0;
  }

  /* 标题 */
  h1 {
    font-size: 1.8rem;
    font-weight: 700;
    margin: 1rem 0 0.5rem;
    line-height: 1.3;
    color: #111827;
  }

  h2 {
    font-size: 1.4rem;
    font-weight: 600;
    margin: 0.8rem 0 0.4rem;
    line-height: 1.35;
    color: #1f2937;
  }

  h3 {
    font-size: 1.15rem;
    font-weight: 600;
    margin: 0.6rem 0 0.3rem;
    line-height: 1.4;
    color: #374151;
  }

  p {
    margin: 0.4rem 0;
  }

  /* 列表 */
  ul,
  ol {
    padding: 0 1.2rem;
    margin: 0.5rem 0;
  }

  ul {
    list-style-type: disc;
  }

  ol {
    list-style-type: decimal;
  }

  li {
    margin: 0.2rem 0;
  }

  /* 引用块 */
  blockquote {
    border-left: 3px solid var(--app-color-primary, #409eff);
    padding-left: 12px;
    margin: 0.8rem 0;
    color: #4b5563;
    font-style: italic;
    background-color: #f8fafc;
    border-radius: 0 4px 4px 0;
    padding: 8px 12px;
  }

  /* 代码块 */
  pre {
    background: #1e293b;
    color: #f8fafc;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    padding: 10px 14px;
    border-radius: 6px;
    margin: 0.8rem 0;
    overflow-x: auto;

    code {
      color: inherit;
      padding: 0;
      background: none;
      font-size: 13px;
    }
  }

  /* 行内代码 */
  code {
    background-color: #f1f5f9;
    color: #e11d48;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 13px;
  }

  /* 分割线 */
  hr {
    border: none;
    border-top: 1px solid #e2e8f0;
    margin: 1.2rem 0;
  }

  /* 超链接 */
  a {
    color: var(--app-color-primary, #409eff);
    text-decoration: underline;
    cursor: pointer;
  }

  /* 图片 */
  img {
    max-width: 100%;
    height: auto;
    border-radius: 6px;
    margin: 0.6rem 0;
  }

  /* 表格 */
  table {
    border-collapse: collapse;
    margin: 0.8rem 0;
    table-layout: fixed;
    width: 100%;
    overflow: hidden;
    border-radius: 4px;

    td,
    th {
      min-width: 1em;
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      vertical-align: top;
      box-sizing: border-box;
      position: relative;
    }

    th {
      font-weight: 600;
      text-align: left;
      background-color: #f1f5f9;
    }

    .selectedCell:after {
      z-index: 2;
      position: absolute;
      content: '';
      left: 0;
      right: 0;
      top: 0;
      bottom: 0;
      background: rgb(64 158 255 / 15%);
      pointer-events: none;
    }
  }
}
</style>
