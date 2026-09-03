<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Button,
  DatePicker,
  Form,
  FormItem,
  Input,
  InputNumber,
  Radio,
  RadioGroup,
  Checkbox,
  CheckboxGroup,
  Select,
  Switch,
  TextArea,
} from 'antdv-next'
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  DeleteOutlined,
  DollarCircleOutlined,
  DownCircleOutlined,
  FieldTimeOutlined,
  FileTextOutlined,
  FontSizeOutlined,
  NumberOutlined,
  PlusOutlined,
  RadiusSettingOutlined,
  TeamOutlined,
  UploadOutlined,
  UserOutlined,
} from '@antdv-next/icons'

import type { FormFieldSchema, FormFieldType, FormSchemaConfig } from '@/types/approval'

interface Props {
  modelValue: FormSchemaConfig
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: FormSchemaConfig]
}>()

const { t } = useI18n()
const selectedFieldId = ref<string | null>(null)

const basicFieldTypes: Array<{ type: FormFieldType; label: string; icon: unknown }> = [
  { type: 'text', label: t('approval.definition.typeText'), icon: FontSizeOutlined },
  { type: 'textarea', label: t('approval.definition.typeTextarea'), icon: FileTextOutlined },
  { type: 'number', label: t('approval.definition.typeNumber'), icon: NumberOutlined },
  { type: 'radio', label: t('approval.definition.typeRadio'), icon: RadiusSettingOutlined },
  { type: 'checkbox', label: t('approval.definition.typeCheckbox'), icon: CheckSquareOutlined },
  { type: 'select', label: t('approval.definition.typeSelect'), icon: DownCircleOutlined },
  { type: 'date', label: t('approval.definition.typeDate'), icon: CalendarOutlined },
  { type: 'daterange', label: t('approval.definition.typeDateRange'), icon: FieldTimeOutlined },
]

const advancedFieldTypes: Array<{ type: FormFieldType; label: string; icon: unknown }> = [
  { type: 'money', label: t('approval.definition.typeMoney'), icon: DollarCircleOutlined },
  { type: 'upload', label: t('approval.definition.typeUpload'), icon: UploadOutlined },
  { type: 'switch', label: t('approval.definition.typeSwitch'), icon: CheckSquareOutlined },
  { type: 'dept', label: t('approval.definition.typeDept'), icon: TeamOutlined },
  { type: 'user', label: t('approval.definition.typeUser'), icon: UserOutlined },
]

const fields = computed(() => props.modelValue.fields || [])

const selectedField = computed<FormFieldSchema | null>(() => {
  if (!selectedFieldId.value) return fields.value[0] ?? null
  return fields.value.find((f) => f.id === selectedFieldId.value) ?? fields.value[0] ?? null
})

function addField(type: FormFieldType): void {
  const count = fields.value.length + 1
  const newId = `field_${Date.now().toString().slice(-4)}_${count}`
  let label = '未命名字段'
  const foundBasic = basicFieldTypes.find((f) => f.type === type)
  const foundAdv = advancedFieldTypes.find((f) => f.type === type)
  if (foundBasic) label = `${foundBasic.label}${count}`
  else if (foundAdv) label = `${foundAdv.label}${count}`

  const newField: FormFieldSchema = {
    id: newId,
    type,
    label,
    placeholder: '',
    required: false,
    defaultValue: undefined,
    options:
      type === 'radio' || type === 'checkbox' || type === 'select'
        ? [
            { label: '选项 1', value: 'opt_1' },
            { label: '选项 2', value: 'opt_2' },
          ]
        : undefined,
  }

  const updated = [...fields.value, newField]
  emit('update:modelValue', { fields: updated })
  selectedFieldId.value = newId
}

function removeField(id: string): void {
  const updated = fields.value.filter((f) => f.id !== id)
  emit('update:modelValue', { fields: updated })
  if (selectedFieldId.value === id) {
    selectedFieldId.value = updated[0]?.id ?? null
  }
}

function moveField(index: number, direction: 'up' | 'down'): void {
  const targetIndex = direction === 'up' ? index - 1 : index + 1
  if (targetIndex < 0 || targetIndex >= fields.value.length) return
  const copy = [...fields.value]
  const item = copy[index]
  if (!item) return
  copy.splice(index, 1)
  copy.splice(targetIndex, 0, item)
  emit('update:modelValue', { fields: copy })
}

function updateSelectedField(patch: Partial<FormFieldSchema>): void {
  if (!selectedField.value) return
  const updated = fields.value.map((f) => {
    if (f.id === selectedField.value?.id) {
      return { ...f, ...patch }
    }
    return f
  })
  emit('update:modelValue', { fields: updated })
}

function addOption(): void {
  if (!selectedField.value) return
  const options = selectedField.value.options ? [...selectedField.value.options] : []
  const idx = options.length + 1
  options.push({ label: `选项 ${idx}`, value: `opt_${idx}` })
  updateSelectedField({ options })
}

function removeOption(idx: number): void {
  if (!selectedField.value?.options) return
  const options = [...selectedField.value.options]
  options.splice(idx, 1)
  updateSelectedField({ options })
}

function updateOption(idx: number, key: 'label' | 'value', val: string): void {
  if (!selectedField.value?.options) return
  const options = [...selectedField.value.options]
  const target = options[idx]
  if (target) {
    options[idx] = { ...target, [key]: val }
    updateSelectedField({ options })
  }
}
</script>

<template>
  <div class="form-designer-tab flex h-[580px] gap-4">
    <!-- 左侧：字段库 -->
    <div
      class="field-library-panel w-60 shrink-0 flex flex-col border rounded-xl p-3 overflow-y-auto"
    >
      <div class="section-subhead text-xs font-semibold uppercase tracking-wider mb-2">
        {{ t('approval.definition.fieldLibBasic') }}
      </div>
      <div class="grid grid-cols-2 gap-2 mb-4">
        <button
          v-for="item in basicFieldTypes"
          :key="item.type"
          type="button"
          class="field-type-btn flex items-center gap-1.5 p-2 rounded-lg border text-xs font-medium transition-all cursor-pointer text-left"
          @click="addField(item.type)"
        >
          <component :is="item.icon" class="text-sm shrink-0" />
          <span class="truncate">{{ item.label }}</span>
        </button>
      </div>

      <div class="section-subhead text-xs font-semibold uppercase tracking-wider mb-2">
        {{ t('approval.definition.fieldLibAdvanced') }}
      </div>
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="item in advancedFieldTypes"
          :key="item.type"
          type="button"
          class="field-type-btn flex items-center gap-1.5 p-2 rounded-lg border text-xs font-medium transition-all cursor-pointer text-left"
          @click="addField(item.type)"
        >
          <component :is="item.icon" class="text-sm shrink-0" />
          <span class="truncate">{{ item.label }}</span>
        </button>
      </div>
    </div>

    <!-- 中间：画布预览区 -->
    <div class="canvas-panel flex-1 flex flex-col border rounded-xl overflow-hidden">
      <div class="canvas-header p-3 border-b flex items-center justify-between">
        <div class="canvas-title text-xs font-semibold">
          {{ t('approval.definition.canvasTitle') }} ({{ fields.length }})
        </div>
        <div class="text-xs text-slate-400">
          {{ t('approval.definition.noFieldsDesc') }}
        </div>
      </div>

      <div class="flex-1 p-4 overflow-y-auto space-y-3">
        <div
          v-if="fields.length === 0"
          class="h-full flex flex-col items-center justify-center text-slate-400 py-16"
        >
          <div
            class="w-12 h-12 rounded-full bg-slate-200 dark:bg-[#22242a] flex items-center justify-center text-slate-400 mb-3 text-xl"
          >
            <PlusOutlined />
          </div>
          <div class="text-sm font-medium text-slate-600 dark:text-slate-300">
            {{ t('approval.definition.noFieldsTitle') }}
          </div>
          <div class="text-xs text-slate-400 mt-1">{{ t('approval.definition.noFieldsDesc') }}</div>
        </div>

        <div
          v-for="(field, idx) in fields"
          :key="field.id"
          :class="[
            'canvas-field-card p-3.5 border rounded-xl shadow-2xs transition-all relative group cursor-pointer',
            selectedField?.id === field.id && 'is-selected',
          ]"
          @click="selectedFieldId = field.id"
        >
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <span class="canvas-field-label text-xs font-semibold">{{ field.label }}</span>
              <span v-if="field.required" class="text-red-500 font-bold text-xs">*</span>
              <span class="text-2xs text-slate-400 font-mono">#{{ field.id }}</span>
            </div>

            <!-- 操作按钮 -->
            <div
              class="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity"
            >
              <button
                type="button"
                :disabled="idx === 0"
                class="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                title="上移"
                @click.stop="moveField(idx, 'up')"
              >
                <ArrowUpOutlined class="text-xs" />
              </button>
              <button
                type="button"
                :disabled="idx === fields.length - 1"
                class="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                title="下移"
                @click.stop="moveField(idx, 'down')"
              >
                <ArrowDownOutlined class="text-xs" />
              </button>
              <button
                type="button"
                class="w-6 h-6 rounded flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 cursor-pointer ml-1"
                title="删除"
                @click.stop="removeField(field.id)"
              >
                <DeleteOutlined class="text-xs" />
              </button>
            </div>
          </div>

          <!-- 模拟控件预览 -->
          <div>
            <template v-if="field.type === 'text'">
              <Input :placeholder="field.placeholder || '请输入'" disabled class="bg-slate-50" />
            </template>
            <template v-else-if="field.type === 'textarea'">
              <TextArea
                :placeholder="field.placeholder || '请输入详细内容'"
                :rows="2"
                disabled
                class="bg-slate-50"
              />
            </template>
            <template v-else-if="field.type === 'number' || field.type === 'money'">
              <InputNumber
                :placeholder="field.placeholder || '0'"
                class="w-full bg-slate-50"
                disabled
              />
            </template>
            <template v-else-if="field.type === 'radio'">
              <RadioGroup disabled>
                <Radio v-for="opt in field.options || []" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </Radio>
              </RadioGroup>
            </template>
            <template v-else-if="field.type === 'checkbox'">
              <CheckboxGroup disabled>
                <Checkbox v-for="opt in field.options || []" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </Checkbox>
              </CheckboxGroup>
            </template>
            <template v-else-if="field.type === 'select'">
              <Select
                :placeholder="field.placeholder || '请选择'"
                class="w-full bg-slate-50"
                disabled
              />
            </template>
            <template v-else-if="field.type === 'date'">
              <DatePicker class="w-full bg-slate-50" disabled />
            </template>
            <template v-else-if="field.type === 'upload'">
              <div
                class="border border-dashed border-slate-300 rounded-lg p-2.5 text-center text-xs text-slate-400 bg-slate-50"
              >
                <UploadOutlined class="mr-1" /> 点击或拖拽上传文件
              </div>
            </template>
            <template v-else-if="field.type === 'switch'">
              <Switch disabled />
            </template>
            <template v-else>
              <Input
                :placeholder="field.placeholder || '请选择/输入'"
                disabled
                class="bg-slate-50"
              />
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧：属性编辑区 -->
    <div class="field-props-panel w-72 shrink-0 border rounded-xl p-4 overflow-y-auto">
      <div class="field-props-title text-xs font-semibold uppercase tracking-wider mb-3">
        {{ t('approval.definition.fieldPropsTitle') }}
      </div>

      <div v-if="selectedField">
        <Form layout="vertical">
          <FormItem :label="t('approval.definition.fieldTitle')" class="mb-3">
            <Input
              :value="selectedField.label"
              @update:value="(val) => updateSelectedField({ label: String(val) })"
            />
          </FormItem>

          <FormItem :label="t('approval.definition.fieldKey')" class="mb-3">
            <Input
              :value="selectedField.id"
              @update:value="(val) => updateSelectedField({ id: String(val) })"
            />
          </FormItem>

          <FormItem :label="t('approval.definition.fieldRequired')" class="mb-3">
            <Switch
              :checked="selectedField.required"
              @update:checked="(val) => updateSelectedField({ required: Boolean(val) })"
            />
          </FormItem>

          <FormItem :label="t('approval.definition.fieldPlaceholder')" class="mb-3">
            <Input
              :value="selectedField.placeholder"
              @update:value="(val) => updateSelectedField({ placeholder: String(val) })"
            />
          </FormItem>

          <!-- 选项管理 (对于单选、多选、下拉) -->
          <div
            v-if="
              selectedField.type === 'radio' ||
              selectedField.type === 'checkbox' ||
              selectedField.type === 'select'
            "
            class="pt-2 border-t border-slate-100 dark:border-[#262830]"
          >
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-medium text-slate-700 dark:text-slate-300">{{
                t('approval.definition.fieldOptions')
              }}</span>
              <Button size="small" type="dashed" class="text-xs" @click="addOption">
                <PlusOutlined />
                {{ t('approval.definition.addOption') }}
              </Button>
            </div>

            <div class="space-y-2">
              <div
                v-for="(opt, oIdx) in selectedField.options || []"
                :key="oIdx"
                class="flex items-center gap-1.5"
              >
                <Input
                  size="small"
                  :value="opt.label"
                  placeholder="标签"
                  class="flex-1 text-xs"
                  @update:value="(val) => updateOption(oIdx, 'label', String(val))"
                />
                <Input
                  size="small"
                  :value="String(opt.value)"
                  placeholder="值"
                  class="w-20 text-xs font-mono"
                  @update:value="(val) => updateOption(oIdx, 'value', String(val))"
                />
                <button
                  type="button"
                  class="text-red-400 hover:text-red-600 p-1 cursor-pointer"
                  @click="removeOption(oIdx)"
                >
                  <DeleteOutlined class="text-xs" />
                </button>
              </div>
            </div>
          </div>
        </Form>
      </div>

      <div v-else class="text-center text-xs text-slate-400 py-12">
        请在画布中选择控件进行属性配置
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.field-library-panel,
.field-props-panel {
  background-color: #ffffff;
  border-color: #e2e8f0;
}

.section-subhead {
  color: #64748b;
}

.field-type-btn {
  background-color: #f8fafc;
  border-color: #f1f5f9;
  color: #334155;

  &:hover {
    background-color: #eff6ff;
    border-color: #bfdbfe;
    color: #2563eb;
  }
}

.canvas-panel {
  background-color: #f8fafc;
  border-color: #e2e8f0;
}

.canvas-header {
  background-color: #ffffff;
  border-color: #e2e8f0;
}

.canvas-title,
.field-props-title {
  color: #0f172a;
}

.canvas-field-card {
  background-color: #ffffff;
  border-color: #e2e8f0;

  &:hover {
    border-color: #cbd5e1;
  }

  &.is-selected {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }
}

.canvas-field-label {
  color: #1e293b;
}

/* ==========================================================================
   暗黑模式 (Dark Mode)
   ========================================================================== */
html.dark {
  .field-library-panel,
  .field-props-panel {
    background-color: #1c1d22;
    border-color: #2a2c33;
  }

  .section-subhead {
    color: #8b909a;
  }

  .field-type-btn {
    background-color: #22242a;
    border-color: #2e3038;
    color: #cbd5e1;

    &:hover {
      background-color: #2a2d36;
      border-color: #3e424e;
      color: #60a5fa;
    }
  }

  .canvas-panel {
    background-color: #16171a;
    border-color: #2a2c33;
  }

  .canvas-header {
    background-color: #1c1d22;
    border-color: #2a2c33;
  }

  .canvas-title,
  .field-props-title {
    color: #ffffff;
  }

  .canvas-field-card {
    background-color: #1c1d22;
    border-color: #2a2c33;

    &:hover {
      border-color: #3e424e;
    }

    &.is-selected {
      border-color: #3b82f6;
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.35);
    }
  }

  .canvas-field-label {
    color: #f1f5f9;
  }
}
</style>
