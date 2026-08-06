<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElOption, ElSelect } from 'element-plus'

import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const authStore = useAuthStore()

const currentId = computed({
  get: () => authStore.currentAccountSetId,
  set: (value: string | null | undefined) => {
    if (!value) return
    try {
      authStore.setCurrentAccountSetId(value)
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : t('accountSet.switchFailed'))
    }
  },
})
</script>

<template>
  <el-select
    v-if="authStore.accountSets.length"
    v-model="currentId"
    class="account-set-switcher"
    :placeholder="t('accountSet.placeholder')"
    size="default"
  >
    <el-option
      v-for="item in authStore.accountSets"
      :key="item.id"
      :label="item.name"
      :value="item.id"
    />
  </el-select>
</template>

<style scoped>
.account-set-switcher {
  width: 160px;
}
</style>
