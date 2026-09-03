<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { message, Select } from 'antdv-next'

import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const authStore = useAuthStore()

const accountSetOptions = computed(() =>
  authStore.accountSets.map((item) => ({
    label: item.name,
    value: item.id,
  })),
)

const currentId = computed({
  get: () => authStore.currentAccountSetId,
  set: (value: string | null | undefined) => {
    if (!value) return
    try {
      authStore.setCurrentAccountSetId(value)
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('accountSet.switchFailed'))
    }
  },
})
</script>

<template>
  <Select
    v-if="authStore.accountSets.length"
    v-model:value="currentId"
    class="account-set-switcher"
    :options="accountSetOptions"
    :placeholder="t('accountSet.placeholder')"
  />
</template>

<style>
.account-set-switcher {
  flex-shrink: 0;
  width: auto;
  min-width: 100px;
  max-width: 180px;
}

.account-set-switcher.ant-select .ant-select-selector {
  height: 34px !important;
  display: flex !important;
  align-items: center !important;
  border-radius: 9999px !important;
  background-color: #f8fafc !important;
  border-color: #e2e8f0 !important;
  padding-left: 12px !important;
  padding-right: 12px !important;
  font-size: 13px !important;
  font-weight: 500 !important;
  transition: all 0.2s ease !important;
}

.account-set-switcher.ant-select:hover .ant-select-selector {
  border-color: #cbd5e1 !important;
  background-color: #ffffff !important;
}

html.dark .account-set-switcher.ant-select .ant-select-selector {
  background-color: #22242a !important;
  border-color: #2e3038 !important;
  color: #e2e8f0 !important;
}

html.dark .account-set-switcher.ant-select:hover .ant-select-selector {
  border-color: #3b3e48 !important;
  background-color: #262832 !important;
}
</style>
