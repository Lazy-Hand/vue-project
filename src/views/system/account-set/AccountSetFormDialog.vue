<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FormInstance, Rule } from 'antdv-next'
import { Button, Form, FormItem, Input, InputNumber, Modal, Switch, TextArea } from 'antdv-next'

import type { AccountSet, AccountSetPayload, UpdateAccountSetPayload } from '@/types/account-set'
import { buildAccountSetPayload, isAccountSetTextValid, type AccountSetFormValues } from './utils'

interface Props {
  modelValue: boolean
  mode: 'create' | 'edit'
  editing?: AccountSet | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: AccountSetPayload | UpdateAccountSetPayload]
}>()

const { t } = useI18n()
const formRef = ref<FormInstance>()
const submitting = ref(false)

const form = reactive<AccountSetFormValues>({
  code: '',
  name: '',
  sort: 0,
  enabled: true,
  description: '',
})

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const title = computed(() =>
  props.mode === 'create' ? t('accountSet.createTitle') : t('accountSet.editTitle'),
)

const rules = computed<Partial<Record<keyof AccountSetFormValues, Rule[]>>>(() => ({
  code: [
    { required: true, message: t('accountSet.codeRequired'), trigger: 'blur' },
    {
      validator: async (_rule, value) => {
        const text = typeof value === 'string' ? value : ''
        if (!text.trim()) throw new Error(t('accountSet.codeRequired'))
        if (!isAccountSetTextValid(text, 2, 64)) {
          throw new Error(t('accountSet.codeLength'))
        }
      },
      trigger: 'blur',
    },
  ],
  name: [
    { required: true, message: t('accountSet.nameRequired'), trigger: 'blur' },
    {
      validator: async (_rule, value) => {
        const text = typeof value === 'string' ? value : ''
        if (!text.trim()) throw new Error(t('accountSet.nameRequired'))
        if (!isAccountSetTextValid(text, 1, 64)) {
          throw new Error(t('accountSet.nameLength'))
        }
      },
      trigger: 'blur',
    },
  ],
  description: [{ max: 255, message: t('accountSet.descriptionLength'), trigger: 'blur' }],
}))

function resetForm(): void {
  form.code = ''
  form.name = ''
  form.sort = 0
  form.enabled = true
  form.description = ''
}

function fillFromEditing(accountSet: AccountSet): void {
  form.code = accountSet.code
  form.name = accountSet.name
  form.sort = accountSet.sort
  form.enabled = accountSet.enabled
  form.description = accountSet.description ?? ''
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

async function handleSubmit(): Promise<void> {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  emit('submit', buildAccountSetPayload(form, props.mode))
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
    :get-container="false"
    :confirm-loading="submitting"
  >
    <Form ref="formRef" :model="form" :rules="rules" class="account-set-form">
      <FormItem :label="t('accountSet.code')" name="code">
        <Input v-model:value="form.code" :maxlength="64" show-count :disabled="mode === 'edit'" />
      </FormItem>

      <FormItem :label="t('accountSet.name')" name="name">
        <Input v-model:value="form.name" :maxlength="64" show-count />
      </FormItem>

      <FormItem :label="t('accountSet.sort')" name="sort">
        <InputNumber v-model:value="form.sort" :min="0" :max="9999" />
      </FormItem>

      <FormItem :label="t('accountSet.description')" name="description">
        <TextArea v-model:value="form.description" :rows="2" :maxlength="255" show-count />
      </FormItem>

      <FormItem :label="t('accountSet.enabled')" name="enabled">
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
.account-set-form {
  :deep(.ant-form-item-label) {
    width: 108px;
  }
}
</style>
