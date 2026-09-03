<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Drawer, Select, Switch, Table, Tag, message } from 'antdv-next'

import {
  fetchApprovalDefinitions,
  fetchSceneBindings,
  setSceneBindingEnabled,
  upsertSceneBinding,
} from '@/api/approval'
import type { ApprovalDefinition, ApprovalSceneBinding } from '@/types/approval'
import { ApiRequestError } from '@/utils/request'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const { t } = useI18n()
const loading = ref(false)
const bindings = ref<ApprovalSceneBinding[]>([])
// 每个场景行编辑中的版本选择
const editingVersion = ref<Record<string, string>>({})
const saving = ref<Record<string, boolean>>({})

const visible = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

const publishedOptions = ref<{ label: string; value: string }[]>([])

async function load(): Promise<void> {
  loading.value = true
  try {
    const [bindingList, defs] = await Promise.all([
      fetchSceneBindings(),
      fetchApprovalDefinitions({ page: 1, pageSize: 100 }),
    ])
    bindings.value = bindingList
    publishedOptions.value = (defs.items as ApprovalDefinition[])
      .filter((d) => d.publishedVersion !== null && d.publishedVersion !== undefined)
      .map((d) => ({
        label: `${d.name} v${d.publishedVersion}`,
        value: versionIdOf(d),
      }))
  } catch (error) {
    message.error(errorMessage(error))
  } finally {
    loading.value = false
  }
}

/** 定义详情接口未直接暴露版本记录 ID 时，退化为让用户先在版本历史中查看。 */
function versionIdOf(d: ApprovalDefinition): string {
  const summary = d.versions?.find((v) => v.status === 'PUBLISHED')
  return summary?.id ?? ''
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message
  if (error instanceof Error) return error.message
  return t('approval.requestFailed')
}

async function save(row: ApprovalSceneBinding): Promise<void> {
  const versionId = editingVersion.value[row.sceneCode] || row.versionId
  saving.value[row.sceneCode] = true
  try {
    await upsertSceneBinding(row.sceneCode, { versionId })
    message.success(t('approval.definition.bindingUpdated'))
    await load()
  } catch (error) {
    message.error(errorMessage(error))
  } finally {
    saving.value[row.sceneCode] = false
  }
}

async function toggleEnabled(row: ApprovalSceneBinding, enabled: boolean): Promise<void> {
  try {
    await setSceneBindingEnabled(row.sceneCode, enabled)
    row.enabled = enabled
    message.success(t('approval.definition.bindingUpdated'))
  } catch (error) {
    message.error(errorMessage(error))
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) void load()
  },
)
</script>

<template>
  <Drawer
    :open="visible"
    :title="t('approval.definition.sceneBindings')"
    :size="720"
    destroy-on-hidden
    @close="visible = false"
  >
    <p class="mb-3 text-sm text-slate-500 dark:text-slate-400">
      {{ t('approval.definition.onlyPublishedTip') }}
    </p>

    <Table
      :data-source="bindings"
      :loading="loading"
      row-key="id"
      :pagination="false"
      size="small"
      :columns="[
        { title: t('approval.definition.bindingScene'), dataIndex: 'sceneCode', key: 'sceneCode' },
        { title: t('approval.definition.bindingVersion'), key: 'version' },
        { title: t('approval.definition.bindingEnabled'), key: 'enabled', width: 90 },
        { title: t('common.actions'), key: 'actions', width: 100 },
      ]"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'version'">
          <div class="flex items-center gap-2">
            <Tag color="blue">v{{ (record as ApprovalSceneBinding).version }}</Tag>
            <span class="text-xs text-slate-500 dark:text-slate-400">
              {{ (record as ApprovalSceneBinding).definitionName }}
            </span>
          </div>
          <Select
            class="mt-1 w-56"
            size="small"
            :value="
              editingVersion[(record as ApprovalSceneBinding).sceneCode] ??
              (record as ApprovalSceneBinding).versionId
            "
            :options="publishedOptions"
            :placeholder="t('approval.definition.bindingVersion')"
            @change="
              (val) => (editingVersion[(record as ApprovalSceneBinding).sceneCode] = String(val))
            "
          />
        </template>
        <template v-else-if="column.key === 'enabled'">
          <Switch
            :checked="(record as ApprovalSceneBinding).enabled"
            @change="(val) => toggleEnabled(record as ApprovalSceneBinding, Boolean(val))"
          />
        </template>
        <template v-else-if="column.key === 'actions'">
          <Button
            type="link"
            size="small"
            :loading="saving[(record as ApprovalSceneBinding).sceneCode]"
            @click="save(record as ApprovalSceneBinding)"
          >
            {{ t('common.confirm') }}
          </Button>
        </template>
      </template>
    </Table>
  </Drawer>
</template>
