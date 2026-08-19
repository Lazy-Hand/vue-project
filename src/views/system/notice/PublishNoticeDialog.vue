<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Modal, Radio, RadioGroup, Select, TreeSelect, message } from 'antdv-next'

import { fetchDeptTree } from '@/api/dept'
import { publishNotice } from '@/api/notice'
import { fetchPosts } from '@/api/post'
import { fetchRoles } from '@/api/role'
import { fetchUserList } from '@/api/user'
import type { DeptTreeNode } from '@/types/dept'
import type { NoticeTargetPayload, NoticeTargetScope } from '@/types/notice'
import { ApiRequestError } from '@/utils/request'

interface Props {
  modelValue: boolean
  noticeId: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  success: []
}>()

const { t } = useI18n()

const scope = ref<NoticeTargetScope>('ALL')
const submitting = ref(false)
const userIds = ref<string[]>([])
const roleIds = ref<string[]>([])
const postIds = ref<string[]>([])
const deptIds = ref<string[]>([])

const userOptions = ref<Array<{ value: string; label: string }>>([])
const roleOptions = ref<Array<{ value: string; label: string }>>([])
const postOptions = ref<Array<{ value: string; label: string }>>([])
const deptTree = ref<DeptTreeNode[]>([])

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message
  if (error instanceof Error) return error.message
  return t('notice.requestFailed')
}

/** 部门树节点转 TreeSelect treeData。 */
function toTreeData(nodes: DeptTreeNode[]): Array<{
  value: string
  title: string
  children: ReturnType<typeof toTreeData>
}> {
  return nodes.map((node) => ({
    value: node.id,
    title: node.name,
    children: toTreeData(node.children ?? []),
  }))
}

/** 分页累积加载全量用户（管理端用户数有限，一次取齐便于本地搜索）。 */
async function loadAllUsers(): Promise<void> {
  const pageSize = 100
  const first = await fetchUserList({ page: 1, pageSize })
  const items = [...first.items]
  const totalPages = Math.ceil(first.total / pageSize)

  for (let page = 2; page <= totalPages; page += 1) {
    const result = await fetchUserList({ page, pageSize })
    items.push(...result.items)
  }

  userOptions.value = items.map((user) => ({
    value: user.id,
    label: user.nickname || user.username,
  }))
}

async function loadAudienceOptions(): Promise<void> {
  const [roles, posts, depts] = await Promise.all([fetchRoles(), fetchPosts(), fetchDeptTree()])
  roleOptions.value = roles.map((role) => ({ value: role.id, label: role.name }))
  postOptions.value = posts.map((post) => ({ value: post.id, label: post.name }))
  deptTree.value = depts
}

function currentIdCount(): number {
  switch (scope.value) {
    case 'USER':
      return userIds.value.length
    case 'ROLE':
      return roleIds.value.length
    case 'POST':
      return postIds.value.length
    case 'DEPT':
      return deptIds.value.length
    default:
      return 0
  }
}

function buildPayload(): NoticeTargetPayload {
  const payload: NoticeTargetPayload = { targetScope: scope.value }

  switch (scope.value) {
    case 'USER':
      payload.userIds = userIds.value
      break
    case 'ROLE':
      payload.roleIds = roleIds.value
      break
    case 'POST':
      payload.postIds = postIds.value
      break
    case 'DEPT':
      payload.deptIds = deptIds.value
      break
    default:
      break
  }

  return payload
}

async function handleSubmit(): Promise<void> {
  if (scope.value !== 'ALL' && currentIdCount() === 0) {
    message.warning(t('notice.selectTargetRequired'))
    return
  }

  submitting.value = true
  try {
    await publishNotice(props.noticeId, buildPayload())
    message.success(t('notice.publishSuccess'))
    visible.value = false
    emit('success')
  } catch (error) {
    message.error(errorMessage(error))
  } finally {
    submitting.value = false
  }
}

function resetSelection(): void {
  scope.value = 'ALL'
  userIds.value = []
  roleIds.value = []
  postIds.value = []
  deptIds.value = []
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    resetSelection()
    void loadAudienceOptions()
    void loadAllUsers()
  },
  { immediate: true },
)
</script>

<template>
  <Modal
    v-model:open="visible"
    :title="t('notice.publishTitle')"
    width="560px"
    destroy-on-hidden
    :get-container="false"
    :confirm-loading="submitting"
  >
    <div class="notice-publish">
      <div class="notice-publish__title">{{ t('notice.publishTarget') }}</div>
      <RadioGroup v-model:value="scope" class="notice-publish__scope">
        <Radio value="ALL">{{ t('notice.scopeAll') }}</Radio>
        <Radio value="USER">{{ t('notice.scopeUser') }}</Radio>
        <Radio value="ROLE">{{ t('notice.scopeRole') }}</Radio>
        <Radio value="POST">{{ t('notice.scopePost') }}</Radio>
        <Radio value="DEPT">{{ t('notice.scopeDept') }}</Radio>
      </RadioGroup>

      <div v-if="scope === 'USER'" class="notice-publish__picker">
        <Select
          v-model:value="userIds"
          mode="multiple"
          show-search
          :options="userOptions"
          :placeholder="t('notice.selectUsers')"
          style="width: 100%"
        />
      </div>
      <div v-else-if="scope === 'ROLE'" class="notice-publish__picker">
        <Select
          v-model:value="roleIds"
          mode="multiple"
          :options="roleOptions"
          :placeholder="t('notice.selectRoles')"
          style="width: 100%"
        />
      </div>
      <div v-else-if="scope === 'POST'" class="notice-publish__picker">
        <Select
          v-model:value="postIds"
          mode="multiple"
          :options="postOptions"
          :placeholder="t('notice.selectPosts')"
          style="width: 100%"
        />
      </div>
      <div v-else-if="scope === 'DEPT'" class="notice-publish__picker">
        <TreeSelect
          v-model:value="deptIds"
          multiple
          tree-checkable
          show-checked-strategy="SHOW_PARENT"
          :tree-data="toTreeData(deptTree)"
          :placeholder="t('notice.selectDepts')"
          style="width: 100%"
        />
      </div>

      <div class="notice-publish__hint">{{ t('notice.scopeHint') }}</div>
    </div>

    <template #footer>
      <Button @click="visible = false">{{ t('common.cancel') }}</Button>
      <Button type="primary" :loading="submitting" @click="handleSubmit">
        {{ t('notice.publish') }}
      </Button>
    </template>
  </Modal>
</template>

<style scoped lang="scss">
.notice-publish__title {
  margin-bottom: 8px;
  font-size: 14px;
  color: #1f2937;
  font-weight: 500;
}

.notice-publish__scope {
  display: flex;
  flex-wrap: wrap;
  gap: 0 16px;
  margin-bottom: 16px;
}

.notice-publish__picker {
  margin-bottom: 12px;
}

.notice-publish__hint {
  font-size: 12px;
  color: #9ca3af;
}
</style>
