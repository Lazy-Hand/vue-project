<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
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
  TextArea,
  TreeSelect,
  type FormInstance,
  type Rule,
} from 'antdv-next'

import { fetchUserList } from '@/api/user'
import type { DeptPayload, DeptTreeNode } from '@/types/dept'
import { collectDescendantIds } from './utils'

interface Props {
  modelValue: boolean
  mode: 'create' | 'edit'
  tree: DeptTreeNode[]
  initialParentId?: string | null
  editing?: DeptTreeNode | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: DeptPayload]
}>()

const { t } = useI18n()
const formRef = ref<FormInstance>()
const submitting = ref(false)

interface FormModel {
  parentId: string | undefined
  name: string
  code: string
  leader: string
  leaderId: string | undefined
  phone: string
  description: string
  sort: number
  enabled: boolean
}

const form = reactive<FormModel>({
  parentId: undefined,
  name: '',
  code: '',
  leader: '',
  leaderId: undefined,
  phone: '',
  description: '',
  sort: 0,
  enabled: true,
})

const leaderUserOptions = ref<{ label: string; value: string }[]>([])
const leaderUserKeyword = ref('')

async function loadLeaderUsers(keyword?: string): Promise<void> {
  try {
    const res = await fetchUserList({ page: 1, pageSize: 100, ...(keyword ? { keyword } : {}) })
    leaderUserOptions.value = (res.items ?? []).map((u) => ({
      label: `${u.nickname || u.username} (${u.username})`,
      value: String(u.id),
    }))
  } catch {
    // ignore
  }
}

function handleLeaderSearch(val: string): void {
  leaderUserKeyword.value = val
  void loadLeaderUsers(val.trim() || undefined)
}

onMounted(async () => {
  void loadLeaderUsers()
})

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const title = computed(() =>
  props.mode === 'create' ? t('dept.createTitle') : t('dept.editTitle'),
)

const rules = computed<Partial<Record<keyof FormModel, Rule[]>>>(() => ({
  name: [
    { required: true, message: t('dept.nameRequired'), trigger: 'blur' },
    {
      validator: async (_rule, value) => {
        const name = typeof value === 'string' ? value.trim() : ''
        if (!name) throw new Error(t('dept.nameRequired'))
      },
      trigger: 'blur',
    },
    { max: 64, message: t('dept.nameLength'), trigger: 'blur' },
  ],
  code: [{ max: 64, message: t('dept.codeLength'), trigger: 'blur' }],
  leader: [{ max: 64, message: t('dept.leaderLength'), trigger: 'blur' }],
  phone: [{ max: 32, message: t('dept.phoneLength'), trigger: 'blur' }],
  description: [{ max: 255, message: t('dept.descriptionLength'), trigger: 'blur' }],
}))

const excludedParentIds = computed(() => {
  if (props.mode !== 'edit' || !props.editing) return new Set<string>()
  return new Set(collectDescendantIds(props.editing))
})

const parentTreeData = computed(() => {
  const mapNodes = (nodes: DeptTreeNode[]): Array<Record<string, unknown>> =>
    nodes
      .filter((node) => !excludedParentIds.value.has(node.id))
      .map((node) => ({
        value: node.id,
        label: node.code ? `${node.name} (${node.code})` : node.name,
        disabled: !node.enabled,
        children: mapNodes(node.children ?? []),
      }))
  return mapNodes(props.tree)
})

function resetForm(): void {
  form.parentId = props.initialParentId ?? undefined
  form.name = ''
  form.code = ''
  form.leader = ''
  form.leaderId = undefined
  form.phone = ''
  form.description = ''
  form.sort = 0
  form.enabled = true
}

function fillFromEditing(node: DeptTreeNode): void {
  form.parentId = node.parentId ?? undefined
  form.name = node.name
  form.code = node.code ?? ''
  form.leader = node.leader ?? ''
  form.leaderId = node.leaderId ?? undefined
  form.phone = node.phone ?? ''
  form.description = node.description ?? ''
  form.sort = node.sort
  form.enabled = node.enabled
}

watch(
  () => [props.modelValue, props.mode, props.editing, props.initialParentId] as const,
  ([open]) => {
    if (!open) return
    if (props.mode === 'edit' && props.editing) fillFromEditing(props.editing)
    else resetForm()
  },
  { immediate: true },
)

function buildPayload(): DeptPayload {
  const clean = (value: string): string | undefined => value.trim() || undefined
  const payload: DeptPayload = {
    name: form.name.trim(),
    parentId: form.parentId ?? null,
    sort: form.sort,
    enabled: form.enabled,
  }

  const code = clean(form.code)
  const leader = clean(form.leader)
  const leaderId = form.leaderId?.trim() || undefined
  const phone = clean(form.phone)
  const description = clean(form.description)
  if (code) payload.code = code
  if (leader) payload.leader = leader
  if (leaderId) payload.leaderId = leaderId
  if (phone) payload.phone = phone
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
  >
    <Form
      ref="formRef"
      :model="form"
      :rules="rules"
      :label-col="{ span: 5 }"
      :wrapper-col="{ span: 19 }"
      class="dept-form"
    >
      <FormItem :label="t('dept.parent')" name="parentId">
        <TreeSelect
          v-model:value="form.parentId"
          :tree-data="parentTreeData"
          allow-clear
          show-search
          :placeholder="t('dept.parentPlaceholder')"
          class="w-full"
        />
      </FormItem>

      <FormItem :label="t('dept.name')" name="name">
        <Input
          v-model:value="form.name"
          :maxlength="64"
          show-count
          :placeholder="t('dept.namePlaceholder')"
        />
      </FormItem>

      <FormItem :label="t('dept.code')" name="code">
        <Input
          v-model:value="form.code"
          :maxlength="64"
          show-count
          :placeholder="t('dept.codePlaceholder')"
        />
      </FormItem>

      <FormItem :label="t('dept.leader')" name="leaderId">
        <Select
          v-model:value="form.leaderId"
          :options="leaderUserOptions"
          allow-clear
          show-search
          :filter-option="false"
          :placeholder="t('dept.leaderPlaceholder')"
          @search="handleLeaderSearch"
        />
      </FormItem>

      <FormItem :label="t('dept.phone')" name="phone">
        <Input
          v-model:value="form.phone"
          :maxlength="32"
          show-count
          :placeholder="t('dept.phonePlaceholder')"
        />
      </FormItem>

      <FormItem :label="t('dept.description')" name="description">
        <TextArea
          v-model:value="form.description"
          :rows="2"
          :maxlength="255"
          show-count
          :placeholder="t('dept.descriptionPlaceholder')"
        />
      </FormItem>

      <FormItem :label="t('dept.sort')" name="sort">
        <InputNumber
          v-model:value="form.sort"
          :min="0"
          :max="9999"
          controls
          :placeholder="t('dept.sortPlaceholder')"
        />
      </FormItem>

      <FormItem :label="t('dept.enabled')" name="enabled">
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
</style>
