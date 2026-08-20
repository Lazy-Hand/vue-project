<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Button,
  Form,
  FormItem,
  Input,
  InputNumber,
  Modal,
  Switch,
  TextArea,
  message,
} from 'antdv-next'
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
import { createApprovalCategory, updateApprovalCategory } from '@/api/approval'
import type {
  ApprovalCategory,
  CreateApprovalCategoryPayload,
  UpdateApprovalCategoryPayload,
} from '@/types/approval'
import { ApiRequestError } from '@/utils/request'

interface Props {
  open: boolean
  category?: ApprovalCategory | null
}

const props = withDefaults(defineProps<Props>(), {
  category: null,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  success: []
}>()

const { t } = useI18n()
const submitting = ref(false)

const isEdit = computed(() => Boolean(props.category))

const formState = ref({
  code: '',
  name: '',
  icon: 'UserOutlined',
  color: '#1677ff',
  sort: 0,
  enabled: true,
  remark: '',
})

const iconList = [
  { name: 'UserOutlined', label: '人事', comp: UserOutlined },
  { name: 'DollarCircleOutlined', label: '财务', comp: DollarCircleOutlined },
  { name: 'WalletOutlined', label: '报销', comp: WalletOutlined },
  { name: 'SafetyCertificateOutlined', label: '安全', comp: SafetyCertificateOutlined },
  { name: 'TeamOutlined', label: '团队', comp: TeamOutlined },
  { name: 'ApartmentOutlined', label: '组织', comp: ApartmentOutlined },
  { name: 'FileTextOutlined', label: '文档', comp: FileTextOutlined },
  { name: 'FormOutlined', label: '表单', comp: FormOutlined },
  { name: 'SolutionOutlined', label: '合同', comp: SolutionOutlined },
  { name: 'ProjectOutlined', label: '项目', comp: ProjectOutlined },
  { name: 'ToolOutlined', label: '运维', comp: ToolOutlined },
  { name: 'BankOutlined', label: '资产', comp: BankOutlined },
  { name: 'CalendarOutlined', label: '考勤', comp: CalendarOutlined },
  { name: 'AuditOutlined', label: '审批', comp: AuditOutlined },
  { name: 'CoffeeOutlined', label: '休假', comp: CoffeeOutlined },
  { name: 'ClockCircleOutlined', label: '工单', comp: ClockCircleOutlined },
  { name: 'TrophyOutlined', label: '绩效', comp: TrophyOutlined },
  { name: 'SendOutlined', label: '派发', comp: SendOutlined },
  { name: 'ReconciliationOutlined', label: '对账', comp: ReconciliationOutlined },
  { name: 'FileProtectOutlined', label: '保密', comp: FileProtectOutlined },
  { name: 'SettingOutlined', label: '系统', comp: SettingOutlined },
  { name: 'AppstoreOutlined', label: '应用', comp: AppstoreOutlined },
]

const colorList = [
  { value: '#1677ff', bgClass: 'bg-blue-600' },
  { value: '#52c41a', bgClass: 'bg-emerald-600' },
  { value: '#faad14', bgClass: 'bg-amber-500' },
  { value: '#722ed1', bgClass: 'bg-purple-600' },
  { value: '#eb2f96', bgClass: 'bg-pink-600' },
  { value: '#13c2c2', bgClass: 'bg-teal-600' },
  { value: '#fa541c', bgClass: 'bg-orange-600' },
  { value: '#2f54eb', bgClass: 'bg-indigo-600' },
  { value: '#fa8c16', bgClass: 'bg-amber-600' },
  { value: '#64748b', bgClass: 'bg-slate-600' },
]

const currentIconComp = computed(() => {
  const target = iconList.find((i) => i.name === formState.value.icon)
  return target?.comp ?? UserOutlined
})

function initForm(): void {
  if (props.category) {
    const c = props.category
    formState.value = {
      code: c.code,
      name: c.name,
      icon: c.icon || 'UserOutlined',
      color: c.color || '#1677ff',
      sort: c.sort ?? 0,
      enabled: c.enabled ?? true,
      remark: c.remark || '',
    }
  } else {
    formState.value = {
      code: '',
      name: '',
      icon: 'UserOutlined',
      color: '#1677ff',
      sort: 0,
      enabled: true,
      remark: '',
    }
  }
}

watch(
  () => props.open,
  (val) => {
    if (val) initForm()
  },
)

function handleClose(): void {
  emit('update:open', false)
}

async function handleSubmit(): Promise<void> {
  const code = formState.value.code.trim()
  const name = formState.value.name.trim()

  if (!code) {
    void message.warning(t('approval.category.codeRequired'))
    return
  }
  if (!name) {
    void message.warning(t('approval.category.nameRequired'))
    return
  }

  submitting.value = true
  try {
    if (isEdit.value && props.category) {
      const payload: UpdateApprovalCategoryPayload = {
        name,
        icon: formState.value.icon,
        color: formState.value.color,
        sort: formState.value.sort,
        enabled: formState.value.enabled,
        remark: formState.value.remark.trim() || undefined,
      }
      await updateApprovalCategory(props.category.id, payload)
      void message.success(t('approval.category.updateSuccess'))
    } else {
      const payload: CreateApprovalCategoryPayload = {
        code,
        name,
        icon: formState.value.icon,
        color: formState.value.color,
        sort: formState.value.sort,
        enabled: formState.value.enabled,
        remark: formState.value.remark.trim() || undefined,
      }
      await createApprovalCategory(payload)
      void message.success(t('approval.category.createSuccess'))
    }
    emit('update:open', false)
    emit('success')
  } catch (error) {
    const msg =
      error instanceof ApiRequestError
        ? error.message
        : error instanceof Error
          ? error.message
          : t('approval.requestFailed')
    void message.error(msg)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Modal
    :open="open"
    :title="isEdit ? t('approval.category.editTitle') : t('approval.category.createTitle')"
    :confirm-loading="submitting"
    destroy-on-close
    :width="600"
    @cancel="handleClose"
    @ok="handleSubmit"
  >
    <div class="py-2">
      <!-- 效果预览条 -->
      <div
        class="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg shadow-xs bg-blue-600"
          >
            <component :is="currentIconComp" />
          </div>
          <div>
            <div class="text-sm font-semibold text-slate-800">
              {{ formState.name || '分类名称' }}
            </div>
            <div class="text-xs text-slate-400 font-mono">
              {{ formState.code || 'CATEGORY_CODE' }}
            </div>
          </div>
        </div>
        <div class="text-right">
          <span
            :class="[
              'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
              formState.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500',
            ]"
          >
            {{
              formState.enabled ? t('approval.category.enabled') : t('approval.category.disabled')
            }}
          </span>
        </div>
      </div>

      <Form layout="vertical">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormItem :label="t('approval.category.code')" required>
            <Input
              v-model:value="formState.code"
              :placeholder="t('approval.category.codePlaceholder')"
              :disabled="isEdit"
              :maxlength="64"
            />
          </FormItem>

          <FormItem :label="t('approval.category.name')" required>
            <Input
              v-model:value="formState.name"
              :placeholder="t('approval.category.namePlaceholder')"
              :maxlength="64"
            />
          </FormItem>
        </div>

        <!-- 图标与颜色配置 -->
        <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl mb-4">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="md:col-span-2">
              <div class="text-xs text-slate-500 mb-2">{{ t('approval.category.icon') }}</div>
              <div class="grid grid-cols-6 gap-1.5 max-h-36 overflow-y-auto pr-1">
                <button
                  v-for="item in iconList"
                  :key="item.name"
                  type="button"
                  :title="item.label"
                  :class="[
                    'h-8 rounded-lg flex items-center justify-center border transition-all text-sm cursor-pointer',
                    formState.icon === item.name
                      ? 'border-blue-500 bg-blue-50 text-blue-600 ring-2 ring-blue-200 font-bold'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                  ]"
                  @click="formState.icon = item.name"
                >
                  <component :is="item.comp" />
                </button>
              </div>
            </div>

            <div>
              <div class="text-xs text-slate-500 mb-2">{{ t('approval.category.color') }}</div>
              <div class="grid grid-cols-5 gap-2 items-center">
                <button
                  v-for="c in colorList"
                  :key="c.value"
                  type="button"
                  :class="[
                    'w-7 h-7 rounded-full border-2 transition-transform cursor-pointer',
                    c.bgClass,
                    formState.color === c.value
                      ? 'border-white scale-110 shadow-sm ring-2 ring-blue-500'
                      : 'border-transparent hover:scale-105 opacity-80 hover:opacity-100',
                  ]"
                  @click="formState.color = c.value"
                />
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormItem :label="t('approval.category.sort')">
            <InputNumber
              v-model:value="formState.sort"
              :min="0"
              :max="9999"
              :placeholder="t('approval.category.sortPlaceholder')"
              class="w-full"
            />
          </FormItem>

          <FormItem :label="t('approval.category.status')">
            <div class="flex items-center gap-3 pt-1">
              <Switch v-model:checked="formState.enabled" />
              <span class="text-sm text-slate-600">
                {{
                  formState.enabled
                    ? t('approval.category.enabled')
                    : t('approval.category.disabled')
                }}
              </span>
            </div>
          </FormItem>
        </div>

        <FormItem :label="t('approval.category.remark')">
          <TextArea
            v-model:value="formState.remark"
            :placeholder="t('approval.category.remarkPlaceholder')"
            :rows="2"
            :maxlength="255"
            show-count
          />
        </FormItem>
      </Form>
    </div>
  </Modal>
</template>
