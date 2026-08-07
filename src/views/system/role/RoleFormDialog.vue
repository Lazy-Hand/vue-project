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

const rules = computed<FormRules<FormModel>>(() => ({
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
          callback(new Error(t('role.deptIdsRequired')))
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
  form.sort = 0
  form.enabled = true
}

function fillFromEditing(role: Role): void {
  form.code = role.code
  form.name = role.name
  form.description = role.description ?? ''
  form.dataScope = role.dataScope
  form.deptIds = [...(props.initialDeptIds ?? [])]
  form.sort = role.sort
  form.enabled = role.enabled
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
  <el-dialog v-model="visible" :title="title" width="560px" destroy-on-close>
    <el-form ref="formRef" :model="form" :rules="rules" label-width="108px">
      <el-form-item :label="t('role.code')" prop="code">
        <el-input
          v-model="form.code"
          maxlength="64"
          show-word-limit
          :disabled="isSuperAdmin || mode === 'edit'"
        />
      </el-form-item>

      <el-form-item :label="t('role.name')" prop="name">
        <el-input v-model="form.name" maxlength="64" show-word-limit />
      </el-form-item>

      <el-form-item :label="t('role.description')" prop="description">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="2"
          maxlength="255"
          show-word-limit
        />
      </el-form-item>

      <el-form-item :label="t('role.dataScope')" prop="dataScope">
        <el-select v-model="form.dataScope" class="w-full" :disabled="isSuperAdmin">
          <el-option
            v-for="scope in DATA_SCOPES"
            :key="scope"
            :label="t(`role.dataScope_${scope}`)"
            :value="scope"
          />
        </el-select>
      </el-form-item>

      <el-form-item v-if="showDeptField" :label="t('role.deptIds')" prop="deptIds">
        <el-tree-select
          v-model="form.deptIds"
          :data="deptTreeData"
          multiple
          show-checkbox
          check-strictly
          filterable
          collapse-tags
          collapse-tags-tooltip
          :render-after-expand="false"
          :placeholder="t('role.deptIdsPlaceholder')"
          class="w-full"
        />
      </el-form-item>

      <el-form-item :label="t('role.sort')" prop="sort">
        <el-input-number v-model="form.sort" :min="0" :max="9999" controls-position="right" />
      </el-form-item>

      <el-form-item :label="t('role.enabled')" prop="enabled">
        <el-switch v-model="form.enabled" :disabled="isSuperAdmin" />
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
.w-full {
  width: 100%;
}
</style>
