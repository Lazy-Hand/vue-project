<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FormInstance, Rule } from 'antdv-next'
import { Button, Form, FormItem, InputPassword, Modal } from 'antdv-next'

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
  props.user
    ? t('user.resetPasswordTitle', { name: props.user.username })
    : t('user.resetPassword'),
)

const rules = computed<Record<string, Rule[]>>(() => ({
  password: [
    { required: true, message: t('user.passwordRequired'), trigger: 'blur' },
    { min: 8, max: 72, message: t('user.passwordLength'), trigger: 'blur' },
  ],
  confirmPassword: [
    {
      validator: (_rule, value: string, callback) => {
        if (!value) {
          callback(t('user.confirmPasswordRequired'))
          return
        }
        if (value !== form.password) {
          callback(t('user.confirmPasswordMismatch'))
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
  <Modal v-model:open="visible" :title="title" width="480px" destroy-on-hidden>
    <Form ref="formRef" :model="form" :rules="rules" class="user-reset-password-form">
      <FormItem :label="t('user.newPassword')" name="password">
        <InputPassword v-model:value="form.password" :maxlength="72" />
      </FormItem>
      <FormItem :label="t('user.confirmPassword')" name="confirmPassword">
        <InputPassword v-model:value="form.confirmPassword" :maxlength="72" />
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
.user-reset-password-form {
  :deep(.ant-form-item-label) {
    width: 120px;
  }
}
</style>
