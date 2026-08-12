<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
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

import { bootstrapAccess, loginAuth } from '@/api/auth'
import { registerDynamicRoutes } from '@/router/dynamic'
import AppConfigControls from '@/layouts/main/AppConfigControls.vue'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()

const formRef = ref<FormInstance>()
const loading = ref(false)
const form = reactive({
  username: 'admin',
  password: 'Admin@123456',
})

const rules = computed<Record<string, Rule[]>>(() => ({
  username: [{ required: true, message: t('login.usernameRequired'), trigger: 'blur' }],
  password: [{ required: true, message: t('login.passwordRequired'), trigger: 'blur' }],
}))

async function handleSubmit() {
  loading.value = true
  try {
    await loginAuth({
      username: form.username,
      password: form.password,
    })
    await bootstrapAccess()
    registerDynamicRoutes()

    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await router.replace(redirect || '/')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('login.failed')
    message.error(errorMessage)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-config">
      <AppConfigControls />
    </div>
    <div class="login-panel">
      <h1 class="login-title">{{ t('login.title') }}</h1>
      <p class="login-subtitle">{{ t('login.subtitle') }}</p>

      <Form
        ref="formRef"
        :model="form"
        :rules="rules"
        layout="vertical"
        size="large"
        @finish="handleSubmit"
      >
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
        <FormItem>
          <Button type="primary" html-type="submit" class="login-submit" :loading="loading">
            {{ t('login.submit') }}
          </Button>
        </FormItem>
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
</style>
