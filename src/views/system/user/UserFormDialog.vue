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
  ElOption,
  ElSelect,
  ElSwitch,
  ElTreeSelect,
} from 'element-plus'

import type { DeptTreeNode } from '@/types/dept'
import type { Post } from '@/types/post'
import type { CreateUserPayload, ManagedUser, UpdateUserPayload } from '@/types/user'

interface Props {
  modelValue: boolean
  mode: 'create' | 'edit'
  editing?: ManagedUser | null
  deptTree: DeptTreeNode[]
  posts: Post[]
  initialPostIds?: string[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: CreateUserPayload | UpdateUserPayload, postIds: string[]]
}>()

const { t } = useI18n()
const formRef = ref<FormInstance>()
const submitting = ref(false)

interface FormModel {
  username: string
  password: string
  nickname: string
  email: string
  phone: string
  deptId: string | undefined
  postIds: string[]
  enabled: boolean
}

const form = reactive<FormModel>({
  username: '',
  password: '',
  nickname: '',
  email: '',
  phone: '',
  deptId: undefined,
  postIds: [],
  enabled: true,
})

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const title = computed(() =>
  props.mode === 'create' ? t('user.createTitle') : t('user.editTitle'),
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

const postOptions = computed(() => props.posts.filter((item) => item.enabled))

const rules = computed<FormRules<FormModel>>(() => ({
  username: [
    { required: true, message: t('user.usernameRequired'), trigger: 'blur' },
    { min: 3, max: 255, message: t('user.usernameLength'), trigger: 'blur' },
  ],
  password: [
    {
      validator: (_rule, value: string, callback) => {
        if (props.mode === 'create') {
          if (!value) {
            callback(new Error(t('user.passwordRequired')))
            return
          }
          if (value.length < 8 || value.length > 72) {
            callback(new Error(t('user.passwordLength')))
            return
          }
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
  email: [
    {
      validator: (_rule, value: string, callback) => {
        if (!value.trim()) {
          callback()
          return
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
          callback(new Error(t('user.emailInvalid')))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
}))

function resetForm(): void {
  form.username = ''
  form.password = ''
  form.nickname = ''
  form.email = ''
  form.phone = ''
  form.deptId = undefined
  form.postIds = []
  form.enabled = true
}

function fillFromEditing(user: ManagedUser): void {
  form.username = user.username
  form.password = ''
  form.nickname = user.nickname ?? ''
  form.email = user.email ?? ''
  form.phone = user.phone ?? ''
  form.deptId = user.deptId ?? undefined
  form.postIds = [...(props.initialPostIds ?? [])]
  form.enabled = user.enabled
}

watch(
  () => [props.modelValue, props.mode, props.editing, props.initialPostIds] as const,
  ([open]) => {
    if (!open) return
    if (props.mode === 'edit' && props.editing) {
      fillFromEditing(props.editing)
    } else {
      resetForm()
    }
  },
)

function buildPayload(): CreateUserPayload | UpdateUserPayload {
  const nickname = form.nickname.trim()
  const email = form.email.trim()
  const phone = form.phone.trim()

  if (props.mode === 'create') {
    const payload: CreateUserPayload = {
      username: form.username.trim(),
      password: form.password,
      enabled: form.enabled,
      postIds: [...form.postIds],
    }
    if (nickname) payload.nickname = nickname
    if (email) payload.email = email
    if (phone) payload.phone = phone
    if (form.deptId) payload.deptId = form.deptId
    return payload
  }

  return {
    username: form.username.trim(),
    enabled: form.enabled,
    deptId: form.deptId ?? null,
    nickname: nickname || undefined,
    email: email || undefined,
    phone: phone || undefined,
  }
}

async function handleSubmit(): Promise<void> {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  emit('submit', buildPayload(), [...form.postIds])
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
      <el-form-item :label="t('user.username')" prop="username">
        <el-input v-model="form.username" maxlength="255" :disabled="mode === 'edit'" />
      </el-form-item>

      <el-form-item v-if="mode === 'create'" :label="t('user.password')" prop="password">
        <el-input v-model="form.password" type="password" show-password maxlength="72" />
      </el-form-item>

      <el-form-item :label="t('user.nickname')" prop="nickname">
        <el-input v-model="form.nickname" maxlength="64" />
      </el-form-item>

      <el-form-item :label="t('user.email')" prop="email">
        <el-input v-model="form.email" maxlength="255" />
      </el-form-item>

      <el-form-item :label="t('user.phone')" prop="phone">
        <el-input v-model="form.phone" maxlength="255" />
      </el-form-item>

      <el-form-item :label="t('user.dept')" prop="deptId">
        <el-tree-select
          v-model="form.deptId"
          :data="deptTreeData"
          clearable
          check-strictly
          filterable
          :render-after-expand="false"
          :placeholder="t('user.deptPlaceholder')"
          class="w-full"
        />
      </el-form-item>

      <el-form-item :label="t('user.posts')" prop="postIds">
        <el-select
          v-model="form.postIds"
          multiple
          clearable
          filterable
          collapse-tags
          collapse-tags-tooltip
          :placeholder="t('user.postsPlaceholder')"
          class="w-full"
        >
          <el-option
            v-for="item in postOptions"
            :key="item.id"
            :label="item.name"
            :value="item.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item :label="t('user.enabled')" prop="enabled">
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
.w-full {
  width: 100%;
}
</style>
