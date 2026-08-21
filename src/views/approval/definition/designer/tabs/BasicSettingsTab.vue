<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Form, FormItem, Input, Select, Switch, TextArea } from 'antdv-next'
import {
  ApartmentOutlined,
  AppstoreOutlined,
  AuditOutlined,
  BankOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  CoffeeOutlined,
  DollarCircleOutlined,
  FileProtectOutlined,
  FileTextOutlined,
  FormOutlined,
  ProjectOutlined,
  ReconciliationOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  SettingOutlined,
  SolutionOutlined,
  TeamOutlined,
  ToolOutlined,
  TrophyOutlined,
  UserOutlined,
  WalletOutlined,
} from '@antdv-next/icons'
import { fetchApprovalCategoryList } from '@/api/approval'

export interface BasicFormState {
  code: string
  name: string
  category: string
  icon: string
  color: string
  remark: string
  enabled: boolean
}

interface Props {
  modelValue: BasicFormState
  isEdit?: boolean
  categories?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  isEdit: false,
  categories: () => [],
})

const emit = defineEmits<{
  'update:modelValue': [value: BasicFormState]
}>()

const { t } = useI18n()

const iconList = [
  { name: 'FileTextOutlined', label: '文档', comp: FileTextOutlined },
  { name: 'FormOutlined', label: '表单', comp: FormOutlined },
  { name: 'DollarCircleOutlined', label: '财务', comp: DollarCircleOutlined },
  { name: 'WalletOutlined', label: '报销', comp: WalletOutlined },
  { name: 'SafetyCertificateOutlined', label: '安全', comp: SafetyCertificateOutlined },
  { name: 'TeamOutlined', label: '团队', comp: TeamOutlined },
  { name: 'ApartmentOutlined', label: '组织', comp: ApartmentOutlined },
  { name: 'UserOutlined', label: '人事', comp: UserOutlined },
  { name: 'CalendarOutlined', label: '考勤', comp: CalendarOutlined },
  { name: 'AuditOutlined', label: '审批', comp: AuditOutlined },
  { name: 'SolutionOutlined', label: '合同', comp: SolutionOutlined },
  { name: 'CoffeeOutlined', label: '休假', comp: CoffeeOutlined },
  { name: 'TrophyOutlined', label: '绩效', comp: TrophyOutlined },
  { name: 'ToolOutlined', label: '运维', comp: ToolOutlined },
  { name: 'BankOutlined', label: '资产', comp: BankOutlined },
  { name: 'ProjectOutlined', label: '项目', comp: ProjectOutlined },
  { name: 'ReconciliationOutlined', label: '对账', comp: ReconciliationOutlined },
  { name: 'SendOutlined', label: '派发', comp: SendOutlined },
  { name: 'ClockCircleOutlined', label: '工单', comp: ClockCircleOutlined },
  { name: 'FileProtectOutlined', label: '保密', comp: FileProtectOutlined },
  { name: 'SettingOutlined', label: '系统', comp: SettingOutlined },
  { name: 'AppstoreOutlined', label: '应用', comp: AppstoreOutlined },
]

const colorList = [
  '#1677ff',
  '#52c41a',
  '#faad14',
  '#722ed1',
  '#eb2f96',
  '#13c2c2',
  '#fa541c',
  '#2f54eb',
  '#fa8c16',
  '#64748b',
]

const loadedCategories = ref<string[]>([])

async function loadDynamicCategories(): Promise<void> {
  try {
    const res = await fetchApprovalCategoryList({ pageSize: 100, enabled: true })
    loadedCategories.value = res.items.map((i) => i.name)
  } catch {
    loadedCategories.value = []
  }
}

onMounted(() => {
  void loadDynamicCategories()
})

const defaultCategoryOptions = [
  { label: '人事管理', value: '人事管理' },
  { label: '财务报销', value: '财务报销' },
  { label: '行政审批', value: '行政审批' },
  { label: '业务协同', value: '业务协同' },
  { label: 'IT与运维', value: 'IT与运维' },
]

const categoryOptions = computed(() => {
  const merged = new Set(defaultCategoryOptions.map((o) => o.value))
  for (const c of props.categories) {
    if (c && c !== 'default') merged.add(c)
  }
  for (const c of loadedCategories.value) {
    if (c && c !== 'default') merged.add(c)
  }
  return Array.from(merged).map((c) => ({ label: c, value: c }))
})

const currentIconComp = computed(() => {
  const target = iconList.find((i) => i.name === props.modelValue.icon)
  return target?.comp ?? FileTextOutlined
})

function selectIcon(iconName: string): void {
  emit('update:modelValue', { ...props.modelValue, icon: iconName })
}

function selectColor(color: string): void {
  emit('update:modelValue', { ...props.modelValue, color })
}
</script>

<template>
  <div class="basic-settings-tab max-w-3xl mx-auto py-4">
    <Form layout="vertical">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormItem :label="t('approval.definition.name')" required>
          <Input
            :value="modelValue.name"
            :placeholder="t('approval.definition.namePlaceholder')"
            :maxlength="64"
            @update:value="(val) => emit('update:modelValue', { ...modelValue, name: String(val) })"
          />
        </FormItem>

        <FormItem :label="t('approval.definition.code')" required>
          <Input
            :value="modelValue.code"
            :placeholder="t('approval.definition.codePlaceholder')"
            :disabled="isEdit"
            :maxlength="64"
            @update:value="(val) => emit('update:modelValue', { ...modelValue, code: String(val) })"
          />
        </FormItem>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormItem :label="t('approval.definition.categoryLabel')">
          <Select
            :value="modelValue.category || undefined"
            :placeholder="t('approval.definition.categoryLabelPlaceholder')"
            :options="categoryOptions"
            allow-clear
            @update:value="
              (val) => emit('update:modelValue', { ...modelValue, category: String(val ?? '') })
            "
          />
        </FormItem>

        <FormItem :label="t('approval.definition.enabledLabel')">
          <div class="flex items-center gap-3 pt-1">
            <Switch
              :checked="modelValue.enabled"
              @update:checked="
                (val) => emit('update:modelValue', { ...modelValue, enabled: Boolean(val) })
              "
            />
            <span class="text-sm text-slate-600">
              {{
                modelValue.enabled
                  ? t('approval.definition.enabled')
                  : t('approval.definition.disabled')
              }}
            </span>
          </div>
        </FormItem>
      </div>

      <!-- 图标与主题色配置 -->
      <div class="p-4 bg-slate-50 border border-slate-200 rounded-xl mb-4">
        <div class="flex items-center justify-between mb-3">
          <div class="text-sm font-semibold text-slate-800">
            {{ t('approval.definition.icon') }} 与 {{ t('approval.definition.color') }}
          </div>
          <!-- 实时效果预览 -->
          <div
            class="flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-lg shadow-2xs"
          >
            <span class="text-xs text-slate-400">实时预览:</span>
            <div
              class="w-7 h-7 rounded-lg flex items-center justify-center text-white text-sm shadow-2xs"
              :style="{ backgroundColor: modelValue.color || '#1677ff' }"
            >
              <component :is="currentIconComp" />
            </div>
            <span class="text-xs font-semibold text-slate-700">{{
              modelValue.name || '流程名称'
            }}</span>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <!-- 图标选择器 -->
          <div class="md:col-span-2">
            <div class="text-xs text-slate-500 mb-2">选择图标 (点击切换)</div>
            <div class="grid grid-cols-6 sm:grid-cols-8 gap-2">
              <button
                v-for="item in iconList"
                :key="item.name"
                type="button"
                :title="item.label"
                :class="[
                  'h-9 rounded-lg flex items-center justify-center border transition-all text-base cursor-pointer',
                  modelValue.icon === item.name
                    ? 'border-blue-500 bg-blue-50 text-blue-600 shadow-xs ring-2 ring-blue-200 font-bold'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                ]"
                @click="selectIcon(item.name)"
              >
                <component :is="item.comp" />
              </button>
            </div>
          </div>

          <!-- 主题色选择器 -->
          <div>
            <div class="text-xs text-slate-500 mb-2">{{ t('approval.definition.color') }}</div>
            <div class="grid grid-cols-5 gap-2.5 items-center">
              <button
                v-for="color in colorList"
                :key="color"
                type="button"
                :class="[
                  'w-8 h-8 rounded-full border-2 transition-transform cursor-pointer',
                  modelValue.color === color
                    ? 'border-white scale-110 shadow-sm ring-2 ring-blue-500'
                    : 'border-transparent hover:scale-105 opacity-80 hover:opacity-100',
                ]"
                :style="{ backgroundColor: color }"
                :title="color"
                @click="selectColor(color)"
              />
            </div>
          </div>
        </div>
      </div>

      <FormItem :label="t('approval.definition.remark')">
        <TextArea
          :value="modelValue.remark"
          :placeholder="t('approval.definition.remarkPlaceholder')"
          :rows="3"
          :maxlength="255"
          show-count
          @update:value="(val) => emit('update:modelValue', { ...modelValue, remark: String(val) })"
        />
      </FormItem>
    </Form>
  </div>
</template>
