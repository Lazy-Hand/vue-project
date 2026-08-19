<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Empty, Modal, message } from 'antdv-next'

import {
  createDictItem,
  createDictType,
  deleteDictItem,
  deleteDictType,
  fetchDictItemList,
  fetchDictTypeList,
  updateDictItem,
  updateDictType,
} from '@/api/dict'
import ProTable from '@/components/ProTable/index.vue'
import ProTableActions from '@/components/ProTableActions/index.vue'
import { usePermission } from '@/composables/usePermission'
import { useDictStore } from '@/stores/dict'
import {
  DICT_CODES,
  type DictItem,
  type DictItemPayload,
  type DictType,
  type DictTypePayload,
  type UpdateDictItemPayload,
  type UpdateDictTypePayload,
} from '@/types/dict'
import type {
  ProTableAction,
  ProTableColumn,
  ProTableExpose,
  ProTableRequestParams,
  ProTableSearchField,
} from '@/types/pro-table'
import { ApiRequestError } from '@/utils/request'
import DictItemFormDialog from './DictItemFormDialog.vue'
import DictTypeFormDialog from './DictTypeFormDialog.vue'

const STATUS_TAG_TYPE_MAP: Record<string, 'success' | 'info'> = {
  '1': 'success',
  '0': 'info',
}

const { t } = useI18n()
const { hasPermission } = usePermission()
const dictStore = useDictStore()

const typeTableRef = ref<ProTableExpose<DictType> | null>(null)
const itemTableRef = ref<ProTableExpose<DictItem> | null>(null)
const selectedType = ref<DictType | null>(null)

const typeFormVisible = ref(false)
const typeFormMode = ref<'create' | 'edit'>('create')
const editingType = ref<DictType | null>(null)
const typeFormRef = ref<InstanceType<typeof DictTypeFormDialog> | null>(null)

const itemFormVisible = ref(false)
const itemFormMode = ref<'create' | 'edit'>('create')
const editingItem = ref<DictItem | null>(null)
const itemFormRef = ref<InstanceType<typeof DictItemFormDialog> | null>(null)

const canCreate = computed(() => hasPermission('system:dict:create'))
const canUpdate = computed(() => hasPermission('system:dict:update'))
const canDelete = computed(() => hasPermission('system:dict:delete'))

const typeSearchFields = computed<ProTableSearchField[]>(() => [
  {
    prop: 'keyword',
    type: 'input',
    placeholder: t('dict.typeSearchPlaceholder'),
    defaultValue: '',
  },
])

const itemSearchFields = computed<ProTableSearchField[]>(() => [
  {
    prop: 'keyword',
    type: 'input',
    placeholder: t('dict.itemSearchPlaceholder'),
    defaultValue: '',
  },
])

const typeColumns = computed<ProTableColumn<DictType>[]>(() => [
  {
    prop: 'name',
    label: t('dict.typeName'),
    minWidth: 120,
    showOverflowTooltip: true,
  },
  {
    prop: 'code',
    label: t('dict.typeCode'),
    minWidth: 130,
    showOverflowTooltip: true,
  },
  {
    prop: 'enabled',
    label: t('dict.enabled'),
    width: 90,
    type: 'dict',
    dictTypeCode: DICT_CODES.COMMON_STATUS,
    tagTypeMap: STATUS_TAG_TYPE_MAP,
  },
  {
    key: 'actions',
    label: t('common.actions'),
    width: 160,
    fixed: 'right',
    type: 'slot',
    slot: 'actions',
  },
])

const itemColumns = computed<ProTableColumn<DictItem>[]>(() => [
  { prop: 'label', label: t('dict.itemLabel'), minWidth: 120 },
  { prop: 'code', label: t('dict.itemCode'), minWidth: 120 },
  { prop: 'value', label: t('dict.itemValue'), minWidth: 100 },
  { prop: 'sort', label: t('dict.sort'), width: 80 },
  {
    prop: 'enabled',
    label: t('dict.enabled'),
    width: 90,
    type: 'dict',
    dictTypeCode: DICT_CODES.COMMON_STATUS,
    tagTypeMap: STATUS_TAG_TYPE_MAP,
  },
  {
    key: 'actions',
    label: t('common.actions'),
    width: 160,
    fixed: 'right',
    type: 'slot',
    slot: 'actions',
  },
])

const typeActions = computed<ProTableAction<DictType>[]>(() => [
  {
    key: 'edit',
    label: t('common.edit'),
    placement: 'inline',
    visible: canUpdate.value,
    onClick: openEditType,
  },
  {
    key: 'delete',
    label: t('common.delete'),
    danger: true,
    visible: canDelete.value,
    onClick: handleDeleteType,
  },
])

const itemActions = computed<ProTableAction<DictItem>[]>(() => [
  {
    key: 'edit',
    label: t('common.edit'),
    placement: 'inline',
    visible: canUpdate.value,
    onClick: openEditItem,
  },
  {
    key: 'delete',
    label: t('common.delete'),
    danger: true,
    visible: canDelete.value,
    onClick: handleDeleteItem,
  },
])

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message
  if (error instanceof Error) return error.message
  return t('dict.requestFailed')
}

function handleRequestError(error: unknown): void {
  message.error(errorMessage(error))
}

function invalidateCache(typeCode?: string): void {
  if (typeCode) {
    dictStore.clear(typeCode)
    return
  }
  dictStore.clear()
}

async function requestTypes(params: ProTableRequestParams) {
  const result = await fetchDictTypeList({
    page: params.page,
    pageSize: params.pageSize,
    keyword: String(params.keyword ?? '').trim() || undefined,
  })

  if (selectedType.value) {
    const stillVisible = result.items.find((item) => item.id === selectedType.value?.id)
    if (stillVisible) {
      selectedType.value = stillVisible
    }
  } else if (result.items.length) {
    selectedType.value = result.items[0] ?? null
  }

  return result
}

async function requestItems(params: ProTableRequestParams) {
  if (!selectedType.value) return []
  return fetchDictItemList({
    page: params.page,
    pageSize: params.pageSize,
    dictTypeId: selectedType.value.id,
    keyword: String(params.keyword ?? '').trim() || undefined,
  })
}

function handleTypeRowClick(row: DictType): void {
  if (selectedType.value?.id === row.id) return
  selectedType.value = row
}

function openCreateType(): void {
  typeFormMode.value = 'create'
  editingType.value = null
  typeFormVisible.value = true
}

function openEditType(row: DictType): void {
  typeFormMode.value = 'edit'
  editingType.value = row
  typeFormVisible.value = true
}

function openCreateItem(): void {
  if (!selectedType.value) {
    message.warning(t('dict.selectTypeFirst'))
    return
  }
  itemFormMode.value = 'create'
  editingItem.value = null
  itemFormVisible.value = true
}

function openEditItem(row: DictItem): void {
  itemFormMode.value = 'edit'
  editingItem.value = row
  itemFormVisible.value = true
}

async function handleTypeSubmit(payload: DictTypePayload | UpdateDictTypePayload): Promise<void> {
  typeFormRef.value?.setSubmitting(true)
  try {
    if (typeFormMode.value === 'create') {
      const created = await createDictType(payload as DictTypePayload)
      message.success(t('dict.createSuccess'))
      typeFormVisible.value = false
      selectedType.value = created
      await typeTableRef.value?.reload()
      return
    }

    if (!editingType.value) return
    const updated = await updateDictType(editingType.value.id, payload as UpdateDictTypePayload)
    message.success(t('dict.updateSuccess'))
    typeFormVisible.value = false
    invalidateCache(editingType.value.code)
    if (selectedType.value?.id === updated.id) {
      selectedType.value = updated
    }
    await typeTableRef.value?.reload()
  } catch (error) {
    message.error(errorMessage(error))
  } finally {
    typeFormRef.value?.setSubmitting(false)
  }
}

async function handleItemSubmit(payload: DictItemPayload | UpdateDictItemPayload): Promise<void> {
  if (!selectedType.value) return
  itemFormRef.value?.setSubmitting(true)
  try {
    if (itemFormMode.value === 'create') {
      await createDictItem(payload as DictItemPayload)
      message.success(t('dict.createSuccess'))
    } else if (editingItem.value) {
      await updateDictItem(editingItem.value.id, payload as UpdateDictItemPayload)
      message.success(t('dict.updateSuccess'))
    }
    itemFormVisible.value = false
    invalidateCache(selectedType.value.code)
    await itemTableRef.value?.reload()
  } catch (error) {
    message.error(errorMessage(error))
  } finally {
    itemFormRef.value?.setSubmitting(false)
  }
}

function confirmDelete(content: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    Modal.confirm({
      title: t('common.tip'),
      content,
      okType: 'danger',
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
}

async function handleDeleteType(row: DictType): Promise<void> {
  const confirmed = await confirmDelete(t('dict.deleteTypeConfirm', { name: row.name }))
  if (!confirmed) return

  try {
    await deleteDictType(row.id)
    message.success(t('dict.deleteSuccess'))
    invalidateCache(row.code)
    if (selectedType.value?.id === row.id) {
      selectedType.value = null
    }
    await typeTableRef.value?.reload()
  } catch (error) {
    message.error(errorMessage(error))
  }
}

async function handleDeleteItem(row: DictItem): Promise<void> {
  const confirmed = await confirmDelete(t('dict.deleteItemConfirm', { name: row.label }))
  if (!confirmed) return

  try {
    await deleteDictItem(row.id)
    message.success(t('dict.deleteSuccess'))
    if (selectedType.value) {
      invalidateCache(selectedType.value.code)
    }
    await itemTableRef.value?.reload()
  } catch (error) {
    message.error(errorMessage(error))
  }
}

watch(
  () => selectedType.value?.id,
  async (id) => {
    if (!id) return
    await nextTick()
    await itemTableRef.value?.resetSearch()
  },
)
</script>

<template>
  <div class="dict-page">
    <section class="dict-page__panel">
      <ProTable
        ref="typeTableRef"
        :columns="typeColumns"
        :search-fields="typeSearchFields"
        :request="requestTypes"
        highlight-current-row
        :current-row-key="selectedType?.id"
        :show-request-error="false"
        @row-click="handleTypeRowClick"
        @request-error="handleRequestError"
      >
        <template #toolbar-actions>
          <Button v-if="canCreate" type="primary" @click="openCreateType">
            {{ t('dict.createType') }}
          </Button>
        </template>

        <template #column-actions="{ row }">
          <ProTableActions :row="row" :actions="typeActions" />
        </template>
      </ProTable>
    </section>

    <section class="dict-page__panel">
      <div class="dict-page__panel-title">
        {{
          selectedType
            ? t('dict.itemsTitle', { name: selectedType.name })
            : t('dict.itemsTitleEmpty')
        }}
      </div>

      <Empty v-if="!selectedType" :description="t('dict.selectTypeFirst')" />

      <ProTable
        v-else
        ref="itemTableRef"
        :columns="itemColumns"
        :search-fields="itemSearchFields"
        :request="requestItems"
        :immediate="false"
        :show-request-error="false"
        @request-error="handleRequestError"
      >
        <template #toolbar-actions>
          <Button v-if="canCreate" type="primary" @click="openCreateItem">
            {{ t('dict.createItem') }}
          </Button>
        </template>

        <template #column-actions="{ row }">
          <ProTableActions :row="row" :actions="itemActions" />
        </template>
      </ProTable>
    </section>

    <DictTypeFormDialog
      ref="typeFormRef"
      v-model="typeFormVisible"
      :mode="typeFormMode"
      :editing="editingType"
      @submit="handleTypeSubmit"
    />

    <DictItemFormDialog
      v-if="selectedType"
      ref="itemFormRef"
      v-model="itemFormVisible"
      :mode="itemFormMode"
      :dict-type-id="selectedType.id"
      :editing="editingItem"
      @submit="handleItemSubmit"
    />
  </div>
</template>

<style scoped lang="scss">
.dict-page {
  display: grid;
  grid-template-columns: minmax(320px, 2fr) minmax(360px, 3fr);
  gap: 16px;
  height: 100%;
  min-height: 0;
}

.dict-page__panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  min-height: 0;
  padding: 16px;
  background: #fff;
  border-radius: 8px;
}

.dict-page__panel-title {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}

@media (max-width: 1100px) {
  .dict-page {
    grid-template-columns: 1fr;
  }
}
</style>
