<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Avatar,
  Button,
  Card,
  Form,
  FormItem,
  Input,
  InputPassword,
  message,
  type FormInstance,
  type Rule,
} from 'antdv-next'

import { buildFileUrl } from '@/api/file'
import { changePassword, updateProfile } from '@/api/auth'
import { pinia } from '@/stores'
import { useAuthStore } from '@/stores/auth'
import type { UpdateProfileParams } from '@/types/auth'

const { t } = useI18n()
const authStore = useAuthStore(pinia)

const profileFormRef = ref<FormInstance>()
const passwordFormRef = ref<FormInstance>()
const savingProfile = ref(false)
const savingPassword = ref(false)

const username = computed(() => authStore.user?.username ?? '')
const avatarSrc = computed(() =>
  authStore.user?.avatar ? buildFileUrl(authStore.user.avatar) : undefined,
)

const profileForm = reactive({
  nickname: authStore.user?.nickname ?? '',
  email: authStore.user?.email ?? '',
  phone: authStore.user?.phone ?? '',
})

const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const profileRules = computed<Record<string, Rule[]>>(() => ({
  nickname: [{ max: 64, message: t('profile.nicknameMaxLength'), trigger: 'blur' }],
  email: [{ type: 'email', message: t('profile.emailInvalid'), trigger: 'blur' }],
  phone: [{ max: 255, message: t('profile.phoneMaxLength'), trigger: 'blur' }],
}))

const passwordRules = computed<Record<string, Rule[]>>(() => ({
  oldPassword: [{ required: true, message: t('profile.oldPasswordRequired'), trigger: 'blur' }],
  newPassword: [
    { required: true, message: t('profile.newPasswordRequired'), trigger: 'blur' },
    { min: 8, max: 72, message: t('profile.newPasswordLength'), trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: t('profile.confirmPasswordRequired'), trigger: 'blur' },
    {
      validator: (_rule, value: string) =>
        value === passwordForm.newPassword
          ? Promise.resolve()
          : Promise.reject(new Error(t('profile.confirmPasswordMismatch'))),
      trigger: 'blur',
    },
  ],
}))

async function handleSaveProfile() {
  savingProfile.value = true
  try {
    // 空字段不提交：后端 PATCH 缺省字段保留原值，空字符串会被邮箱校验拒绝
    const payload: UpdateProfileParams = {}
    if (profileForm.nickname.trim()) payload.nickname = profileForm.nickname.trim()
    if (profileForm.email.trim()) payload.email = profileForm.email.trim()
    if (profileForm.phone.trim()) payload.phone = profileForm.phone.trim()

    const updated = await updateProfile(payload)
    authStore.setUser(updated)
    message.success(t('profile.saved'))
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('profile.saveFailed')
    message.error(errorMessage)
  } finally {
    savingProfile.value = false
  }
}

async function handleChangePassword() {
  savingPassword.value = true
  try {
    await changePassword({
      oldPassword: passwordForm.oldPassword,
      newPassword: passwordForm.newPassword,
    })
    message.success(t('profile.passwordChanged'))
    passwordForm.oldPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
    passwordFormRef.value?.clearValidate()
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('profile.passwordChangeFailed')
    message.error(errorMessage)
  } finally {
    savingPassword.value = false
  }
}
</script>

<template>
  <div class="profile-page">
    <Card :title="t('profile.basicInfo')" class="profile-card">
      <div class="profile-head">
        <Avatar :size="64" :src="avatarSrc">
          <template v-if="!avatarSrc" #icon>
            <span>{{ username.slice(0, 1).toUpperCase() }}</span>
          </template>
        </Avatar>
        <div class="profile-id">
          <div class="profile-username">{{ username }}</div>
          <div class="profile-hint">{{ t('profile.basicInfoHint') }}</div>
        </div>
      </div>

      <Form
        ref="profileFormRef"
        :model="profileForm"
        :rules="profileRules"
        layout="vertical"
        class="profile-form"
        @finish="handleSaveProfile"
      >
        <FormItem name="nickname" :label="t('profile.nickname')">
          <Input
            v-model:value="profileForm.nickname"
            :placeholder="t('profile.nicknamePlaceholder')"
          />
        </FormItem>
        <FormItem name="email" :label="t('profile.email')">
          <Input v-model:value="profileForm.email" :placeholder="t('profile.emailPlaceholder')" />
        </FormItem>
        <FormItem name="phone" :label="t('profile.phone')">
          <Input v-model:value="profileForm.phone" :placeholder="t('profile.phonePlaceholder')" />
        </FormItem>
        <FormItem>
          <Button type="primary" html-type="submit" :loading="savingProfile">
            {{ t('profile.save') }}
          </Button>
        </FormItem>
      </Form>
    </Card>

    <Card :title="t('profile.changePassword')" class="profile-card">
      <Form
        ref="passwordFormRef"
        :model="passwordForm"
        :rules="passwordRules"
        layout="vertical"
        class="profile-form"
        @finish="handleChangePassword"
      >
        <FormItem name="oldPassword" :label="t('profile.oldPassword')">
          <InputPassword
            v-model:value="passwordForm.oldPassword"
            :placeholder="t('profile.oldPasswordPlaceholder')"
            autocomplete="current-password"
          />
        </FormItem>
        <FormItem name="newPassword" :label="t('profile.newPassword')">
          <InputPassword
            v-model:value="passwordForm.newPassword"
            :placeholder="t('profile.newPasswordPlaceholder')"
            autocomplete="new-password"
          />
        </FormItem>
        <FormItem name="confirmPassword" :label="t('profile.confirmPassword')">
          <InputPassword
            v-model:value="passwordForm.confirmPassword"
            :placeholder="t('profile.confirmPasswordPlaceholder')"
            autocomplete="new-password"
          />
        </FormItem>
        <FormItem>
          <Button type="primary" html-type="submit" :loading="savingPassword">
            {{ t('profile.save') }}
          </Button>
        </FormItem>
      </Form>
    </Card>
  </div>
</template>

<style scoped>
.profile-page {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 16px;
  align-items: start;
}

.profile-head {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.profile-username {
  font-size: 18px;
  font-weight: 600;
  color: #0f172a;
}

.profile-hint {
  margin-top: 4px;
  font-size: 13px;
  color: #94a3b8;
}

.profile-form {
  max-width: 420px;
}
</style>
