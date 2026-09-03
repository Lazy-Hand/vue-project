<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import {
  message,
  Button,
  Form,
  FormItem,
  Input,
  InputPassword,
  type FormInstance,
  type Rule,
} from 'antdv-next'

import { bootstrapAccess, fetchCaptcha, loginAuth } from '@/api/auth'
import { registerDynamicRoutes } from '@/router/dynamic'
import { CAPTCHA_CODE_INVALID, CAPTCHA_CODE_REQUIRED, type CaptchaInfo } from '@/types/auth'
import { ApiRequestError } from '@/utils/request/response'
import AppConfigControls from '@/layouts/main/AppConfigControls.vue'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()

const formRef = ref<FormInstance>()
const loading = ref(false)
const form = reactive({
  username: 'admin',
  password: 'Ng7-gtlIc6OWeVkhke3jOuQGSwOL',
  captchaId: '',
  captchaCode: '',
})

const rules = computed<Record<string, Rule[]>>(() => ({
  username: [{ required: true, message: t('login.usernameRequired'), trigger: 'blur' }],
  password: [{ required: true, message: t('login.passwordRequired'), trigger: 'blur' }],
  captchaCode: [{ required: true, message: t('login.captchaRequired'), trigger: 'blur' }],
}))

/** 验证码是否已成功加载；加载失败（如后端未提供该接口）时隐藏输入区并跳过提交携带。 */
const captchaVisible = ref(false)
const captchaImage = ref('')
const captchaLoading = ref(false)

async function refreshCaptcha() {
  captchaLoading.value = true
  try {
    const captcha: CaptchaInfo = await fetchCaptcha()
    captchaImage.value = captcha.image
    form.captchaId = captcha.captchaId
    form.captchaCode = ''
    captchaVisible.value = true
  } catch {
    captchaVisible.value = false
    form.captchaId = ''
  } finally {
    captchaLoading.value = false
  }
}

/** 验证码错误或过期：刷新图片并清空输入，引导用户重输。 */
async function handleCaptchaMismatch() {
  await refreshCaptcha()
  formRef.value?.validateFields(['captchaCode']).catch(() => undefined)
}

async function handleSubmit() {
  loading.value = true
  try {
    await loginAuth({
      username: form.username,
      password: form.password,
      ...(captchaVisible.value ? { captchaId: form.captchaId, captchaCode: form.captchaCode } : {}),
    })
    await bootstrapAccess()
    registerDynamicRoutes()

    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await router.replace(redirect || '/')
  } catch (error) {
    if (error instanceof ApiRequestError) {
      if (error.code === CAPTCHA_CODE_REQUIRED || error.code === CAPTCHA_CODE_INVALID) {
        await handleCaptchaMismatch()
      }
    }
    const errorMessage = error instanceof Error ? error.message : t('login.failed')
    message.error(errorMessage)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void refreshCaptcha()
})
</script>

<template>
  <div class="login-page">
    <div class="login-config">
      <AppConfigControls />
    </div>
    <div class="login-panel">
      <h1 class="login-title">{{ t('login.title') }}</h1>
      <p class="login-subtitle">{{ t('login.subtitle') }}</p>

      <Form ref="formRef" :model="form" :rules="rules" layout="vertical" @finish="handleSubmit">
        <FormItem name="username">
          <Input
            v-model:value="form.username"
            :placeholder="t('login.username')"
            autocomplete="username"
          />
        </FormItem>
        <FormItem name="password">
          <InputPassword
            v-model:value="form.password"
            :placeholder="t('login.password')"
            autocomplete="current-password"
            @keyup.enter="handleSubmit"
          />
        </FormItem>
        <FormItem v-if="captchaVisible" name="captchaCode" class="captcha-item">
          <div class="captcha-row">
            <Input
              v-model:value="form.captchaCode"
              :placeholder="t('login.captcha')"
              autocomplete="off"
              @keyup.enter="handleSubmit"
            />
            <Button
              class="captcha-image"
              :loading="captchaLoading"
              :title="t('login.captchaRefresh')"
              @click="refreshCaptcha"
            >
              <img v-if="captchaImage" :src="captchaImage" alt="captcha" />
            </Button>
          </div>
        </FormItem>
        <FormItem>
          <Button type="primary" html-type="submit" class="login-submit" :loading="loading">
            {{ t('login.submit') }}
          </Button>
        </FormItem>
        <div class="login-footer">
          <RouterLink class="login-link" to="/forgot">{{ t('login.forgotPassword') }}</RouterLink>
        </div>
      </Form>
    </div>
  </div>
</template>

<style scoped>
.login-page {
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

.login-config {
  position: absolute;
  top: 20px;
  right: 20px;
}

.login-panel {
  width: min(100%, 400px);
  padding: 36px 32px;
  border-radius: 16px;
  background: rgb(255 255 255 / 0.96);
  box-shadow: 0 20px 50px rgb(15 23 42 / 0.35);
}

.login-title {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.02em;
}

.login-subtitle {
  margin: 8px 0 28px;
  color: #64748b;
  font-size: 14px;
}

.login-submit {
  width: 100%;
}

.captcha-item {
  margin-bottom: 16px;
}

.captcha-row {
  display: flex;
  gap: 8px;
}

.captcha-image {
  flex: 0 0 120px;
  height: 32px;
  padding: 0;
  overflow: hidden;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  background: #fff;
}

.captcha-image img {
  display: block;
  width: 100%;
  height: 100%;
}

.login-footer {
  margin-top: 4px;
  text-align: right;
}

.login-link {
  color: #64748b;
  font-size: 13px;
}
</style>
