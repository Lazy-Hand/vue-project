<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FormInstance, FormRules } from 'element-plus'
import { ElButton, ElDialog, ElForm, ElFormItem, ElInput } from 'element-plus'

import type { ManagedUser } from '@/types/user'

interface Props {
  modelValue: boolean
  user: ManagedUser | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [password: string]
}>()

const { t } = useI18n()
const formRef = ref<FormInstance>()
const submitting = ref(false)
const form = reactive({
  password: '',
  confirmPassword: '',
})

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const title = computed(() =>
  props.user ? t('user.resetPasswordTitle', { name: props.user.username }) : t('user.resetPassword'),
)

const rules = computed<FormRules<typeof form>>(() => ({
  password: [
    { required: true, message: t('user.passwordRequired'), trigger: 'blur' },
    { min: 8, max: 72, message: t('user.passwordLength'), trigger: 'blur' },
  ],
  confirmPassword: [
    {
      validator: (_rule, value: string, callback) => {
        if (!value) {
          callback(new Error(t('user.confirmPasswordRequired')))
          return
        }
        if (value !== form.password) {
          callback(new Error(t('user.confirmPasswordMismatch')))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
}))

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    form.password = ''
    form.confirmPassword = ''
  },
)

async function handleSubmit(): Promise<void> {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  emit('submit', form.password)
}

defineExpose({
  setSubmitting(value: boolean) {
    submitting.value = value
  },
})
</script>

<template>
  <el-dialog v-model="visible" :title="title" width="480px" destroy-on-close>
    <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
      <el-form-item :label="t('user.newPassword')" prop="password">
        <el-input v-model="form.password" type="password" show-password maxlength="72" />
      </el-form-item>
      <el-form-item :label="t('user.confirmPassword')" prop="confirmPassword">
        <el-input v-model="form.confirmPassword" type="password" show-password maxlength="72" />
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
