<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FormInstance, Rule } from 'antdv-next'
import { Button, Form, FormItem, Input, Modal, Switch, TextArea } from 'antdv-next'

import type { Client, ClientPayload, UpdateClientPayload } from '@/types/client'

interface Props {
  modelValue: boolean
  mode: 'create' | 'edit'
  editing?: Client | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: ClientPayload | UpdateClientPayload]
}>()

const { t } = useI18n()
const formRef = ref<FormInstance>()
const submitting = ref(false)

interface FormModel {
  code: string
  name: string
  contactName: string
  contactPhone: string
  contactEmail: string
  address: string
  description: string
  enabled: boolean
}

const form = reactive<FormModel>({
  code: '',
  name: '',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  address: '',
  description: '',
  enabled: true,
})

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const title = computed(() =>
  props.mode === 'create' ? t('client.createTitle') : t('client.editTitle'),
)

const rules = computed<Partial<Record<keyof FormModel, Rule[]>>>(() => ({
  code: [
    { required: true, message: t('client.codeRequired'), trigger: 'blur' },
    {
      validator: async (_rule, value) => {
        const length = (typeof value === 'string' ? value : '').trim().length
        if (length < 2 || length > 64) throw new Error(t('client.codeLength'))
      },
      trigger: 'blur',
    },
  ],
  name: [
    { required: true, message: t('client.nameRequired'), trigger: 'blur' },
    {
      validator: async (_rule, value) => {
        const name = (typeof value === 'string' ? value : '').trim()
        if (!name) throw new Error(t('client.nameRequired'))
        if (name.length > 64) throw new Error(t('client.nameLength'))
      },
      trigger: 'blur',
    },
  ],
  contactName: [{ max: 64, message: t('client.contactNameLength'), trigger: 'blur' }],
  contactPhone: [{ max: 32, message: t('client.contactPhoneLength'), trigger: 'blur' }],
  address: [{ max: 255, message: t('client.descriptionLength'), trigger: 'blur' }],
  description: [{ max: 255, message: t('client.descriptionLength'), trigger: 'blur' }],
}))

function resetForm(): void {
  form.code = ''
  form.name = ''
  form.contactName = ''
  form.contactPhone = ''
  form.contactEmail = ''
  form.address = ''
  form.description = ''
  form.enabled = true
}

function fillFromEditing(client: Client): void {
  form.code = client.code
  form.name = client.name
  form.contactName = client.contactName ?? ''
  form.contactPhone = client.contactPhone ?? ''
  form.contactEmail = client.contactEmail ?? ''
  form.address = client.address ?? ''
  form.description = client.description ?? ''
  form.enabled = client.enabled
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

function buildPayload(): ClientPayload | UpdateClientPayload {
  const name = form.name.trim()
  const contactName = form.contactName.trim()
  const contactPhone = form.contactPhone.trim()
  const contactEmail = form.contactEmail.trim()
  const address = form.address.trim()
  const description = form.description.trim()

  if (props.mode === 'create') {
    const payload: ClientPayload = {
      code: form.code.trim(),
      name,
      enabled: form.enabled,
    }
    if (contactName) payload.contactName = contactName
    if (contactPhone) payload.contactPhone = contactPhone
    if (contactEmail) payload.contactEmail = contactEmail
    if (address) payload.address = address
    if (description) payload.description = description
    return payload
  }

  const payload: UpdateClientPayload = {
    name,
    enabled: form.enabled,
  }
  if (form.code.trim()) (payload as UpdateClientPayload).code = form.code.trim()
  if (contactName) payload.contactName = contactName
  if (contactPhone) payload.contactPhone = contactPhone
  if (contactEmail) payload.contactEmail = contactEmail
  if (address) payload.address = address
  if (description) payload.description = description
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
    :get-container="false"
    :confirm-loading="submitting"
  >
    <Form
      ref="formRef"
      :model="form"
      :rules="rules"
      :label-col="{ span: 5 }"
      :wrapper-col="{ span: 19 }"
      class="client-form"
    >
      <FormItem :label="t('client.code')" name="code">
        <Input
          v-model:value="form.code"
          :maxlength="64"
          show-count
          :placeholder="t('client.codePlaceholder')"
        />
      </FormItem>

      <FormItem :label="t('client.name')" name="name">
        <Input
          v-model:value="form.name"
          :maxlength="64"
          show-count
          :placeholder="t('client.namePlaceholder')"
        />
      </FormItem>

      <FormItem :label="t('client.contactName')" name="contactName">
        <Input
          v-model:value="form.contactName"
          :maxlength="64"
          :placeholder="t('client.contactNamePlaceholder')"
        />
      </FormItem>

      <FormItem :label="t('client.contactPhone')" name="contactPhone">
        <Input
          v-model:value="form.contactPhone"
          :maxlength="32"
          :placeholder="t('client.contactPhonePlaceholder')"
        />
      </FormItem>

      <FormItem :label="t('client.contactEmail')" name="contactEmail">
        <Input
          v-model:value="form.contactEmail"
          :maxlength="255"
          :placeholder="t('client.contactEmailPlaceholder')"
        />
      </FormItem>

      <FormItem :label="t('client.address')" name="address">
        <Input
          v-model:value="form.address"
          :maxlength="255"
          :placeholder="t('client.addressPlaceholder')"
        />
      </FormItem>

      <FormItem :label="t('client.description')" name="description">
        <TextArea
          v-model:value="form.description"
          :rows="2"
          :maxlength="255"
          show-count
          :placeholder="t('client.descriptionPlaceholder')"
        />
      </FormItem>

      <FormItem :label="t('client.enabled')" name="enabled">
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
