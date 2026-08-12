<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FormInstance, Rule } from 'antdv-next'
import {
  Button,
  Form,
  FormItem,
  Input,
  InputPassword,
  Select,
  Switch,
  TreeSelect,
  Modal,
} from 'antdv-next'

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
const postSelectOptions = computed(() =>
  postOptions.value.map((item) => ({ label: item.name, value: item.id })),
)

const rules = computed<Record<string, Rule[]>>(() => ({
  username: [
    { required: true, message: t('user.usernameRequired'), trigger: 'blur' },
    { min: 3, max: 255, message: t('user.usernameLength'), trigger: 'blur' },
  ],
  password: [
    {
      validator: (_rule, value: string, callback) => {
        if (props.mode === 'create') {
          if (!value) {
            callback(t('user.passwordRequired'))
            return
          }
          if (value.length < 8 || value.length > 72) {
            callback(t('user.passwordLength'))
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
          callback(t('user.emailInvalid'))
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
  <Modal v-model:open="visible" :title="title" width="560px" destroy-on-hidden>
    <Form ref="formRef" :model="form" :rules="rules" class="user-form">
      <FormItem :label="t('user.username')" name="username">
        <Input v-model:value="form.username" :maxlength="255" :disabled="mode === 'edit'" />
      </FormItem>

      <FormItem v-if="mode === 'create'" :label="t('user.password')" name="password">
        <InputPassword v-model:value="form.password" :maxlength="72" />
      </FormItem>

      <FormItem :label="t('user.nickname')" name="nickname">
        <Input v-model:value="form.nickname" :maxlength="64" />
      </FormItem>

      <FormItem :label="t('user.email')" name="email">
        <Input v-model:value="form.email" :maxlength="255" />
      </FormItem>

      <FormItem :label="t('user.phone')" name="phone">
        <Input v-model:value="form.phone" :maxlength="255" />
      </FormItem>

      <FormItem :label="t('user.dept')" name="deptId">
        <TreeSelect
          v-model:value="form.deptId"
          :tree-data="deptTreeData"
          allow-clear
          show-search
          :placeholder="t('user.deptPlaceholder')"
          class="w-full"
        />
      </FormItem>

      <FormItem :label="t('user.posts')" name="postIds">
        <Select
          v-model:value="form.postIds"
          mode="multiple"
          allow-clear
          show-search
          :options="postSelectOptions"
          option-filter-prop="label"
          :placeholder="t('user.postsPlaceholder')"
          class="w-full"
        />
      </FormItem>

      <FormItem :label="t('user.enabled')" name="enabled">
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
.w-full {
  width: 100%;
}

.user-form {
  :deep(.ant-form-item-label) {
    width: 108px;
  }
}
</style>
