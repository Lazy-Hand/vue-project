<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FormInstance, Rule } from 'antdv-next'
import {
  Alert,
  Button,
  Form,
  FormItem,
  Input,
  Modal,
  Radio,
  RadioGroup,
  Select,
  TextArea,
  message,
} from 'antdv-next'

import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CodeOutlined,
  ControlOutlined,
  FormatPainterOutlined,
  InfoCircleOutlined,
  PlayCircleOutlined,
  ScheduleOutlined,
  SettingOutlined,
} from '@antdv-next/icons'

import { createJob, fetchJobHandlerOptions, updateJob } from '@/api/scheduler'
import type {
  CreateJobPayload,
  Job,
  JobHandlerOption,
  JobStatus,
  MisfirePolicy,
  UpdateJobPayload,
} from '@/types/scheduler'
import { ApiRequestError } from '@/utils/request'
import CronModal from './CronModal.vue'
import { formatJsonString, getNextCronRuns } from './utils'

interface Props {
  open: boolean
  job: Job | null
  handlers: JobHandlerOption[]
}

const props = withDefaults(defineProps<Props>(), {
  open: false,
  job: null,
  handlers: () => [],
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  success: []
}>()

const { t } = useI18n()
const formRef = ref<FormInstance>()
const submitting = ref(false)
const cronModalOpen = ref(false)
const internalHandlers = ref<JobHandlerOption[]>([])

const isEdit = computed(() => Boolean(props.job))
const title = computed(() =>
  isEdit.value ? t('scheduler.task.editTitle') : t('scheduler.task.createTitle'),
)

interface FormData {
  jobName: string
  jobGroup: string
  invokeTarget: string
  cronExpression: string
  misfirePolicy: MisfirePolicy
  concurrent: boolean
  status: JobStatus
  args: string
  remark: string
}

const defaultFallbackHandlers: JobHandlerOption[] = [
  {
    name: 'operationLogRetention',
    label: '操作日志保留清理',
    description: '按系统配置或指定参数天数清理历史操作日志',
    defaultArgs: '{"retentionDays": 90}',
  },
  {
    name: 'cleanupExpiredUploads',
    label: '清理过期分片上传',
    description: '清理分片上传中超过指定小时未合并的临时残留文件',
    defaultArgs: '{"maxAgeHours": 24}',
  },
]

const effectiveHandlers = computed<JobHandlerOption[]>(() => {
  if (props.handlers && props.handlers.length > 0) {
    return props.handlers
  }
  if (internalHandlers.value.length > 0) {
    return internalHandlers.value
  }
  return defaultFallbackHandlers
})

const handlerSelectOptions = computed(() =>
  effectiveHandlers.value.map((h) => ({
    label: `${h.label} (${h.name})`,
    value: h.name,
    rawLabel: h.label,
    description: h.description,
  })),
)

const formState = reactive<FormData>({
  jobName: '',
  jobGroup: 'DEFAULT',
  invokeTarget: '',
  cronExpression: '0 0 0 * * *',
  misfirePolicy: 'DEFAULT',
  concurrent: false,
  status: 'ENABLED',
  args: '',
  remark: '',
})

const cronPresets = computed(() => [
  { label: t('scheduler.task.cronEvery5Minutes'), value: '0 */5 * * * *' },
  { label: t('scheduler.task.cronEveryHour'), value: '0 0 * * * *' },
  { label: t('scheduler.task.cronEveryDayMidnight'), value: '0 0 0 * * *' },
  { label: t('scheduler.task.cronEveryDayNoon'), value: '0 0 12 * * *' },
  { label: t('scheduler.task.cronWorkday9am'), value: '0 0 9 * * 1-5' },
  { label: t('scheduler.task.cronEveryMonday'), value: '0 0 0 * * 1' },
  { label: t('scheduler.task.cronEveryMonth1st'), value: '0 0 0 1 * *' },
  { label: t('scheduler.task.cronEveryMinute'), value: '0 * * * * *' },
])

const groupOptions = computed(() => [
  { label: 'DEFAULT (默认)', value: 'DEFAULT' },
  { label: 'SYSTEM (系统)', value: 'SYSTEM' },
  { label: 'BUSINESS (业务)', value: 'BUSINESS' },
  { label: 'DATABASE (数据)', value: 'DATABASE' },
])

const selectedHandler = computed(() =>
  effectiveHandlers.value.find((h) => h.name === formState.invokeTarget),
)

const nextExecutionTimes = computed<string[]>(() => {
  if (!formState.cronExpression || !formState.cronExpression.trim()) return []
  return getNextCronRuns(formState.cronExpression.trim(), 5)
})

const rules = computed<Record<string, Rule[]>>(() => ({
  jobName: [{ required: true, message: t('scheduler.task.nameRequired'), trigger: 'blur' }],
  invokeTarget: [
    { required: true, message: t('scheduler.task.targetRequired'), trigger: 'change' },
  ],
  cronExpression: [{ required: true, message: t('scheduler.task.cronRequired'), trigger: 'blur' }],
  args: [
    {
      validator: (_rule, value: string, callback) => {
        if (!value || !value.trim()) {
          callback()
          return
        }
        try {
          JSON.parse(value)
          callback()
        } catch {
          callback(t('scheduler.task.argsInvalidJson'))
        }
      },
      trigger: 'blur',
    },
  ],
}))

function handleHandlerChange(name: string): void {
  const target = effectiveHandlers.value.find((h) => h.name === name)
  if (target?.defaultArgs && (!formState.args || !formState.args.trim())) {
    formState.args = target.defaultArgs
  }
}

function handleApplyCron(cron: string): void {
  formState.cronExpression = cron
}

function handleFormatJson(): void {
  const result = formatJsonString(formState.args)
  if (result.success && result.formatted !== undefined) {
    formState.args = result.formatted
    if (result.formatted) {
      message.success(t('scheduler.task.formatJsonSuccess'))
    }
  } else {
    message.error(result.error ?? t('scheduler.task.argsInvalidJson'))
  }
}

async function loadInternalHandlers(): Promise<void> {
  if (props.handlers.length === 0 && internalHandlers.value.length === 0) {
    try {
      const res = await fetchJobHandlerOptions()
      if (res && res.length > 0) {
        internalHandlers.value = res
      }
    } catch {
      // fallback to defaultFallbackHandlers
    }
  }
}

function resetForm(): void {
  if (props.job) {
    formState.jobName = props.job.jobName
    formState.jobGroup = props.job.jobGroup
    formState.invokeTarget = props.job.invokeTarget
    formState.cronExpression = props.job.cronExpression
    formState.misfirePolicy = props.job.misfirePolicy
    formState.concurrent = props.job.concurrent
    formState.status = props.job.status
    formState.args = props.job.args ?? ''
    formState.remark = props.job.remark ?? ''
  } else {
    const defaultHandler = effectiveHandlers.value[0]
    formState.jobName = ''
    formState.jobGroup = 'DEFAULT'
    formState.invokeTarget = defaultHandler?.name ?? 'operationLogRetention'
    formState.args = defaultHandler?.defaultArgs ?? '{"retentionDays": 90}'
    formState.cronExpression = '0 0 0 * * *'
    formState.misfirePolicy = 'DEFAULT'
    formState.concurrent = false
    formState.status = 'ENABLED'
    formState.remark = ''
  }
}

watch(
  () => props.open,
  (val) => {
    if (val) {
      void loadInternalHandlers()
      resetForm()
    }
  },
)

async function handleSubmit(): Promise<void> {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  submitting.value = true
  try {
    const payload: CreateJobPayload | UpdateJobPayload = {
      jobName: formState.jobName.trim(),
      jobGroup: formState.jobGroup.trim() || 'DEFAULT',
      invokeTarget: formState.invokeTarget,
      cronExpression: formState.cronExpression.trim(),
      misfirePolicy: formState.misfirePolicy,
      concurrent: formState.concurrent,
      status: formState.status,
      args: formState.args.trim() || undefined,
      remark: formState.remark.trim() || undefined,
    }

    if (isEdit.value && props.job) {
      await updateJob(props.job.id, payload)
      message.success(t('scheduler.task.updateSuccess'))
    } else {
      await createJob(payload as CreateJobPayload)
      message.success(t('scheduler.task.createSuccess'))
    }

    emit('update:open', false)
    emit('success')
  } catch (error) {
    if (error instanceof ApiRequestError) {
      message.error(error.message)
    } else if (error instanceof Error) {
      message.error(error.message)
    } else {
      message.error(t('scheduler.requestFailed'))
    }
  } finally {
    submitting.value = false
  }
}

function handleCancel(): void {
  emit('update:open', false)
}

function getPopupContainer(triggerNode?: HTMLElement): HTMLElement {
  return triggerNode?.parentElement || document.body
}
</script>

<template>
  <Modal
    :open="open"
    :get-container="false"
    width="780px"
    destroy-on-hidden
    :confirm-loading="submitting"
    class="art-task-dialog"
    @ok="handleSubmit"
    @cancel="handleCancel"
  >
    <template #title>
      <div class="art-dialog-header">
        <div class="art-dialog-header__icon">
          <ScheduleOutlined />
        </div>
        <div class="art-dialog-header__meta">
          <h3 class="art-dialog-header__title">{{ title }}</h3>
          <p class="art-dialog-header__desc">
            {{
              isEdit ? '修改定时调度任务属性与执行规则' : '创建新的系统定时任务并自动挂载至调度引擎'
            }}
          </p>
        </div>
      </div>
    </template>

    <Form ref="formRef" :model="formState" :rules="rules" layout="vertical" class="art-task-form">
      <!-- Section 1: 基本信息卡片 -->
      <div class="art-form-card">
        <div class="art-form-card__header">
          <div class="art-form-card__icon bg-blue-50 text-blue-600">
            <InfoCircleOutlined />
          </div>
          <span class="art-form-card__title">{{ t('scheduler.task.basicInfo') }}</span>
        </div>

        <div class="art-form-grid">
          <FormItem :label="t('scheduler.task.jobName')" name="jobName">
            <Input
              v-model:value="formState.jobName"
              :placeholder="t('scheduler.task.jobNamePlaceholder')"
              :maxlength="128"
            >
              <template #prefix>
                <ScheduleOutlined class="text-slate-400" />
              </template>
            </Input>
          </FormItem>

          <FormItem :label="t('scheduler.task.jobGroup')" name="jobGroup">
            <Select
              v-model:value="formState.jobGroup"
              :options="groupOptions"
              :placeholder="t('scheduler.task.jobGroupPlaceholder')"
              :get-popup-container="getPopupContainer"
              allow-clear
            />
          </FormItem>
        </div>

        <FormItem :label="t('scheduler.task.invokeTarget')" name="invokeTarget" class="mb-0">
          <Select
            v-model:value="formState.invokeTarget"
            :options="handlerSelectOptions"
            :placeholder="t('scheduler.task.invokeTargetPlaceholder')"
            :get-popup-container="getPopupContainer"
            @change="handleHandlerChange($event as string)"
          />
          <div v-if="selectedHandler" class="art-handler-badge">
            <InfoCircleOutlined class="art-handler-badge__icon" />
            <span>{{ selectedHandler.description }}</span>
          </div>
        </FormItem>
      </div>

      <!-- Section 2: 调度配置卡片 -->
      <div class="art-form-card">
        <div class="art-form-card__header">
          <div class="art-form-card__icon bg-purple-50 text-purple-600">
            <ClockCircleOutlined />
          </div>
          <span class="art-form-card__title">{{ t('scheduler.task.scheduleConfig') }}</span>
        </div>

        <FormItem name="cronExpression">
          <template #label>
            <div class="art-form-label-row">
              <span>{{ t('scheduler.task.cronExpression') }}</span>
              <Button
                type="primary"
                ghost
                size="small"
                class="art-cron-trigger-btn"
                @click="cronModalOpen = true"
              >
                <SettingOutlined />
                {{ t('scheduler.task.cronConfig') }}
              </Button>
            </div>
          </template>

          <Input
            v-model:value="formState.cronExpression"
            :placeholder="t('scheduler.task.cronExpressionPlaceholder')"
            class="font-mono"
          >
            <template #prefix>
              <CalendarOutlined class="text-slate-400" />
            </template>
          </Input>

          <!-- 快捷预设 Pills -->
          <div class="art-presets-wrap">
            <span class="art-presets-label">{{ t('scheduler.task.cronPresets') }}:</span>
            <div class="art-presets-list">
              <button
                v-for="preset in cronPresets"
                :key="preset.value"
                type="button"
                class="art-preset-pill"
                :class="{ 'art-preset-pill--active': formState.cronExpression === preset.value }"
                @click="handleApplyCron(preset.value)"
              >
                {{ preset.label }}
              </button>
            </div>
          </div>

          <!-- 近 5 次执行时间预估面板 -->
          <div class="art-runs-panel">
            <div class="art-runs-panel__header">
              <ClockCircleOutlined class="text-blue-500" />
              <span>{{ t('scheduler.task.nextRuns') }}</span>
            </div>
            <div v-if="nextExecutionTimes.length > 0" class="art-runs-tags">
              <div v-for="(timeStr, index) in nextExecutionTimes" :key="index" class="art-run-chip">
                <span class="art-run-chip__idx">#{{ index + 1 }}</span>
                <span class="art-run-chip__time">{{ timeStr }}</span>
              </div>
            </div>
            <Alert
              v-else
              type="warning"
              show-icon
              :message="t('scheduler.task.noUpcomingRuns')"
              class="art-runs-alert"
            />
          </div>
        </FormItem>
      </div>

      <!-- Section 3: 执行策略与参数卡片 -->
      <div class="art-form-card">
        <div class="art-form-card__header">
          <div class="art-form-card__icon bg-emerald-50 text-emerald-600">
            <ControlOutlined />
          </div>
          <span class="art-form-card__title">{{ t('scheduler.task.strategyConfig') }}</span>
        </div>

        <div class="art-form-grid">
          <FormItem :label="t('scheduler.task.misfirePolicy')" name="misfirePolicy">
            <RadioGroup v-model:value="formState.misfirePolicy" class="art-radio-group">
              <Radio value="DEFAULT">{{ t('scheduler.task.misfireDefault') }}</Radio>
              <Radio value="IGNORE">{{ t('scheduler.task.misfireIgnore') }}</Radio>
              <Radio value="FIRE_ONCE">{{ t('scheduler.task.misfireFireOnce') }}</Radio>
            </RadioGroup>
          </FormItem>

          <FormItem :label="t('scheduler.task.concurrent')" name="concurrent">
            <RadioGroup v-model:value="formState.concurrent" class="art-radio-group">
              <Radio :value="false">{{ t('scheduler.task.concurrentForbid') }}</Radio>
              <Radio :value="true">{{ t('scheduler.task.concurrentAllow') }}</Radio>
            </RadioGroup>
          </FormItem>
        </div>

        <FormItem :label="t('scheduler.task.status')" name="status">
          <RadioGroup v-model:value="formState.status" class="art-status-radios">
            <Radio value="ENABLED">
              <span class="art-status-pill art-status-pill--enabled">
                <CheckCircleOutlined />
                {{ t('scheduler.task.statusEnabled') }}
              </span>
            </Radio>
            <Radio value="DISABLED">
              <span class="art-status-pill art-status-pill--disabled">
                <PlayCircleOutlined />
                {{ t('scheduler.task.statusDisabled') }}
              </span>
            </Radio>
          </RadioGroup>
        </FormItem>

        <FormItem name="args">
          <template #label>
            <div class="art-form-label-row">
              <div class="flex items-center gap-1.5">
                <CodeOutlined class="text-slate-500" />
                <span>{{ t('scheduler.task.args') }}</span>
              </div>
              <Button type="link" size="small" class="art-format-btn" @click="handleFormatJson">
                <FormatPainterOutlined />
                {{ t('scheduler.task.formatJson') }}
              </Button>
            </div>
          </template>
          <TextArea
            v-model:value="formState.args"
            :placeholder="t('scheduler.task.argsPlaceholder')"
            :rows="3"
            class="art-code-textarea"
          />
        </FormItem>

        <FormItem :label="t('scheduler.task.remark')" name="remark" class="mb-0">
          <TextArea
            v-model:value="formState.remark"
            :placeholder="t('scheduler.task.remarkPlaceholder')"
            :rows="2"
            :maxlength="512"
            show-count
          />
        </FormItem>
      </div>
    </Form>

    <!-- Cron 表达式可视化生成弹窗 -->
    <CronModal v-model:open="cronModalOpen" v-model="formState.cronExpression" />
  </Modal>
</template>

<style scoped lang="scss">
.art-dialog-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 4px;
}

.art-dialog-header__icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: #eff6ff;
  color: #2563eb;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.art-dialog-header__meta {
  display: flex;
  flex-direction: column;
}

.art-dialog-header__title {
  font-size: 16px;
  font-weight: 600;
  color: #0f172a;
  margin: 0;
  line-height: 1.3;
}

.art-dialog-header__desc {
  font-size: 12px;
  color: #64748b;
  margin: 2px 0 0;
}

.art-task-form {
  max-height: 72vh;
  overflow-y: auto;
  padding: 4px 6px 4px 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.art-form-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 14px 16px;
}

.art-form-card__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.art-form-card__icon {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.art-form-card__title {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}

.art-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.art-handler-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.art-handler-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  font-size: 12px;
  color: #475569;
  background: #ffffff;
  border: 1px dashed #cbd5e1;
  padding: 4px 10px;
  border-radius: 6px;
}

.art-handler-badge__icon {
  color: #3b82f6;
}

.art-form-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.art-cron-trigger-btn {
  font-size: 12px;
  height: 24px;
  padding: 0 8px;
  border-radius: 4px;
}

.art-presets-wrap {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 8px;
}

.art-presets-label {
  font-size: 12px;
  color: #64748b;
  line-height: 24px;
  white-space: nowrap;
}

.art-presets-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.art-preset-pill {
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #475569;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 9999px;
  cursor: pointer;
  transition: all 0.15s ease-in-out;

  &:hover {
    border-color: #93c5fd;
    color: #1d4ed8;
    background: #eff6ff;
  }

  &--active {
    border-color: #3b82f6;
    color: #ffffff;
    background: #3b82f6;

    &:hover {
      background: #2563eb;
      color: #ffffff;
    }
  }
}

.art-runs-panel {
  margin-top: 10px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 12px;
}

.art-runs-panel__header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #334155;
  margin-bottom: 8px;
}

.art-runs-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.art-run-chip {
  display: inline-flex;
  align-items: center;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
}

.art-run-chip__idx {
  background: #e2e8f0;
  color: #475569;
  padding: 2px 6px;
  font-weight: 600;
  font-size: 11px;
}

.art-run-chip__time {
  padding: 2px 8px;
  color: #1e293b;
}

.art-runs-alert {
  padding: 4px 8px;
  font-size: 12px;
}

.art-radio-group {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.art-status-radios {
  display: flex;
  gap: 16px;
}

.art-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;

  &--enabled {
    background: #ecfdf5;
    color: #059669;
    border: 1px solid #a7f3d0;
  }

  &--disabled {
    background: #fef2f2;
    color: #dc2626;
    border: 1px solid #fecaca;
  }
}

.art-format-btn {
  padding: 0;
  height: auto;
  font-size: 12px;
}

.art-code-textarea {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  background: #ffffff;
}
</style>
