<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FormInstance, Rule } from 'antdv-next'
import {
  Button,
  Form,
  FormItem,
  Input,
  InputNumber,
  Modal,
  Select,
  Switch,
  TextArea,
  TreeSelect,
} from 'antdv-next'

import type { DeptTreeNode } from '@/types/dept'
import {
  DATA_SCOPES,
  SUPER_ADMIN_ROLE_CODE,
  type DataScope,
  type Role,
  type RolePayload,
} from '@/types/role'

interface Props {
  modelValue: boolean
  mode: 'create' | 'edit'
  editing?: Role | null
  deptTree: DeptTreeNode[]
  initialDeptIds?: string[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: RolePayload]
}>()

const { t } = useI18n()
const formRef = ref<FormInstance>()
const submitting = ref(false)

interface FormModel {
  code: string
  name: string
  description: string
  dataScope: DataScope
  deptIds: string[]
  sort: number
  enabled: boolean
}

const form = reactive<FormModel>({
  code: '',
  name: '',
  description: '',
  dataScope: 'ALL',
  deptIds: [],
  sort: 0,
  enabled: true,
})

interface DeptSelectionItem {
  value: string
  label?: unknown
  halfChecked?: boolean
}

const deptSelection = ref<DeptSelectionItem[]>([])

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const title = computed(() =>
  props.mode === 'create' ? t('role.createTitle') : t('role.editTitle'),
)

const isSuperAdmin = computed(
  () => props.mode === 'edit' && props.editing?.code === SUPER_ADMIN_ROLE_CODE,
)

const showDeptField = computed(() => form.dataScope === 'CUSTOM')
const dataScopeOptions = computed(() =>
  DATA_SCOPES.map((scope) => ({ value: scope, label: t(`role.dataScope_${scope}`) })),
)

const deptTreeData = computed(() => {
  const mapNodes = (nodes: DeptTreeNode[]): Array<Record<string, unknown>> =>
    nodes.map((node) => ({
      value: node.id,
      label: node.name,
      disabled: !node.enabled,
      children: mapNodes(node.children ?? []),
    }))
  return mapNodes(props.deptTree)
})

const rules = computed<Record<string, Rule[]>>(() => ({
  code: [
    { required: true, message: t('role.codeRequired'), trigger: 'blur' },
    {
      pattern: /^[A-Za-z][\w-]*$/,
      message: t('role.codeInvalid'),
      trigger: 'blur',
    },
  ],
  name: [{ required: true, message: t('role.nameRequired'), trigger: 'blur' }],
  dataScope: [{ required: true, message: t('role.dataScopeRequired'), trigger: 'change' }],
  deptIds: [
    {
      validator: (_rule, value: string[], callback) => {
        if (form.dataScope === 'CUSTOM' && (!value || value.length === 0)) {
          callback(t('role.deptIdsRequired'))
          return
        }
        callback()
      },
      trigger: 'change',
    },
  ],
}))

function resetForm(): void {
  form.code = ''
  form.name = ''
  form.description = ''
  form.dataScope = 'ALL'
  form.deptIds = []
  deptSelection.value = []
  form.sort = 0
  form.enabled = true
}

function fillFromEditing(role: Role): void {
  form.code = role.code
  form.name = role.name
  form.description = role.description ?? ''
  form.dataScope = role.dataScope
  form.deptIds = [...(props.initialDeptIds ?? [])]
  deptSelection.value = form.deptIds.map((value) => ({ value }))
  form.sort = role.sort
  form.enabled = role.enabled
}

function normalizeDeptSelection(value: unknown): DeptSelectionItem[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((entry) => {
    if (typeof entry === 'string' || typeof entry === 'number') {
      return [{ value: String(entry) }]
    }
    if (typeof entry !== 'object' || entry === null || !('value' in entry)) return []

    const rawValue = entry.value
    if (typeof rawValue !== 'string' && typeof rawValue !== 'number') return []

    const item: DeptSelectionItem = { value: String(rawValue) }
    if ('label' in entry && entry.label !== undefined) item.label = entry.label
    if ('halfChecked' in entry && typeof entry.halfChecked === 'boolean') {
      item.halfChecked = entry.halfChecked
    }
    return [item]
  })
}

function handleDeptSelectionChange(value: unknown): void {
  deptSelection.value = normalizeDeptSelection(value)
  form.deptIds = deptSelection.value.map((item) => item.value)
}

watch(
  () => [props.modelValue, props.mode, props.editing, props.initialDeptIds] as const,
  ([open]) => {
    if (!open) return
    if (props.mode === 'edit' && props.editing) {
      fillFromEditing(props.editing)
    } else {
      resetForm()
    }
  },
)

watch(
  () => form.dataScope,
  () => {
    formRef.value?.clearValidate(['deptIds'])
  },
)

function buildPayload(): RolePayload {
  const payload: RolePayload = {
    code: form.code.trim(),
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    dataScope: form.dataScope,
    sort: form.sort,
    enabled: form.enabled,
  }

  if (form.dataScope === 'CUSTOM') {
    payload.deptIds = [...form.deptIds]
  } else if (props.mode === 'edit') {
    payload.deptIds = []
  }

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
  <Modal v-model:open="visible" :title="title" width="560px" destroy-on-hidden>
    <Form ref="formRef" :model="form" :rules="rules" class="role-form">
      <FormItem :label="t('role.code')" name="code">
        <Input
          v-model:value="form.code"
          :maxlength="64"
          show-count
          :disabled="isSuperAdmin || mode === 'edit'"
        />
      </FormItem>

      <FormItem :label="t('role.name')" name="name">
        <Input v-model:value="form.name" :maxlength="64" show-count />
      </FormItem>

      <FormItem :label="t('role.description')" name="description">
        <TextArea v-model:value="form.description" :rows="2" :maxlength="255" show-count />
      </FormItem>

      <FormItem :label="t('role.dataScope')" name="dataScope">
        <Select
          v-model:value="form.dataScope"
          class="w-full"
          :disabled="isSuperAdmin"
          :options="dataScopeOptions"
        />
      </FormItem>

      <FormItem v-if="showDeptField" :label="t('role.deptIds')" name="deptIds">
        <TreeSelect
          v-model:value="deptSelection"
          :tree-data="deptTreeData"
          tree-checkable
          tree-check-strictly
          :show-search="true"
          allow-clear
          :placeholder="t('role.deptIdsPlaceholder')"
          class="w-full"
          @change="handleDeptSelectionChange"
        />
      </FormItem>

      <FormItem :label="t('role.sort')" name="sort">
        <InputNumber v-model:value="form.sort" :min="0" :max="9999" />
      </FormItem>

      <FormItem :label="t('role.enabled')" name="enabled">
        <Switch v-model:checked="form.enabled" :disabled="isSuperAdmin" />
      </FormItem>
    </Form>

    <template #footer>
      <Button @click="visible = false">{{ t('common.cancel') }}</Button>
      <Button type="primary" :loading="submitting" @click="handleSubmit">
        {{ t('common.confirm') }}
      </Button>
    </template>
  </Modal>
</template>

<style scoped lang="scss">
.w-full {
  width: 100%;
}

.role-form {
  :deep(.ant-form-item-label) {
    width: 108px;
  }
}
</style>
