<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import {
  message,
  Button,
  Form,
  FormItem,
  Input,
  InputPassword,
  Result,
  type FormInstance,
  type Rule,
} from 'antdv-next'

import { forgotPassword, resetPassword } from '@/api/auth'
import AppConfigControls from '@/layouts/main/AppConfigControls.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))

const formRef = ref<FormInstance>()
const submitting = ref(false)

const requestForm = reactive({
  usernameOrEmail: '',
})

const resetForm = reactive({
  newPassword: '',
  confirmPassword: '',
})

const requestRules = computed<Record<string, Rule[]>>(() => ({
  usernameOrEmail: [
    { required: true, message: t('forgot.usernameOrEmailRequired'), trigger: 'blur' },
  ],
}))

const resetRules = computed<Record<string, Rule[]>>(() => ({
  newPassword: [
    { required: true, message: t('forgot.newPasswordRequired'), trigger: 'blur' },
    { min: 8, max: 72, message: t('forgot.newPasswordLength'), trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: t('forgot.confirmPasswordRequired'), trigger: 'blur' },
    {
      validator: (_rule, value: string) =>
        value === resetForm.newPassword
          ? Promise.resolve()
          : Promise.reject(new Error(t('forgot.confirmPasswordMismatch'))),
      trigger: 'blur',
    },
  ],
}))

/** 申请成功后显示提示；重置成功后跳回登录页。 */
const requested = ref(false)
const resetDone = ref(false)

async function handleRequest() {
  submitting.value = true
  try {
    await forgotPassword({ usernameOrEmail: requestForm.usernameOrEmail })
    requested.value = true
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('forgot.requestFailed')
    message.error(errorMessage)
  } finally {
    submitting.value = false
  }
}

async function handleReset() {
  submitting.value = true
  try {
    await resetPassword({ token: token.value, newPassword: resetForm.newPassword })
    resetDone.value = true
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('forgot.resetFailed')
    message.error(errorMessage)
  } finally {
    submitting.value = false
  }
}

function goLogin() {
  void router.replace('/login')
}

watch(token, () => {
  requested.value = false
  resetDone.value = false
  resetForm.newPassword = ''
  resetForm.confirmPassword = ''
})
</script>

<template>
  <div class="forgot-page">
    <div class="forgot-config">
      <AppConfigControls />
    </div>
    <div class="forgot-panel">
      <!-- 重置成功 -->
      <Result
        v-if="resetDone"
        status="success"
        :title="t('forgot.resetSuccess')"
        :sub-title="t('forgot.resetSuccessSubtitle')"
      >
        <template #extra>
          <Button type="primary" @click="goLogin">{{ t('forgot.backToLogin') }}</Button>
        </template>
      </Result>

      <!-- 已提交申请：恒定提示，防账号枚举 -->
      <template v-else-if="requested">
        <h1 class="forgot-title">{{ t('forgot.requestTitle') }}</h1>
        <p class="forgot-subtitle">{{ t('forgot.requestHint') }}</p>
        <div class="forgot-actions">
          <Button type="primary" block @click="goLogin">{{ t('forgot.backToLogin') }}</Button>
        </div>
      </template>

      <!-- 带 token：设置新密码 -->
      <template v-else-if="token">
        <h1 class="forgot-title">{{ t('forgot.resetTitle') }}</h1>
        <p class="forgot-subtitle">{{ t('forgot.resetSubtitle') }}</p>
        <Form
          ref="formRef"
          :model="resetForm"
          :rules="resetRules"
          layout="vertical"
          @finish="handleReset"
        >
          <FormItem name="newPassword">
            <InputPassword
              v-model:value="resetForm.newPassword"
              :placeholder="t('forgot.newPassword')"
              autocomplete="new-password"
            />
          </FormItem>
          <FormItem name="confirmPassword">
            <InputPassword
              v-model:value="resetForm.confirmPassword"
              :placeholder="t('forgot.confirmPassword')"
              autocomplete="new-password"
              @keyup.enter="handleReset"
            />
          </FormItem>
          <FormItem>
            <Button type="primary" html-type="submit" block :loading="submitting">
              {{ t('forgot.resetSubmit') }}
            </Button>
          </FormItem>
        </Form>
      </template>

      <!-- 默认：申请重置 -->
      <template v-else>
        <h1 class="forgot-title">{{ t('forgot.requestTitle') }}</h1>
        <p class="forgot-subtitle">{{ t('forgot.requestSubtitle') }}</p>
        <Form
          ref="formRef"
          :model="requestForm"
          :rules="requestRules"
          layout="vertical"
          @finish="handleRequest"
        >
          <FormItem name="usernameOrEmail">
            <Input
              v-model:value="requestForm.usernameOrEmail"
              :placeholder="t('forgot.usernameOrEmail')"
              autocomplete="username"
              @keyup.enter="handleRequest"
            />
          </FormItem>
          <FormItem>
            <Button type="primary" html-type="submit" block :loading="submitting">
              {{ t('forgot.requestSubmit') }}
            </Button>
          </FormItem>
          <div class="forgot-actions">
            <Button type="link" block @click="goLogin">{{ t('forgot.backToLogin') }}</Button>
          </div>
        </Form>
      </template>
    </div>
  </div>
</template>

<style scoped>
.forgot-page {
  position: relative;
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  background:
    radial-gradient(circle at top left, rgb(56 189 248 / 0.25), transparent 40%),
    radial-gradient(circle at bottom right, rgb(14 165 233 / 0.2), transparent 35%),
    linear-gradient(160deg, #0f172a 0%, #1e293b 45%, #0f172a 100%);
}

.forgot-config {
  position: absolute;
  top: 20px;
  right: 20px;
}

.forgot-panel {
  width: min(100%, 400px);
  padding: 36px 32px;
  border-radius: 16px;
  background: rgb(255 255 255 / 0.96);
  box-shadow: 0 20px 50px rgb(15 23 42 / 0.35);
}

.forgot-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.02em;
}

.forgot-subtitle {
  margin: 8px 0 24px;
  color: #64748b;
  font-size: 14px;
  line-height: 1.6;
}

.forgot-actions {
  margin-top: 8px;
}
</style>
