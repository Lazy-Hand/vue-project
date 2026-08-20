<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Alert,
  Button,
  Input,
  InputNumber,
  Modal,
  Radio,
  RadioGroup,
  TabPane,
  Tabs,
  message,
} from 'antdv-next'
import {
  CalendarOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  CopyOutlined,
  FieldTimeOutlined,
} from '@antdv-next/icons'

import { getNextCronRuns } from './utils'

interface Props {
  open: boolean
  modelValue?: string
}

const props = withDefaults(defineProps<Props>(), {
  open: false,
  modelValue: '0 0 0 * * *',
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  'update:modelValue': [value: string]
  ok: [value: string]
}>()

const { t } = useI18n()

type FieldType = 'second' | 'minute' | 'hour' | 'day' | 'month' | 'week'
const activeTab = ref<FieldType>('second')

interface FieldState {
  type: 'every' | 'period' | 'loop' | 'specify' | 'unspecified' | 'lastDay'
  period: { start: number; end: number }
  loop: { start: number; step: number }
  specify: number[]
}

const secondState = reactive<FieldState>({
  type: 'every',
  period: { start: 1, end: 2 },
  loop: { start: 0, step: 1 },
  specify: [],
})

const minuteState = reactive<FieldState>({
  type: 'every',
  period: { start: 1, end: 2 },
  loop: { start: 0, step: 1 },
  specify: [],
})

const hourState = reactive<FieldState>({
  type: 'every',
  period: { start: 0, end: 23 },
  loop: { start: 0, step: 1 },
  specify: [],
})

const dayState = reactive<FieldState>({
  type: 'every',
  period: { start: 1, end: 31 },
  loop: { start: 1, step: 1 },
  specify: [],
})

const monthState = reactive<FieldState>({
  type: 'every',
  period: { start: 1, end: 12 },
  loop: { start: 1, step: 1 },
  specify: [],
})

const weekState = reactive<FieldState>({
  type: 'unspecified',
  period: { start: 1, end: 7 },
  loop: { start: 1, step: 1 },
  specify: [],
})

const numbers60 = Array.from({ length: 60 }, (_, i) => i)
const numbers24 = Array.from({ length: 24 }, (_, i) => i)
const numbers31 = Array.from({ length: 31 }, (_, i) => i + 1)
const numbers12 = Array.from({ length: 12 }, (_, i) => i + 1)

const weekOptions = computed(() => [
  { label: '周一 (1)', value: 1 },
  { label: '周二 (2)', value: 2 },
  { label: '周三 (3)', value: 3 },
  { label: '周四 (4)', value: 4 },
  { label: '周五 (5)', value: 5 },
  { label: '周六 (6)', value: 6 },
  { label: '周日 (7)', value: 7 },
])

function generateFieldToken(state: FieldState, defaultVal = '*'): string {
  switch (state.type) {
    case 'every':
      return '*'
    case 'unspecified':
      return '?'
    case 'lastDay':
      return 'L'
    case 'period':
      return `${state.period.start}-${state.period.end}`
    case 'loop':
      return `${state.loop.start}/${state.loop.step}`
    case 'specify':
      return state.specify.length > 0 ? state.specify.sort((a, b) => a - b).join(',') : defaultVal
    default:
      return defaultVal
  }
}

const secondToken = computed(() => generateFieldToken(secondState, '0'))
const minuteToken = computed(() => generateFieldToken(minuteState, '0'))
const hourToken = computed(() => generateFieldToken(hourState, '*'))
const dayToken = computed(() => generateFieldToken(dayState, '*'))
const monthToken = computed(() => generateFieldToken(monthState, '*'))
const weekToken = computed(() => generateFieldToken(weekState, '?'))

const fullCron = computed(() => {
  return `${secondToken.value} ${minuteToken.value} ${hourToken.value} ${dayToken.value} ${monthToken.value} ${weekToken.value}`
})

const nextRuns = computed(() => {
  return getNextCronRuns(fullCron.value, 5)
})

function toggleSpecifyItem(state: FieldState, val: number): void {
  state.type = 'specify'
  const idx = state.specify.indexOf(val)
  if (idx > -1) {
    state.specify.splice(idx, 1)
  } else {
    state.specify.push(val)
  }
}

function parseFieldToken(token: string, state: FieldState, min: number, max: number): void {
  const clean = token.trim()
  if (clean === '*' || !clean) {
    state.type = 'every'
    return
  }
  if (clean === '?') {
    state.type = 'unspecified'
    return
  }
  if (clean === 'L') {
    state.type = 'lastDay'
    return
  }
  if (clean.includes('/')) {
    const [startStr, stepStr] = clean.split('/')
    state.type = 'loop'
    state.loop.start = Number.parseInt(startStr || '0', 10)
    state.loop.step = Number.parseInt(stepStr || '1', 10)
    return
  }
  if (clean.includes('-')) {
    const [startStr, endStr] = clean.split('-')
    state.type = 'period'
    state.period.start = Number.parseInt(startStr || `${min}`, 10)
    state.period.end = Number.parseInt(endStr || `${max}`, 10)
    return
  }

  const nums = clean
    .split(',')
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => !Number.isNaN(n))

  if (nums.length > 0) {
    state.type = 'specify'
    state.specify = nums
  } else {
    state.type = 'every'
  }
}

function parseInitialCron(cron: string): void {
  const parts = cron.trim().split(/\s+/)
  if (parts.length === 6) {
    parseFieldToken(parts[0] ?? '0', secondState, 0, 59)
    parseFieldToken(parts[1] ?? '0', minuteState, 0, 59)
    parseFieldToken(parts[2] ?? '*', hourState, 0, 23)
    parseFieldToken(parts[3] ?? '*', dayState, 1, 31)
    parseFieldToken(parts[4] ?? '*', monthState, 1, 12)
    parseFieldToken(parts[5] ?? '?', weekState, 1, 7)
  } else if (parts.length === 5) {
    secondState.type = 'specify'
    secondState.specify = [0]
    parseFieldToken(parts[0] ?? '0', minuteState, 0, 59)
    parseFieldToken(parts[1] ?? '*', hourState, 0, 23)
    parseFieldToken(parts[2] ?? '*', dayState, 1, 31)
    parseFieldToken(parts[3] ?? '*', monthState, 1, 12)
    parseFieldToken(parts[4] ?? '?', weekState, 1, 7)
  }
}

watch(
  () => props.open,
  (val) => {
    if (val) {
      parseInitialCron(props.modelValue || '0 0 0 * * *')
    }
  },
  { immediate: true },
)

// 当日选择指定/周期/循环时，周自动切换为不指定
watch(
  () => dayState.type,
  (newType) => {
    if (newType !== 'unspecified' && weekState.type !== 'unspecified') {
      weekState.type = 'unspecified'
    }
  },
)

// 当周选择指定/周期/循环时，日自动切换为不指定
watch(
  () => weekState.type,
  (newType) => {
    if (newType !== 'unspecified' && dayState.type !== 'unspecified') {
      dayState.type = 'unspecified'
    }
  },
)

function handleCopy(): void {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(fullCron.value)
    message.success(t('common.copySuccess'))
  }
}

function handleApply(): void {
  emit('update:modelValue', fullCron.value)
  emit('ok', fullCron.value)
  emit('update:open', false)
}

function handleCancel(): void {
  emit('update:open', false)
}
</script>

<template>
  <Modal
    :open="open"
    :get-container="false"
    width="840px"
    destroy-on-hidden
    class="art-cron-modal"
    @ok="handleApply"
    @cancel="handleCancel"
  >
    <template #title>
      <div class="art-dialog-header">
        <div class="art-dialog-header__icon bg-purple-50 text-purple-600">
          <FieldTimeOutlined />
        </div>
        <div class="art-dialog-header__meta">
          <h3 class="art-dialog-header__title">{{ t('scheduler.task.cronGenerator') }}</h3>
          <p class="art-dialog-header__desc">
            可视化配置秒、分、时、日、月、周的时间调度规则并实时解析
          </p>
        </div>
      </div>
    </template>

    <div class="art-cron-body">
      <!-- 维度卡片 Tabs -->
      <Tabs v-model:activeKey="activeTab" type="card" class="art-cron-tabs">
        <!-- 秒 -->
        <TabPane key="second">
          <template #tab>
            <span class="art-tab-title">
              <ClockCircleOutlined />
              {{ t('scheduler.task.cronSecond') }}
            </span>
          </template>
          <RadioGroup v-model:value="secondState.type" class="art-cron-options">
            <Radio value="every" class="art-cron-opt-item">
              <span class="font-medium text-slate-800">{{
                t('scheduler.task.cronEverySecond')
              }}</span>
            </Radio>
            <Radio value="period" class="art-cron-opt-item">
              <div class="art-cron-opt-inline">
                <span
                  >{{ t('scheduler.task.cronPeriod') }}
                  {{ t('scheduler.task.cronPeriodFrom') }}</span
                >
                <InputNumber
                  v-model:value="secondState.period.start"
                  :min="0"
                  :max="58"
                  size="small"
                  class="art-cron-num"
                />
                <span>{{ t('scheduler.task.cronPeriodTo') }}</span>
                <InputNumber
                  v-model:value="secondState.period.end"
                  :min="1"
                  :max="59"
                  size="small"
                  class="art-cron-num"
                />
                <span>{{ t('scheduler.task.cronSecond') }}</span>
              </div>
            </Radio>
            <Radio value="loop" class="art-cron-opt-item">
              <div class="art-cron-opt-inline">
                <span
                  >{{ t('scheduler.task.cronLoop') }} {{ t('scheduler.task.cronLoopStart') }}</span
                >
                <InputNumber
                  v-model:value="secondState.loop.start"
                  :min="0"
                  :max="59"
                  size="small"
                  class="art-cron-num"
                />
                <span>{{ t('scheduler.task.cronLoopStep') }}</span>
                <InputNumber
                  v-model:value="secondState.loop.step"
                  :min="1"
                  :max="59"
                  size="small"
                  class="art-cron-num"
                />
                <span>{{ t('scheduler.task.cronLoopUnitSecond') }}</span>
              </div>
            </Radio>
            <Radio value="specify" class="art-cron-opt-item">
              <div class="w-full">
                <span class="font-medium text-slate-800">{{
                  t('scheduler.task.cronSpecify')
                }}</span>
                <div class="art-chip-grid mt-2">
                  <button
                    v-for="num in numbers60"
                    :key="num"
                    type="button"
                    class="art-num-chip"
                    :class="{ 'art-num-chip--active': secondState.specify.includes(num) }"
                    @click.stop="toggleSpecifyItem(secondState, num)"
                  >
                    {{ num < 10 ? `0${num}` : num }}
                  </button>
                </div>
              </div>
            </Radio>
          </RadioGroup>
        </TabPane>

        <!-- 分 -->
        <TabPane key="minute">
          <template #tab>
            <span class="art-tab-title">
              <ClockCircleOutlined />
              {{ t('scheduler.task.cronMinute') }}
            </span>
          </template>
          <RadioGroup v-model:value="minuteState.type" class="art-cron-options">
            <Radio value="every" class="art-cron-opt-item">
              <span class="font-medium text-slate-800">{{
                t('scheduler.task.cronEveryMinuteChoice')
              }}</span>
            </Radio>
            <Radio value="period" class="art-cron-opt-item">
              <div class="art-cron-opt-inline">
                <span
                  >{{ t('scheduler.task.cronPeriod') }}
                  {{ t('scheduler.task.cronPeriodFrom') }}</span
                >
                <InputNumber
                  v-model:value="minuteState.period.start"
                  :min="0"
                  :max="58"
                  size="small"
                  class="art-cron-num"
                />
                <span>{{ t('scheduler.task.cronPeriodTo') }}</span>
                <InputNumber
                  v-model:value="minuteState.period.end"
                  :min="1"
                  :max="59"
                  size="small"
                  class="art-cron-num"
                />
                <span>{{ t('scheduler.task.cronMinute') }}</span>
              </div>
            </Radio>
            <Radio value="loop" class="art-cron-opt-item">
              <div class="art-cron-opt-inline">
                <span
                  >{{ t('scheduler.task.cronLoop') }} {{ t('scheduler.task.cronLoopStart') }}</span
                >
                <InputNumber
                  v-model:value="minuteState.loop.start"
                  :min="0"
                  :max="59"
                  size="small"
                  class="art-cron-num"
                />
                <span>{{ t('scheduler.task.cronLoopStep') }}</span>
                <InputNumber
                  v-model:value="minuteState.loop.step"
                  :min="1"
                  :max="59"
                  size="small"
                  class="art-cron-num"
                />
                <span>{{ t('scheduler.task.cronLoopUnitMinute') }}</span>
              </div>
            </Radio>
            <Radio value="specify" class="art-cron-opt-item">
              <div class="w-full">
                <span class="font-medium text-slate-800">{{
                  t('scheduler.task.cronSpecify')
                }}</span>
                <div class="art-chip-grid mt-2">
                  <button
                    v-for="num in numbers60"
                    :key="num"
                    type="button"
                    class="art-num-chip"
                    :class="{ 'art-num-chip--active': minuteState.specify.includes(num) }"
                    @click.stop="toggleSpecifyItem(minuteState, num)"
                  >
                    {{ num < 10 ? `0${num}` : num }}
                  </button>
                </div>
              </div>
            </Radio>
          </RadioGroup>
        </TabPane>

        <!-- 时 -->
        <TabPane key="hour">
          <template #tab>
            <span class="art-tab-title">
              <ClockCircleOutlined />
              {{ t('scheduler.task.cronHour') }}
            </span>
          </template>
          <RadioGroup v-model:value="hourState.type" class="art-cron-options">
            <Radio value="every" class="art-cron-opt-item">
              <span class="font-medium text-slate-800">{{
                t('scheduler.task.cronEveryHourChoice')
              }}</span>
            </Radio>
            <Radio value="period" class="art-cron-opt-item">
              <div class="art-cron-opt-inline">
                <span
                  >{{ t('scheduler.task.cronPeriod') }}
                  {{ t('scheduler.task.cronPeriodFrom') }}</span
                >
                <InputNumber
                  v-model:value="hourState.period.start"
                  :min="0"
                  :max="22"
                  size="small"
                  class="art-cron-num"
                />
                <span>{{ t('scheduler.task.cronPeriodTo') }}</span>
                <InputNumber
                  v-model:value="hourState.period.end"
                  :min="1"
                  :max="23"
                  size="small"
                  class="art-cron-num"
                />
                <span>{{ t('scheduler.task.cronHour') }}</span>
              </div>
            </Radio>
            <Radio value="loop" class="art-cron-opt-item">
              <div class="art-cron-opt-inline">
                <span
                  >{{ t('scheduler.task.cronLoop') }} {{ t('scheduler.task.cronLoopStart') }}</span
                >
                <InputNumber
                  v-model:value="hourState.loop.start"
                  :min="0"
                  :max="23"
                  size="small"
                  class="art-cron-num"
                />
                <span>{{ t('scheduler.task.cronLoopStep') }}</span>
                <InputNumber
                  v-model:value="hourState.loop.step"
                  :min="1"
                  :max="23"
                  size="small"
                  class="art-cron-num"
                />
                <span>{{ t('scheduler.task.cronLoopUnitHour') }}</span>
              </div>
            </Radio>
            <Radio value="specify" class="art-cron-opt-item">
              <div class="w-full">
                <span class="font-medium text-slate-800">{{
                  t('scheduler.task.cronSpecify')
                }}</span>
                <div class="art-chip-grid mt-2">
                  <button
                    v-for="num in numbers24"
                    :key="num"
                    type="button"
                    class="art-num-chip"
                    :class="{ 'art-num-chip--active': hourState.specify.includes(num) }"
                    @click.stop="toggleSpecifyItem(hourState, num)"
                  >
                    {{ num < 10 ? `0${num}` : num }}
                  </button>
                </div>
              </div>
            </Radio>
          </RadioGroup>
        </TabPane>

        <!-- 日 -->
        <TabPane key="day">
          <template #tab>
            <span class="art-tab-title">
              <CalendarOutlined />
              {{ t('scheduler.task.cronDay') }}
            </span>
          </template>
          <RadioGroup v-model:value="dayState.type" class="art-cron-options">
            <Radio value="every" class="art-cron-opt-item">
              <span class="font-medium text-slate-800">{{
                t('scheduler.task.cronEveryDayChoice')
              }}</span>
            </Radio>
            <Radio value="unspecified" class="art-cron-opt-item">
              <span class="font-medium text-slate-800">{{
                t('scheduler.task.cronUnspecified')
              }}</span>
            </Radio>
            <Radio value="lastDay" class="art-cron-opt-item">
              <span class="font-medium text-slate-800">{{ t('scheduler.task.cronLastDay') }}</span>
            </Radio>
            <Radio value="period" class="art-cron-opt-item">
              <div class="art-cron-opt-inline">
                <span
                  >{{ t('scheduler.task.cronPeriod') }}
                  {{ t('scheduler.task.cronPeriodFrom') }}</span
                >
                <InputNumber
                  v-model:value="dayState.period.start"
                  :min="1"
                  :max="30"
                  size="small"
                  class="art-cron-num"
                />
                <span>{{ t('scheduler.task.cronPeriodTo') }}</span>
                <InputNumber
                  v-model:value="dayState.period.end"
                  :min="2"
                  :max="31"
                  size="small"
                  class="art-cron-num"
                />
                <span>{{ t('scheduler.task.cronDay') }}</span>
              </div>
            </Radio>
            <Radio value="loop" class="art-cron-opt-item">
              <div class="art-cron-opt-inline">
                <span
                  >{{ t('scheduler.task.cronLoop') }} {{ t('scheduler.task.cronLoopStart') }}</span
                >
                <InputNumber
                  v-model:value="dayState.loop.start"
                  :min="1"
                  :max="31"
                  size="small"
                  class="art-cron-num"
                />
                <span>{{ t('scheduler.task.cronLoopStep') }}</span>
                <InputNumber
                  v-model:value="dayState.loop.step"
                  :min="1"
                  :max="31"
                  size="small"
                  class="art-cron-num"
                />
                <span>{{ t('scheduler.task.cronLoopUnitDay') }}</span>
              </div>
            </Radio>
            <Radio value="specify" class="art-cron-opt-item">
              <div class="w-full">
                <span class="font-medium text-slate-800">{{
                  t('scheduler.task.cronSpecify')
                }}</span>
                <div class="art-chip-grid mt-2">
                  <button
                    v-for="num in numbers31"
                    :key="num"
                    type="button"
                    class="art-num-chip"
                    :class="{ 'art-num-chip--active': dayState.specify.includes(num) }"
                    @click.stop="toggleSpecifyItem(dayState, num)"
                  >
                    {{ num < 10 ? `0${num}` : num }}
                  </button>
                </div>
              </div>
            </Radio>
          </RadioGroup>
        </TabPane>

        <!-- 月 -->
        <TabPane key="month">
          <template #tab>
            <span class="art-tab-title">
              <CalendarOutlined />
              {{ t('scheduler.task.cronMonth') }}
            </span>
          </template>
          <RadioGroup v-model:value="monthState.type" class="art-cron-options">
            <Radio value="every" class="art-cron-opt-item">
              <span class="font-medium text-slate-800">{{
                t('scheduler.task.cronEveryMonthChoice')
              }}</span>
            </Radio>
            <Radio value="period" class="art-cron-opt-item">
              <div class="art-cron-opt-inline">
                <span
                  >{{ t('scheduler.task.cronPeriod') }}
                  {{ t('scheduler.task.cronPeriodFrom') }}</span
                >
                <InputNumber
                  v-model:value="monthState.period.start"
                  :min="1"
                  :max="11"
                  size="small"
                  class="art-cron-num"
                />
                <span>{{ t('scheduler.task.cronPeriodTo') }}</span>
                <InputNumber
                  v-model:value="monthState.period.end"
                  :min="2"
                  :max="12"
                  size="small"
                  class="art-cron-num"
                />
                <span>{{ t('scheduler.task.cronMonth') }}</span>
              </div>
            </Radio>
            <Radio value="loop" class="art-cron-opt-item">
              <div class="art-cron-opt-inline">
                <span
                  >{{ t('scheduler.task.cronLoop') }} {{ t('scheduler.task.cronLoopStart') }}</span
                >
                <InputNumber
                  v-model:value="monthState.loop.start"
                  :min="1"
                  :max="12"
                  size="small"
                  class="art-cron-num"
                />
                <span>{{ t('scheduler.task.cronLoopStep') }}</span>
                <InputNumber
                  v-model:value="monthState.loop.step"
                  :min="1"
                  :max="12"
                  size="small"
                  class="art-cron-num"
                />
                <span>{{ t('scheduler.task.cronLoopUnitMonth') }}</span>
              </div>
            </Radio>
            <Radio value="specify" class="art-cron-opt-item">
              <div class="w-full">
                <span class="font-medium text-slate-800">{{
                  t('scheduler.task.cronSpecify')
                }}</span>
                <div class="art-chip-grid mt-2">
                  <button
                    v-for="num in numbers12"
                    :key="num"
                    type="button"
                    class="art-num-chip"
                    :class="{ 'art-num-chip--active': monthState.specify.includes(num) }"
                    @click.stop="toggleSpecifyItem(monthState, num)"
                  >
                    {{ num < 10 ? `0${num}` : num }} 月
                  </button>
                </div>
              </div>
            </Radio>
          </RadioGroup>
        </TabPane>

        <!-- 周 -->
        <TabPane key="week">
          <template #tab>
            <span class="art-tab-title">
              <CalendarOutlined />
              {{ t('scheduler.task.cronWeek') }}
            </span>
          </template>
          <RadioGroup v-model:value="weekState.type" class="art-cron-options">
            <Radio value="every" class="art-cron-opt-item">
              <span class="font-medium text-slate-800">{{
                t('scheduler.task.cronEveryWeekChoice')
              }}</span>
            </Radio>
            <Radio value="unspecified" class="art-cron-opt-item">
              <span class="font-medium text-slate-800">{{
                t('scheduler.task.cronUnspecified')
              }}</span>
            </Radio>
            <Radio value="period" class="art-cron-opt-item">
              <div class="art-cron-opt-inline">
                <span
                  >{{ t('scheduler.task.cronPeriod') }}
                  {{ t('scheduler.task.cronPeriodFrom') }}</span
                >
                <InputNumber
                  v-model:value="weekState.period.start"
                  :min="1"
                  :max="6"
                  size="small"
                  class="art-cron-num"
                />
                <span>{{ t('scheduler.task.cronPeriodTo') }}</span>
                <InputNumber
                  v-model:value="weekState.period.end"
                  :min="2"
                  :max="7"
                  size="small"
                  class="art-cron-num"
                />
              </div>
            </Radio>
            <Radio value="loop" class="art-cron-opt-item">
              <div class="art-cron-opt-inline">
                <span
                  >{{ t('scheduler.task.cronLoop') }} {{ t('scheduler.task.cronLoopStart') }}</span
                >
                <InputNumber
                  v-model:value="weekState.loop.start"
                  :min="1"
                  :max="7"
                  size="small"
                  class="art-cron-num"
                />
                <span>{{ t('scheduler.task.cronLoopStep') }}</span>
                <InputNumber
                  v-model:value="weekState.loop.step"
                  :min="1"
                  :max="7"
                  size="small"
                  class="art-cron-num"
                />
                <span>{{ t('scheduler.task.cronLoopUnitDay') }}</span>
              </div>
            </Radio>
            <Radio value="specify" class="art-cron-opt-item">
              <div class="w-full">
                <span class="font-medium text-slate-800">{{
                  t('scheduler.task.cronSpecify')
                }}</span>
                <div class="art-chip-grid-week mt-2">
                  <button
                    v-for="opt in weekOptions"
                    :key="opt.value"
                    type="button"
                    class="art-num-chip art-num-chip--week"
                    :class="{ 'art-num-chip--active': weekState.specify.includes(opt.value) }"
                    @click.stop="toggleSpecifyItem(weekState, opt.value)"
                  >
                    {{ opt.label }}
                  </button>
                </div>
              </div>
            </Radio>
          </RadioGroup>
        </TabPane>
      </Tabs>

      <!-- 底部表达式汇总与实时解析面板 -->
      <div class="art-cron-summary">
        <div class="art-cron-summary__header">
          <span class="font-semibold text-slate-700 text-xs uppercase tracking-wider">
            {{ t('scheduler.task.cronResult') }}
          </span>
        </div>

        <!-- 6 个字段 mini-cards -->
        <div class="art-cron-tokens-row">
          <div class="art-token-card">
            <span class="art-token-card__label">{{ t('scheduler.task.cronSecond') }}</span>
            <span class="art-token-card__val">{{ secondToken }}</span>
          </div>
          <div class="art-token-card">
            <span class="art-token-card__label">{{ t('scheduler.task.cronMinute') }}</span>
            <span class="art-token-card__val">{{ minuteToken }}</span>
          </div>
          <div class="art-token-card">
            <span class="art-token-card__label">{{ t('scheduler.task.cronHour') }}</span>
            <span class="art-token-card__val">{{ hourToken }}</span>
          </div>
          <div class="art-token-card">
            <span class="art-token-card__label">{{ t('scheduler.task.cronDay') }}</span>
            <span class="art-token-card__val">{{ dayToken }}</span>
          </div>
          <div class="art-token-card">
            <span class="art-token-card__label">{{ t('scheduler.task.cronMonth') }}</span>
            <span class="art-token-card__val">{{ monthToken }}</span>
          </div>
          <div class="art-token-card">
            <span class="art-token-card__label">{{ t('scheduler.task.cronWeek') }}</span>
            <span class="art-token-card__val">{{ weekToken }}</span>
          </div>
        </div>

        <!-- 完整 Cron 字符串与复制按钮 -->
        <div class="art-cron-full-row">
          <span class="art-cron-full-label">{{ t('scheduler.task.cronComplete') }}:</span>
          <Input :value="fullCron" readonly class="art-cron-full-input" />
          <Button type="default" @click="handleCopy">
            <CopyOutlined />
            {{ t('common.copy') }}
          </Button>
        </div>

        <!-- 预计执行时间面板 -->
        <div class="art-runs-panel mt-3">
          <div class="art-runs-panel__header">
            <ClockCircleOutlined class="text-blue-500" />
            <span>{{ t('scheduler.task.nextRuns') }}</span>
          </div>
          <div v-if="nextRuns.length > 0" class="art-runs-tags">
            <div v-for="(timeStr, index) in nextRuns" :key="index" class="art-run-chip">
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
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button @click="handleCancel">
          {{ t('common.cancel') }}
        </Button>
        <Button type="primary" @click="handleApply">
          <CheckOutlined />
          {{ t('scheduler.task.applyCron') }}
        </Button>
      </div>
    </template>
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

.art-cron-body {
  padding-top: 6px;
}

.art-tab-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}

.art-cron-tabs {
  :deep(.ant-tabs-content-holder) {
    min-height: 250px;
    background: #ffffff;
    padding: 16px;
    border: 1px solid #e2e8f0;
    border-top: none;
    border-radius: 0 0 10px 10px;
  }
}

.art-cron-options {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
}

.art-cron-opt-item {
  display: flex;
  align-items: flex-start;
}

.art-cron-opt-inline {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 13px;
  color: #334155;
}

.art-cron-num {
  width: 72px;
}

.art-chip-grid {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 6px;
}

.art-chip-grid-week {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.art-num-chip {
  height: 28px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: #475569;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;

  &:hover {
    border-color: #93c5fd;
    color: #1d4ed8;
    background: #eff6ff;
  }

  &--active {
    background: #2563eb;
    color: #ffffff;
    border-color: #2563eb;
    font-weight: 600;

    &:hover {
      background: #1d4ed8;
      color: #ffffff;
    }
  }

  &--week {
    font-family: inherit;
    font-size: 12px;
  }
}

.art-cron-summary {
  margin-top: 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 14px 16px;
}

.art-cron-summary__header {
  margin-bottom: 10px;
}

.art-cron-tokens-row {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.art-token-card {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 6px 4px;
  text-align: center;
}

.art-token-card__label {
  display: block;
  font-size: 11px;
  color: #64748b;
  margin-bottom: 2px;
}

.art-token-card__val {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  font-weight: 700;
  color: #2563eb;
}

.art-cron-full-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.art-cron-full-label {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  white-space: nowrap;
}

.art-cron-full-input {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 600;
  background: #ffffff;
  color: #0f172a;
}

.art-runs-panel {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px 12px;
}

.art-runs-panel__header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #334155;
  margin-bottom: 6px;
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
  padding: 1px 5px;
  font-weight: 600;
  font-size: 11px;
}

.art-run-chip__time {
  padding: 1px 6px;
  color: #1e293b;
}

.art-runs-alert {
  padding: 4px 8px;
  font-size: 12px;
}
</style>
