<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ElButton,
  ElEmpty,
  ElInput,
  ElMessage,
  ElMessageBox,
  ElPagination,
  ElTable,
  ElTableColumn,
} from 'element-plus'

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
import DictTag from '@/components/DictTag/index.vue'
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

const canCreate = computed(() => hasPermission('system:dict:create'))
const canUpdate = computed(() => hasPermission('system:dict:update'))
const canDelete = computed(() => hasPermission('system:dict:delete'))

const typeLoading = ref(false)
const typeKeyword = ref('')
const types = ref<DictType[]>([])
const typePage = ref(1)
const typePageSize = ref(10)
const typeTotal = ref(0)
const selectedType = ref<DictType | null>(null)

const itemLoading = ref(false)
const itemKeyword = ref('')
const items = ref<DictItem[]>([])
const itemPage = ref(1)
const itemPageSize = ref(10)
const itemTotal = ref(0)

const typeFormVisible = ref(false)
const typeFormMode = ref<'create' | 'edit'>('create')
const editingType = ref<DictType | null>(null)
const typeFormRef = ref<InstanceType<typeof DictTypeFormDialog> | null>(null)

const itemFormVisible = ref(false)
const itemFormMode = ref<'create' | 'edit'>('create')
const editingItem = ref<DictItem | null>(null)
const itemFormRef = ref<InstanceType<typeof DictItemFormDialog> | null>(null)

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message
  if (error instanceof Error) return error.message
  return t('dict.requestFailed')
}

function invalidateCache(typeCode?: string): void {
  if (typeCode) {
    dictStore.clear(typeCode)
    return
  }
  dictStore.clear()
}

async function loadTypes(): Promise<void> {
  typeLoading.value = true
  try {
    const result = await fetchDictTypeList({
      page: typePage.value,
      pageSize: typePageSize.value,
      keyword: typeKeyword.value.trim() || undefined,
    })
    types.value = result.items
    typeTotal.value = result.total

    if (selectedType.value) {
      const stillVisible = result.items.find((item) => item.id === selectedType.value?.id)
      if (stillVisible) {
        selectedType.value = stillVisible
      }
    } else if (result.items.length) {
      selectedType.value = result.items[0] ?? null
    }
  } catch (error) {
    ElMessage.error(errorMessage(error))
  } finally {
    typeLoading.value = false
  }
}

async function loadItems(): Promise<void> {
  if (!selectedType.value) {
    items.value = []
    itemTotal.value = 0
    return
  }

  itemLoading.value = true
  try {
    const result = await fetchDictItemList({
      page: itemPage.value,
      pageSize: itemPageSize.value,
      dictTypeId: selectedType.value.id,
      keyword: itemKeyword.value.trim() || undefined,
    })
    items.value = result.items
    itemTotal.value = result.total
  } catch (error) {
    ElMessage.error(errorMessage(error))
  } finally {
    itemLoading.value = false
  }
}

function handleTypeRowClick(row: DictType): void {
  if (selectedType.value?.id === row.id) return
  selectedType.value = row
  itemPage.value = 1
  itemKeyword.value = ''
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
    ElMessage.warning(t('dict.selectTypeFirst'))
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
      ElMessage.success(t('dict.createSuccess'))
      typeFormVisible.value = false
      await loadTypes()
      selectedType.value = created
      itemPage.value = 1
      await loadItems()
      return
    }

    if (!editingType.value) return
    const updated = await updateDictType(editingType.value.id, payload as UpdateDictTypePayload)
    ElMessage.success(t('dict.updateSuccess'))
    typeFormVisible.value = false
    invalidateCache(editingType.value.code)
    if (selectedType.value?.id === updated.id) {
      selectedType.value = updated
    }
    await loadTypes()
  } catch (error) {
    ElMessage.error(errorMessage(error))
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
      ElMessage.success(t('dict.createSuccess'))
    } else if (editingItem.value) {
      await updateDictItem(editingItem.value.id, payload as UpdateDictItemPayload)
      ElMessage.success(t('dict.updateSuccess'))
    }
    itemFormVisible.value = false
    invalidateCache(selectedType.value.code)
    await loadItems()
  } catch (error) {
    ElMessage.error(errorMessage(error))
  } finally {
    itemFormRef.value?.setSubmitting(false)
  }
}

async function handleDeleteType(row: DictType): Promise<void> {
  try {
    await ElMessageBox.confirm(t('dict.deleteTypeConfirm', { name: row.name }), t('common.tip'), {
      type: 'warning',
    })
  } catch {
    return
  }

  try {
    await deleteDictType(row.id)
    ElMessage.success(t('dict.deleteSuccess'))
    invalidateCache(row.code)
    if (selectedType.value?.id === row.id) {
      selectedType.value = null
      items.value = []
      itemTotal.value = 0
    }
    if (types.value.length === 1 && typePage.value > 1) {
      typePage.value -= 1
    }
    await loadTypes()
    if (!selectedType.value && types.value.length) {
      selectedType.value = types.value[0] ?? null
    }
    await loadItems()
  } catch (error) {
    ElMessage.error(errorMessage(error))
  }
}

async function handleDeleteItem(row: DictItem): Promise<void> {
  try {
    await ElMessageBox.confirm(t('dict.deleteItemConfirm', { name: row.label }), t('common.tip'), {
      type: 'warning',
    })
  } catch {
    return
  }

  try {
    await deleteDictItem(row.id)
    ElMessage.success(t('dict.deleteSuccess'))
    if (selectedType.value) {
      invalidateCache(selectedType.value.code)
    }
    if (items.value.length === 1 && itemPage.value > 1) {
      itemPage.value -= 1
    }
    await loadItems()
  } catch (error) {
    ElMessage.error(errorMessage(error))
  }
}

function onEditType(row: unknown): void {
  openEditType(row as DictType)
}

function onDeleteType(row: unknown): void {
  void handleDeleteType(row as DictType)
}

function onEditItem(row: unknown): void {
  openEditItem(row as DictItem)
}

function onDeleteItem(row: unknown): void {
  void handleDeleteItem(row as DictItem)
}

function handleTypeSearch(): void {
  typePage.value = 1
  void loadTypes()
}

function handleItemSearch(): void {
  itemPage.value = 1
  void loadItems()
}

function handleTypePageChange(next: number): void {
  typePage.value = next
  void loadTypes()
}

function handleTypeSizeChange(size: number): void {
  typePageSize.value = size
  typePage.value = 1
  void loadTypes()
}

function handleItemPageChange(next: number): void {
  itemPage.value = next
  void loadItems()
}

function handleItemSizeChange(size: number): void {
  itemPageSize.value = size
  itemPage.value = 1
  void loadItems()
}

watch(
  () => selectedType.value?.id,
  () => {
    void loadItems()
  },
)

onMounted(() => {
  void loadTypes()
})
</script>

<template>
  <div class="dict-page">
    <section class="dict-page__panel">
      <div class="dict-page__toolbar">
        <el-input
          v-model="typeKeyword"
          clearable
          class="dict-page__search"
          :placeholder="t('dict.typeSearchPlaceholder')"
          @keyup.enter="handleTypeSearch"
          @clear="handleTypeSearch"
        />
        <div class="dict-page__actions">
          <el-button @click="loadTypes">{{ t('common.refresh') }}</el-button>
          <el-button v-if="canCreate" type="primary" @click="openCreateType">
            {{ t('dict.createType') }}
          </el-button>
        </div>
      </div>

      <el-table
        v-loading="typeLoading"
        :data="types"
        row-key="id"
        highlight-current-row
        class="dict-page__table"
        :current-row-key="selectedType?.id"
        @row-click="handleTypeRowClick"
      >
        <el-table-column prop="name" :label="t('dict.typeName')" min-width="120" show-overflow-tooltip />
        <el-table-column prop="code" :label="t('dict.typeCode')" min-width="130" show-overflow-tooltip />
        <el-table-column :label="t('dict.enabled')" width="90">
          <template #default="{ row }">
            <DictTag
              :type-code="DICT_CODES.COMMON_STATUS"
              :value="row.enabled"
              :tag-type-map="STATUS_TAG_TYPE_MAP"
            />
          </template>
        </el-table-column>
        <el-table-column :label="t('common.actions')" width="120" fixed="right">
          <template #default="{ row }">
            <el-button v-if="canUpdate" link type="primary" @click.stop="onEditType(row)">
              {{ t('common.edit') }}
            </el-button>
            <el-button v-if="canDelete" link type="danger" @click.stop="onDeleteType(row)">
              {{ t('common.delete') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="dict-page__pagination">
        <el-pagination
          v-model:current-page="typePage"
          v-model:page-size="typePageSize"
          background
          small
          layout="total, sizes, prev, pager, next"
          :total="typeTotal"
          :page-sizes="[10, 20, 50]"
          @current-change="handleTypePageChange"
          @size-change="handleTypeSizeChange"
        />
      </div>
    </section>

    <section class="dict-page__panel">
      <div class="dict-page__toolbar">
        <div class="dict-page__panel-title">
          {{
            selectedType
              ? t('dict.itemsTitle', { name: selectedType.name })
              : t('dict.itemsTitleEmpty')
          }}
        </div>
        <div class="dict-page__actions">
          <el-input
            v-model="itemKeyword"
            clearable
            class="dict-page__search"
            :disabled="!selectedType"
            :placeholder="t('dict.itemSearchPlaceholder')"
            @keyup.enter="handleItemSearch"
            @clear="handleItemSearch"
          />
          <el-button :disabled="!selectedType" @click="loadItems">{{ t('common.refresh') }}</el-button>
          <el-button v-if="canCreate" type="primary" :disabled="!selectedType" @click="openCreateItem">
            {{ t('dict.createItem') }}
          </el-button>
        </div>
      </div>

      <el-empty v-if="!selectedType" :description="t('dict.selectTypeFirst')" />

      <template v-else>
        <el-table v-loading="itemLoading" :data="items" row-key="id" class="dict-page__table">
          <el-table-column prop="label" :label="t('dict.itemLabel')" min-width="120" />
          <el-table-column prop="code" :label="t('dict.itemCode')" min-width="120" />
          <el-table-column prop="value" :label="t('dict.itemValue')" min-width="100" />
          <el-table-column prop="sort" :label="t('dict.sort')" width="80" />
          <el-table-column :label="t('dict.enabled')" width="90">
            <template #default="{ row }">
              <DictTag
                :type-code="DICT_CODES.COMMON_STATUS"
                :value="row.enabled"
                :tag-type-map="STATUS_TAG_TYPE_MAP"
              />
            </template>
          </el-table-column>
          <el-table-column :label="t('common.actions')" width="120" fixed="right">
            <template #default="{ row }">
              <el-button v-if="canUpdate" link type="primary" @click="onEditItem(row)">
                {{ t('common.edit') }}
              </el-button>
              <el-button v-if="canDelete" link type="danger" @click="onDeleteItem(row)">
                {{ t('common.delete') }}
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="dict-page__pagination">
          <el-pagination
            v-model:current-page="itemPage"
            v-model:page-size="itemPageSize"
            background
            small
            layout="total, sizes, prev, pager, next"
            :total="itemTotal"
            :page-sizes="[10, 20, 50]"
            @current-change="handleItemPageChange"
            @size-change="handleItemSizeChange"
          />
        </div>
      </template>
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
  align-items: start;
}

.dict-page__panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  padding: 16px;
  background: #fff;
  border-radius: 8px;
}

.dict-page__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.dict-page__panel-title {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}

.dict-page__search {
  width: 220px;
}

.dict-page__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.dict-page__table {
  width: 100%;
}

.dict-page__pagination {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 1100px) {
  .dict-page {
    grid-template-columns: 1fr;
  }
}
</style>
