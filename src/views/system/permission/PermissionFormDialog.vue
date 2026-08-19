<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Button,
  Form,
  FormItem,
  Input,
  InputNumber,
  Modal,
  Select,
  Switch,
  TreeSelect,
  type FormInstance,
  type Rule,
} from 'antdv-next'

import IconPicker from '@/components/IconPicker/index.vue'
import type { PermissionPayload, PermissionTreeNode, PermissionType } from '@/types/permission'
import { collectDescendantIds } from './utils'

interface Props {
  modelValue: boolean
  mode: 'create' | 'edit'
  tree: PermissionTreeNode[]
  initialParentId?: string | null
  editing?: PermissionTreeNode | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: PermissionPayload]
}>()

const { t } = useI18n()
const formRef = ref<FormInstance>()
const submitting = ref(false)

interface FormModel {
  type: PermissionType
  parentId: string | undefined
  name: string
  nameEn: string
  code: string
  icon: string | null
  path: string
  component: string
  sort: number
  enabled: boolean
}

const form = reactive<FormModel>({
  type: 'MENU',
  parentId: undefined,
  name: '',
  nameEn: '',
  code: '',
  icon: null,
  path: '',
  component: '',
  sort: 0,
  enabled: true,
})

const rules = computed<Partial<Record<keyof FormModel, Rule[]>>>(() => ({
  type: [{ required: true, message: t('permission.typeRequired'), trigger: 'change' }],
  name: [{ required: true, message: t('permission.nameRequired'), trigger: 'blur' }],
  code: [
    { required: true, message: t('permission.codeRequired'), trigger: 'blur' },
    {
      pattern: /^[A-Za-z][\w:-]*$/,
      message: t('permission.codeInvalid'),
      trigger: 'blur',
    },
  ],
  path: [
    {
      validator: async (_rule, value) => {
        const path = typeof value === 'string' ? value : ''
        if (form.type === 'MENU' && !path.trim()) {
          throw new Error(t('permission.pathRequired'))
        }
      },
      trigger: 'blur',
    },
  ],
  component: [
    {
      validator: async (_rule, value) => {
        const component = typeof value === 'string' ? value : ''
        if (form.type === 'MENU' && !component.trim()) {
          throw new Error(t('permission.componentRequired'))
        }
      },
      trigger: 'blur',
    },
  ],
}))

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const title = computed(() =>
  props.mode === 'create' ? t('permission.createTitle') : t('permission.editTitle'),
)

const showRouteFields = computed(() => form.type === 'MENU')
const showIconField = computed(() => form.type === 'DIRECTORY' || form.type === 'MENU')
const permissionTypeOptions = computed(() => [
  { label: t('permission.typeDirectory'), value: 'DIRECTORY' },
  { label: t('permission.typeMenu'), value: 'MENU' },
  { label: t('permission.typeButton'), value: 'BUTTON' },
])

const excludedParentIds = computed(() => {
  if (props.mode !== 'edit' || !props.editing) return new Set<string>()
  return new Set(collectDescendantIds(props.editing))
})

const parentTreeData = computed(() => {
  const mapNodes = (nodes: PermissionTreeNode[]): Array<Record<string, unknown>> =>
    nodes
      .filter((node) => node.type !== 'BUTTON')
      .filter((node) => !excludedParentIds.value.has(node.id))
      .map((node) => ({
        value: node.id,
        label: `${node.name} (${node.code})`,
        children: mapNodes(node.children ?? []),
      }))

  return mapNodes(props.tree)
})

function resetForm(): void {
  form.type = 'MENU'
  form.parentId = props.initialParentId ?? undefined
  form.name = ''
  form.nameEn = ''
  form.code = ''
  form.icon = null
  form.path = ''
  form.component = ''
  form.sort = 0
  form.enabled = true
}

function fillFromEditing(node: PermissionTreeNode): void {
  form.type = node.type
  form.parentId = node.parentId ?? undefined
  form.name = node.nameI18n?.['zh-CN'] ?? node.name
  form.nameEn = node.nameI18n?.['en-US'] ?? ''
  form.code = node.code
  form.icon = node.icon
  form.path = node.path ?? ''
  form.component = node.component ?? ''
  form.sort = node.sort
  form.enabled = node.enabled
}

watch(
  () => [props.modelValue, props.mode, props.editing, props.initialParentId] as const,
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
  () => form.type,
  () => {
    formRef.value?.clearValidate(['path', 'component'])
  },
)

function buildPayload(): PermissionPayload {
  const name = form.name.trim()
  const nameEn = form.nameEn.trim()
  const payload: PermissionPayload = {
    type: form.type,
    code: form.code.trim(),
    name,
    nameI18n: {
      'zh-CN': name,
      ...(nameEn ? { 'en-US': nameEn } : {}),
    },
    sort: form.sort,
    enabled: form.enabled,
  }

  if (form.parentId) {
    payload.parentId = form.parentId
  }

  if (showIconField.value) {
    payload.icon = form.icon ?? undefined
  }

  if (showRouteFields.value) {
    payload.path = form.path.trim()
    payload.component = form.component.trim()
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
  <Modal
    v-model:open="visible"
    :title="title"
    width="560px"
    destroy-on-hidden
    class="permission-dialog"
  >
    <Form
      ref="formRef"
      :model="form"
      :rules="rules"
      :label-col="{ span: 5 }"
      :wrapper-col="{ span: 19 }"
      class="permission-form"
    >
      <FormItem :label="t('permission.type')" name="type">
        <Select
          v-model:value="form.type"
          class="w-full"
          :disabled="mode === 'edit'"
          :options="permissionTypeOptions"
          :placeholder="t('permission.typePlaceholder')"
        />
      </FormItem>

      <FormItem :label="t('permission.parent')" name="parentId">
        <TreeSelect
          v-model:value="form.parentId"
          :tree-data="parentTreeData"
          allow-clear
          show-search
          :placeholder="t('permission.parentPlaceholder')"
          class="w-full"
        />
      </FormItem>

      <FormItem :label="t('permission.name')" name="name">
        <Input
          v-model:value="form.name"
          :maxlength="64"
          show-count
          :placeholder="t('permission.namePlaceholder')"
        />
      </FormItem>

      <FormItem :label="t('permission.nameEn')" name="nameEn">
        <Input
          v-model:value="form.nameEn"
          :maxlength="64"
          show-count
          :placeholder="t('permission.nameEnPlaceholder')"
        />
      </FormItem>

      <FormItem :label="t('permission.code')" name="code">
        <Input
          v-model:value="form.code"
          :maxlength="128"
          show-count
          :disabled="mode === 'edit'"
          :placeholder="t('permission.codePlaceholder')"
        />
      </FormItem>

      <FormItem v-if="showIconField" :label="t('permission.icon')" name="icon">
        <IconPicker v-model="form.icon" />
      </FormItem>

      <FormItem v-if="showRouteFields" :label="t('permission.path')" name="path">
        <Input v-model:value="form.path" :maxlength="255" placeholder="/system/example" />
      </FormItem>

      <FormItem v-if="showRouteFields" :label="t('permission.component')" name="component">
        <Input v-model:value="form.component" :maxlength="255" placeholder="system/example/index" />
      </FormItem>

      <FormItem :label="t('permission.sort')" name="sort">
        <InputNumber
          v-model:value="form.sort"
          :min="0"
          :max="9999"
          controls
          :placeholder="t('permission.sortPlaceholder')"
        />
      </FormItem>

      <FormItem :label="t('permission.enabled')" name="enabled">
        <Switch v-model:checked="form.enabled" />
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
.permission-form {
  .w-full {
    width: 100%;
  }
}
</style>
