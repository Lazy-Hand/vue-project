<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FormInstance, Rule } from 'antdv-next'
import { Button, DatePicker, Form, FormItem, Input, Modal, Select, TreeSelect } from 'antdv-next'
import dayjs, { type Dayjs } from 'dayjs'

import type { Client } from '@/types/client'
import type { DeptTreeNode } from '@/types/dept'
import type { Project, ProjectPayload, UpdateProjectPayload } from '@/types/project'
import type { ManagedUser } from '@/types/user'

interface Props {
  modelValue: boolean
  mode: 'create' | 'edit'
  editing?: Project | null
  clients: Client[]
  users: ManagedUser[]
  deptTree: DeptTreeNode[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: ProjectPayload | UpdateProjectPayload]
}>()

const { t } = useI18n()
const formRef = ref<FormInstance>()
const submitting = ref(false)

interface FormModel {
  code: string
  name: string
  clientId: string | undefined
  description: string
  contractAmount: string
  budgetedCost: string
  actualCost: string
  settlementStatus: string | undefined
  startDate: Dayjs | null
  endDate: Dayjs | null
  managerId: string | undefined
  deptId: unknown
}

const form = reactive<FormModel>({
  code: '',
  name: '',
  clientId: undefined,
  description: '',
  contractAmount: '',
  budgetedCost: '',
  actualCost: '',
  settlementStatus: undefined,
  startDate: null,
  endDate: null,
  managerId: undefined,
  deptId: null,
})

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const title = computed(() =>
  props.mode === 'create' ? t('project.createTitle') : t('project.editTitle'),
)

const clientOptions = computed(() => props.clients.map((c) => ({ label: c.name, value: c.id })))
const userOptions = computed(() =>
  props.users.map((u) => ({ label: u.nickname ?? u.username, value: u.id })),
)

const deptTreeData = computed(() => {
  const map = (nodes: DeptTreeNode[]): Array<Record<string, unknown>> =>
    nodes.map((n) => ({ value: n.id, label: n.name, children: map(n.children ?? []) }))
  return map(props.deptTree)
})

const settlementOptions = computed(() => [
  { label: t('project.settlementUNSETTLED'), value: 'UNSETTLED' },
  { label: t('project.settlementPARTIAL'), value: 'PARTIAL' },
  { label: t('project.settlementSETTLED'), value: 'SETTLED' },
])

const rules = computed<Partial<Record<keyof FormModel, Rule[]>>>(() => ({
  code: [
    { required: true, message: t('project.codeRequired'), trigger: 'blur' },
    {
      validator: async (_rule, value) => {
        const len = String(value ?? '').trim().length
        if (len < 2 || len > 64) throw new Error(t('project.codeLength'))
      },
      trigger: 'blur',
    },
  ],
  name: [
    { required: true, message: t('project.nameRequired'), trigger: 'blur' },
    {
      validator: async (_rule, value) => {
        const name = String(value ?? '').trim()
        if (!name) throw new Error(t('project.nameRequired'))
        if (name.length > 64) throw new Error(t('project.nameLength'))
      },
      trigger: 'blur',
    },
  ],
  clientId: [{ required: true, message: t('project.clientRequired'), trigger: 'change' }],
  contractAmount: [
    {
      validator: async (_rule, value) => {
        if (!value) return
        if (Number.isNaN(Number(value))) throw new Error(t('project.amountInvalid'))
      },
      trigger: 'blur',
    },
  ],
  budgetedCost: [
    {
      validator: async (_rule, value) => {
        if (!value) return
        if (Number.isNaN(Number(value))) throw new Error(t('project.amountInvalid'))
      },
      trigger: 'blur',
    },
  ],
  actualCost: [
    {
      validator: async (_rule, value) => {
        if (!value) return
        if (Number.isNaN(Number(value))) throw new Error(t('project.amountInvalid'))
      },
      trigger: 'blur',
    },
  ],
}))

function toDayjs(value: string | null): Dayjs | null {
  if (!value) return null
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed : null
}

function toIsoString(value: Dayjs | null): string | undefined {
  return value?.isValid() ? value.toISOString() : undefined
}

function resetForm(): void {
  form.code = ''
  form.name = ''
  form.clientId = undefined
  form.description = ''
  form.contractAmount = ''
  form.budgetedCost = ''
  form.actualCost = ''
  form.settlementStatus = undefined
  form.startDate = null
  form.endDate = null
  form.managerId = undefined
  form.deptId = null
}

function fillFromEditing(p: Project): void {
  form.code = p.code
  form.name = p.name
  form.clientId = p.clientId
  form.description = p.description ?? ''
  form.contractAmount = p.contractAmount ?? ''
  form.budgetedCost = p.budgetedCost ?? ''
  form.actualCost = p.actualCost ?? ''
  form.settlementStatus = p.settlementStatus
  form.startDate = toDayjs(p.startDate)
  form.endDate = toDayjs(p.endDate)
  form.managerId = p.managerId ?? undefined
  form.deptId = p.deptId ?? null
}

watch(
  () => [props.modelValue, props.mode, props.editing] as const,
  ([open]) => {
    if (!open) return
    if (props.mode === 'edit' && props.editing) fillFromEditing(props.editing)
    else resetForm()
  },
  { immediate: true },
)

function buildPayload(): ProjectPayload | UpdateProjectPayload {
  const description = form.description.trim()
  const contractAmount = form.contractAmount.trim()
  const budgetedCost = form.budgetedCost.trim()
  const actualCost = form.actualCost.trim()
  const startDate = toIsoString(form.startDate)
  const endDate = toIsoString(form.endDate)
  const deptId = form.deptId ? String(form.deptId) : null
  const managerId = form.managerId ? String(form.managerId) : null

  if (props.mode === 'create') {
    const payload: ProjectPayload = {
      code: form.code.trim(),
      name: form.name.trim(),
      clientId: String(form.clientId),
    }
    if (description) payload.description = description
    if (contractAmount) payload.contractAmount = contractAmount
    if (budgetedCost) payload.budgetedCost = budgetedCost
    if (actualCost) payload.actualCost = actualCost
    if (form.settlementStatus)
      payload.settlementStatus = form.settlementStatus as ProjectPayload['settlementStatus']
    if (startDate) payload.startDate = startDate
    if (endDate) payload.endDate = endDate
    if (managerId) payload.managerId = managerId
    if (deptId) payload.deptId = deptId
    return payload
  }

  const payload: UpdateProjectPayload = {
    code: form.code.trim(),
    name: form.name.trim(),
    clientId: String(form.clientId),
  }
  if (description) payload.description = description
  if (contractAmount) payload.contractAmount = contractAmount
  if (budgetedCost) payload.budgetedCost = budgetedCost
  if (actualCost) payload.actualCost = actualCost
  if (form.settlementStatus)
    payload.settlementStatus = form.settlementStatus as UpdateProjectPayload['settlementStatus']
  if (startDate) payload.startDate = startDate
  if (endDate) payload.endDate = endDate
  payload.managerId = managerId
  payload.deptId = deptId
  return payload
}

async function handleSubmit(): Promise<void> {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  emit('submit', buildPayload())
}

defineExpose({
  setSubmitting(value: boolean) {
    submitting.value = value
  },
})
</script>

<template>
  <Modal
    v-model:open="visible"
    :title="title"
    width="680px"
    destroy-on-hidden
    :get-container="false"
    :confirm-loading="submitting"
  >
    <Form ref="formRef" :model="form" :rules="rules" layout="vertical">
      <div class="grid grid-cols-2 gap-4">
        <FormItem :label="t('project.code')" name="code">
          <Input
            v-model:value="form.code"
            :maxlength="64"
            :placeholder="t('project.codePlaceholder')"
          />
        </FormItem>
        <FormItem :label="t('project.name')" name="name">
          <Input
            v-model:value="form.name"
            :maxlength="64"
            :placeholder="t('project.namePlaceholder')"
          />
        </FormItem>
      </div>

      <FormItem :label="t('project.client')" name="clientId">
        <Select
          v-model:value="form.clientId"
          :options="clientOptions"
          show-search
          :filter-option="
            (input: string, option: unknown) =>
              String((option as { label: string }).label ?? '')
                .toLowerCase()
                .includes(input.toLowerCase())
          "
          :placeholder="t('project.clientPlaceholder')"
        />
      </FormItem>

      <FormItem :label="t('project.description')" name="description">
        <Input
          v-model:value="form.description"
          :maxlength="512"
          :placeholder="t('project.descriptionPlaceholder')"
        />
      </FormItem>

      <div class="grid grid-cols-3 gap-4">
        <FormItem :label="t('project.contractAmount')" name="contractAmount">
          <Input
            v-model:value="form.contractAmount"
            :placeholder="t('project.contractAmountPlaceholder')"
          />
        </FormItem>
        <FormItem :label="t('project.budgetedCost')" name="budgetedCost">
          <Input
            v-model:value="form.budgetedCost"
            :placeholder="t('project.budgetedCostPlaceholder')"
          />
        </FormItem>
        <FormItem :label="t('project.actualCost')" name="actualCost">
          <Input
            v-model:value="form.actualCost"
            :placeholder="t('project.actualCostPlaceholder')"
          />
        </FormItem>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <FormItem :label="t('project.settlementStatus')" name="settlementStatus">
          <Select
            v-model:value="form.settlementStatus"
            :options="settlementOptions"
            allow-clear
            :placeholder="t('project.settlementPlaceholder')"
          />
        </FormItem>
        <FormItem :label="t('project.manager')" name="managerId">
          <Select
            v-model:value="form.managerId"
            :options="userOptions"
            show-search
            allow-clear
            :placeholder="t('project.managerPlaceholder')"
          />
        </FormItem>
      </div>

      <FormItem :label="t('project.dept')" name="deptId">
        <TreeSelect
          v-model:value="form.deptId"
          :tree-data="deptTreeData"
          allow-clear
          tree-default-expand-all
          :placeholder="t('project.deptPlaceholder')"
        />
      </FormItem>

      <div class="grid grid-cols-2 gap-4">
        <FormItem :label="t('project.startDate')" name="startDate">
          <DatePicker
            v-model:value="form.startDate"
            class="w-full"
            show-time
            :placeholder="t('project.startDatePlaceholder')"
          />
        </FormItem>
        <FormItem :label="t('project.endDate')" name="endDate">
          <DatePicker
            v-model:value="form.endDate"
            class="w-full"
            show-time
            :placeholder="t('project.endDatePlaceholder')"
          />
        </FormItem>
      </div>
    </Form>

    <template #footer>
      <Button @click="visible = false">{{ t('common.cancel') }}</Button>
      <Button type="primary" :loading="submitting" @click="handleSubmit">
        {{ t('common.confirm') }}
      </Button>
    </template>
  </Modal>
</template>
