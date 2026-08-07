<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FormInstance, FormRules } from 'element-plus'
import {
  ElButton,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElOption,
  ElSelect,
  ElSwitch,
  ElTreeSelect,
} from 'element-plus'

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

const rules = computed<FormRules<FormModel>>(() => ({
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
      validator: (_rule, value: string, callback) => {
        if (form.type === 'MENU' && !value.trim()) {
          callback(new Error(t('permission.pathRequired')))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
  component: [
    {
      validator: (_rule, value: string, callback) => {
        if (form.type === 'MENU' && !value.trim()) {
          callback(new Error(t('permission.componentRequired')))
          return
        }
        callback()
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
  <el-dialog
    v-model="visible"
    :title="title"
    width="560px"
    destroy-on-close
    class="permission-dialog"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="108px"
      class="permission-form"
    >
      <el-form-item :label="t('permission.type')" prop="type">
        <el-select v-model="form.type" class="w-full" :disabled="mode === 'edit'">
          <el-option :label="t('permission.typeDirectory')" value="DIRECTORY" />
          <el-option :label="t('permission.typeMenu')" value="MENU" />
          <el-option :label="t('permission.typeButton')" value="BUTTON" />
        </el-select>
      </el-form-item>

      <el-form-item :label="t('permission.parent')" prop="parentId">
        <el-tree-select
          v-model="form.parentId"
          :data="parentTreeData"
          clearable
          check-strictly
          filterable
          :render-after-expand="false"
          :placeholder="t('permission.parentPlaceholder')"
          class="w-full"
        />
      </el-form-item>

      <el-form-item :label="t('permission.name')" prop="name">
        <el-input v-model="form.name" maxlength="64" show-word-limit />
      </el-form-item>

      <el-form-item :label="t('permission.nameEn')" prop="nameEn">
        <el-input v-model="form.nameEn" maxlength="64" show-word-limit />
      </el-form-item>

      <el-form-item :label="t('permission.code')" prop="code">
        <el-input v-model="form.code" maxlength="128" show-word-limit :disabled="mode === 'edit'" />
      </el-form-item>

      <el-form-item v-if="showIconField" :label="t('permission.icon')" prop="icon">
        <IconPicker v-model="form.icon" />
      </el-form-item>

      <el-form-item v-if="showRouteFields" :label="t('permission.path')" prop="path">
        <el-input v-model="form.path" maxlength="255" placeholder="/system/example" />
      </el-form-item>

      <el-form-item v-if="showRouteFields" :label="t('permission.component')" prop="component">
        <el-input v-model="form.component" maxlength="255" placeholder="system/example/index" />
      </el-form-item>

      <el-form-item :label="t('permission.sort')" prop="sort">
        <el-input-number v-model="form.sort" :min="0" :max="9999" controls-position="right" />
      </el-form-item>

      <el-form-item :label="t('permission.enabled')" prop="enabled">
        <el-switch v-model="form.enabled" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        {{ t('common.confirm') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.permission-form {
  .w-full {
    width: 100%;
  }
}
</style>
