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
/* 非 scoped：antdv-next 的 Select 会把 class 渲染到内部 .ant-select 元素上，
   scoped 的 data-v 标记不会带走，宽高类样式必须用全局选择器才生效 */
.account-set-switcher {
  flex-shrink: 0;
  width: auto;
  min-width: 180px;
  max-width: 320px;
}
</style>
